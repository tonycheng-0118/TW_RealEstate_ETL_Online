## Purpose

雲端 ETL 排程 — GitHub Actions 定期從內政部下載實價登錄資料，轉換後匯入 Supabase。

## Requirements

### Requirement: Scheduled ETL via GitHub Actions
The system SHALL execute the ETL pipeline automatically via GitHub Actions on a cron schedule: the 2nd, 12th, and 22nd of each month at 03:00 UTC+8.

#### Scenario: Scheduled ETL execution
- **WHEN** the cron schedule triggers on the 2nd of the month at 03:00 UTC+8
- **THEN** the GitHub Actions workflow downloads the current season's data from plvr.land.moi.gov.tw, transforms it, and loads it into Supabase

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

### Requirement: ETL failure isolation
Individual file processing failures SHALL NOT block other files from being processed. Failed files SHALL be logged in etl_log with status 'error'.

#### Scenario: One file fails, others succeed
- **WHEN** file "A_lvr_land_a.csv" fails to parse but "B_lvr_land_a.csv" is valid
- **THEN** "B_lvr_land_a.csv" is loaded successfully and "A_lvr_land_a.csv" is logged with status 'error'
