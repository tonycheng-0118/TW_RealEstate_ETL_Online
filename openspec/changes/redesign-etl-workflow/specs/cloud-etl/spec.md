## MODIFIED Requirements

### Requirement: Scheduled ETL via GitHub Actions
The workflow_dispatch SHALL have 2 modes (`import` / `delete`) with unified `start_season`, `end_season`, and `city` parameters. The special value `current` represents the latest period, determined by computing the current ROC season from today's date (year=AD-1911, quarter=(month-1)÷3+1). `source_season` SHALL always be tagged with the actual season number (e.g. `115S2`), never the string `current`.

**Parameter defaults:**
- `start_season` empty → current season
- `end_season` empty → from start_season through current season (inclusive)
- `city` empty → all

**`current` rules:**
- `current` cannot be used as `start_season` in a range (because it's newer than any season)
- `current` can be used as `end_season` (means "up to latest period")
- `start_season=current` + `end_season=空/current` → single current season only

**Validation rules:**
- Invalid season format → error
- end_season < start_season → error
- Season exceeding current season → error
- `current` as start + any season as end → error

#### Scenario: Import current (default, no params)
- **WHEN** user triggers workflow with mode=import, start_season=empty, end_season=empty
- **THEN** the workflow computes the current season (e.g. 115S2), imports the latest period, and tags source_season='115S2'

#### Scenario: Import single season
- **WHEN** user triggers workflow with mode=import, start_season=114S2, end_season=114S2
- **THEN** the workflow imports season 114S2 only

#### Scenario: Import season range
- **WHEN** user triggers workflow with mode=import, start_season=113S1, end_season=114S4
- **THEN** the workflow imports all seasons from 113S1 through 114S4

#### Scenario: Import from season to current
- **WHEN** user triggers workflow with mode=import, start_season=113S1, end_season=empty
- **THEN** the workflow imports all seasons from 113S1 through the current season (e.g. 113S1, 113S2, ..., 115S2), plus the current period data

#### Scenario: Import from season to current (explicit)
- **WHEN** user triggers workflow with mode=import, start_season=113S1, end_season=current
- **THEN** same behavior as end_season=empty (113S1 through current)

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
- **THEN** the workflow fails with an error (current cannot be start of a range with a specific season end)

#### Scenario: Cron schedule unchanged
- **WHEN** the cron schedule triggers
- **THEN** mode defaults to import, computes current season, imports latest period

#### Scenario: Partial delete is accepted
- **WHEN** delete is processing seasons 112S1~113S4 and DB connection drops at 113S1
- **THEN** 112S1~113S1 are already deleted, 113S2~113S4 are not; the workflow reports the failure

### Requirement: Abolish 'current' source_season tag
The ETL pipeline SHALL compute the actual ROC season number from today's date and use it as `source_season` instead of the literal string `current`. Formula: ROC year = AD year - 1911, quarter = ceil(month / 3). Example: 2026-04-06 → 115S2.

#### Scenario: Current import uses computed season
- **WHEN** ETL runs in current mode on 2026-04-06
- **THEN** imported records are tagged with source_season='115S2', not 'current'

### Requirement: Delete mode supports range
The `delete.py` script SHALL support both single season (`--season`) and range (`--from` / `--to`) deletion. Range deletion SHALL iterate through each season in the range and delete records sequentially. Partial deletion on failure is accepted.

#### Scenario: Delete range of seasons
- **WHEN** delete.py is called with --from 112S1 --to 113S4
- **THEN** records for all seasons from 112S1 through 113S4 are deleted from transactions, rentals, and etl_log
