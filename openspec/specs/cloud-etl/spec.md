## Purpose

雲端 ETL 排程 — GitHub Actions 定期從內政部下載實價登錄資料，轉換後匯入 Supabase。

## Requirements

### Requirement: Scheduled ETL via GitHub Actions
The system SHALL execute the ETL pipeline automatically via GitHub Actions on a cron schedule: the 2nd, 12th, and 22nd of each month at 03:00 UTC+8. The workflow_dispatch inputs SHALL support 4 modes (current/season/range/delete), with season, from_season, to_season, and city parameters.

#### Scenario: Scheduled ETL execution
- **WHEN** the cron schedule triggers on the 2nd of the month at 03:00 UTC+8
- **THEN** the GitHub Actions workflow downloads the current season's data from plvr.land.moi.gov.tw, transforms it, and loads it into Supabase

#### Scenario: Workflow dispatch with range inputs
- **WHEN** user manually triggers the workflow and selects mode=range
- **THEN** the workflow accepts from_season and to_season inputs and passes them to run_etl.py as --from and --to arguments

### Requirement: ETL pipeline stages
The ETL pipeline SHALL execute 3 stages in order: Download (fetch ZIP from Ministry of Interior), Transform (decode encoding, map columns, convert ROC dates), and Load (upsert into Supabase PostgreSQL via psycopg2).

#### Scenario: Full pipeline execution
- **WHEN** the ETL workflow runs for season "114S1"
- **THEN** ZIP files are downloaded, CSVs are extracted and transformed, and records are upserted into transactions and rentals tables using serial_no as the conflict key

### Requirement: Idempotent loading
The ETL load stage SHALL check etl_log before processing each file. Files already loaded (matching season + filename) SHALL be skipped.

#### Scenario: Re-run does not create duplicates
- **WHEN** the ETL runs twice for the same season
- **THEN** the second run skips files already recorded in etl_log and produces no duplicate records

### Requirement: Supabase connection
The ETL scripts SHALL connect to Supabase PostgreSQL using a connection string provided via GitHub Actions secrets. The connection SHALL use an etl_writer role with INSERT and UPDATE privileges.

#### Scenario: ETL connects to Supabase
- **WHEN** the GitHub Actions workflow starts the load stage
- **THEN** psycopg2 connects using the SUPABASE_DB_URL secret and successfully upserts records

### Requirement: Range mode ETL
The workflow SHALL support a `range` mode that accepts `from_season` and `to_season` parameters (e.g. `113S1` to `114S4`). The ETL pipeline MUST execute sequentially for each season in the range, with a delay between downloads.

#### Scenario: Range import of multiple seasons
- **WHEN** user triggers workflow with mode=range, from_season=113S1, to_season=114S4, city=all
- **THEN** the workflow downloads, transforms, and loads data for all seasons from 113S1 through 114S4 in order

#### Scenario: Range with specific city
- **WHEN** user triggers workflow with mode=range, from_season=114S1, to_season=114S2, city=A
- **THEN** only Taipei City (city_code=A) data is processed for seasons 114S1 and 114S2

### Requirement: Delete mode
The workflow SHALL support a `delete` mode that removes data for a specified season and optionally a specific city. The delete MUST remove matching records from transactions, rentals, and etl_log tables.

#### Scenario: Delete all data for a season
- **WHEN** user triggers workflow with mode=delete, season=112S1, city=all
- **THEN** all records with source_season='112S1' are deleted from transactions and rentals, and matching etl_log entries are removed

#### Scenario: Delete data for a specific city and season
- **WHEN** user triggers workflow with mode=delete, season=113S2, city=A
- **THEN** only records with source_season='113S2' AND city_code='A' are deleted from transactions and rentals, and corresponding etl_log entries are removed

#### Scenario: Delete mode is manual-only
- **WHEN** the cron schedule triggers the workflow
- **THEN** the workflow runs in `current` mode, NOT delete mode (delete is never triggered by cron)

### Requirement: ETL failure isolation
Individual file processing failures SHALL NOT block other files from being processed. Failed files SHALL be logged in etl_log with status 'error'.

#### Scenario: One file fails, others succeed
- **WHEN** file "A_lvr_land_a.csv" fails to parse but "B_lvr_land_a.csv" is valid
- **THEN** "B_lvr_land_a.csv" is loaded successfully and "A_lvr_land_a.csv" is logged with status 'error'
