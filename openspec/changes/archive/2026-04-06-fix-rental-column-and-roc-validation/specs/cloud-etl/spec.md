## MODIFIED Requirements

### Requirement: ETL pipeline stages

#### Scenario: Rental CSV column mapping
- **WHEN** the Transform stage processes a rental CSV (*_c.csv)
- **THEN** the column mapping correctly handles rental-specific headers (租賃年月日, 租賃筆棟數, 租賃層次, 土地面積平方公尺, 建物總面積平方公尺, 總額元, 有無電梯) with fallback to older format headers

#### Scenario: ROC year validation
- **WHEN** the Transform stage converts a ROC date with year < 90 or > 120
- **THEN** the date is set to NULL instead of producing an incorrect AD date
