## Purpose

雲端 ETL 排程 — GitHub Actions 定期從內政部下載實價登錄資料，轉換後匯入 Supabase。

## Requirements

### Requirement: Scheduled ETL via GitHub Actions
The workflow_dispatch SHALL have 2 modes (`import` / `delete`) with unified `start_season`, `end_season`, and `city` parameters. `start_season` defaults to current season when empty. `end_season` defaults to start through current season when empty. Seasons exceeding the current period SHALL be rejected. `source_season` SHALL always be tagged with the actual season number (e.g. `115S2`), never the string `current`. Cron schedule SHALL always run import with current season.

**Parameter defaults:**
- `start_season` empty → current season
- `end_season` empty → from start_season through current season (inclusive)
- `city` empty → all

**`current` rules:**
- `current` cannot be used as `start_season` in a range
- `current` can be used as `end_season` (means "up to latest period")
- `start_season=current` + `end_season=空/current` → single current season only

**Validation rules:**
- Invalid season format → error
- end_season < start_season → error
- Season exceeding current season → error
- `current` as start + any season as end → error

#### Scenario: Import current (default, no params)
- **WHEN** user triggers workflow with mode=import, start_season=empty, end_season=empty
- **THEN** the workflow computes the current season (e.g. 115S2), imports the latest period, and tags source_season with the actual season number

#### Scenario: Import single season
- **WHEN** user triggers workflow with mode=import, start_season=114S2, end_season=114S2
- **THEN** the workflow imports season 114S2 only

#### Scenario: Import season range
- **WHEN** user triggers workflow with mode=import, start_season=113S1, end_season=114S4
- **THEN** the workflow imports all seasons from 113S1 through 114S4

#### Scenario: Import from season to current
- **WHEN** user triggers workflow with mode=import, start_season=113S1, end_season=empty
- **THEN** the workflow imports all seasons from 113S1 through the current season, plus the current period data

#### Scenario: Delete single season
- **WHEN** user triggers workflow with mode=delete, start_season=112S1, end_season=112S1
- **THEN** the workflow deletes all data for season 112S1

#### Scenario: Delete season range
- **WHEN** user triggers workflow with mode=delete, start_season=112S1, end_season=113S4
- **THEN** the workflow deletes all data for seasons 112S1 through 113S4

#### Scenario: Delete current season
- **WHEN** user triggers workflow with mode=delete, start_season=empty, end_season=empty
- **THEN** the workflow deletes all data tagged with the current season number

#### Scenario: end_season before start_season is rejected
- **WHEN** user triggers workflow with start_season=114S1, end_season=113S1
- **THEN** the workflow fails with an error message indicating end_season must be >= start_season

#### Scenario: Invalid season format is rejected
- **WHEN** user triggers workflow with start_season=abc
- **THEN** the workflow fails with an error message indicating invalid season format

#### Scenario: Future season is rejected
- **WHEN** user triggers workflow with start_season=120S1 (exceeds current season)
- **THEN** the workflow fails with an error message indicating season exceeds current period

#### Scenario: current as start with season as end is rejected
- **WHEN** user triggers workflow with start_season=empty, end_season=114S1
- **THEN** the workflow fails with an error

#### Scenario: Cron schedule unchanged
- **WHEN** the cron schedule triggers
- **THEN** mode defaults to import, computes current season, imports latest period

#### Scenario: Partial delete is accepted
- **WHEN** delete is processing seasons 112S1~113S4 and DB connection drops at 113S1
- **THEN** 112S1~113S1 are already deleted, 113S2~113S4 are not; the workflow reports the failure

### Requirement: Abolish 'current' source_season tag
The ETL pipeline SHALL compute the actual ROC season number from today's date and use it as `source_season` instead of the literal string `current`. Formula: ROC year = AD year - 1911, quarter = ceil(month / 3).

#### Scenario: Current import uses computed season
- **WHEN** ETL runs in current mode on 2026-04-06
- **THEN** imported records are tagged with source_season='115S2', not 'current'

### Requirement: ETL pipeline stages
The ETL pipeline SHALL execute 3 stages in order: Download (fetch ZIP from Ministry of Interior), Transform (decode encoding, map columns, convert ROC dates), and Load (upsert into Supabase PostgreSQL via psycopg2).

#### Scenario: Rental CSV column mapping
- **WHEN** the Transform stage processes a rental CSV (*_c.csv)
- **THEN** the column mapping correctly handles rental-specific headers (租賃年月日, 租賃筆棟數, 租賃層次, 土地面積平方公尺, 建物總面積平方公尺, 總額元, 有無電梯) with fallback to older format headers

#### Scenario: ROC year validation
- **WHEN** the Transform stage converts a ROC date with year < 90 or > 120
- **THEN** the date is set to NULL instead of producing an incorrect AD date

#### Scenario: Full pipeline execution
- **WHEN** the ETL workflow runs for season "114S1"
- **THEN** ZIP files are downloaded, CSVs are extracted and transformed, and records are upserted into transactions and rentals tables using serial_no as the conflict key

### Requirement: Delete mode
The `delete.py` script SHALL support both single season and range deletion via `--start`/`--end` parameters. Range deletion SHALL iterate through each season and delete records sequentially. Partial deletion on failure is accepted.

#### Scenario: Delete range of seasons
- **WHEN** delete.py is called with --start 112S1 --end 113S4
- **THEN** records for all seasons from 112S1 through 113S4 are deleted from transactions, rentals, and etl_log

#### Scenario: Delete with city filter
- **WHEN** delete.py is called with --start 113S2 --end 113S2 --city A
- **THEN** only records with city_code='A' for season 113S2 are deleted

### Requirement: Idempotent loading
The ETL load stage SHALL check etl_log before processing each file. Files already loaded (matching season + filename) SHALL be skipped.

#### Scenario: Re-run does not create duplicates
- **WHEN** the ETL runs twice for the same season
- **THEN** the second run skips files already recorded in etl_log and produces no duplicate records

### Requirement: Supabase connection
The ETL scripts SHALL connect to Supabase PostgreSQL using a connection string provided via GitHub Actions secrets.

#### Scenario: ETL connects to Supabase
- **WHEN** the GitHub Actions workflow starts the load stage
- **THEN** psycopg2 connects using the SUPABASE_DB_URL secret and successfully upserts records

### Requirement: ETL failure isolation
Individual file processing failures SHALL NOT block other files from being processed. Failed files SHALL be logged in etl_log with status 'error'.

#### Scenario: One file fails, others succeed
- **WHEN** file "A_lvr_land_a.csv" fails to parse but "B_lvr_land_a.csv" is valid
- **THEN** "B_lvr_land_a.csv" is loaded successfully and "A_lvr_land_a.csv" is logged with status 'error'
