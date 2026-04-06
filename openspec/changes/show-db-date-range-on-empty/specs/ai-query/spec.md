## MODIFIED Requirements

### Requirement: Error handling — empty results

#### Scenario: Empty result shows DB date range
- **WHEN** a query returns zero rows (after retry)
- **THEN** the response includes the actual date range of data in the database (e.g. "目前資料庫收錄 2024-01-15 ~ 2025-12-20 的成交紀錄")
