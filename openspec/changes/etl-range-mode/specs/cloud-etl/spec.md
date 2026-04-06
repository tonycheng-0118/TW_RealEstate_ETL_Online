## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: Scheduled ETL via GitHub Actions
The workflow_dispatch inputs SHALL be expanded to include: `mode` (current/season/range/delete), `season`, `from_season`, `to_season`, and `city`.

#### Scenario: Workflow dispatch with range inputs
- **WHEN** user manually triggers the workflow and selects mode=range
- **THEN** the workflow accepts from_season and to_season inputs and passes them to run_etl.py as --from and --to arguments
