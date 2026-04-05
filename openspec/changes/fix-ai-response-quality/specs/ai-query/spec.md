## MODIFIED Requirements

### Requirement: Response formatting
Pass 2 SHALL format SQL query results with precise unit conversion rules:
- 總價：元 ÷ 10000 = 萬元（例：15,000,000 元 = 1,500 萬元），超過 10,000 萬元改用億元（例：150,000,000 元 = 1.5 億元）
- 單價：保留元/m²，額外換算成萬元/坪
- 月租金：直接用元表示
- 面積：每個數字必須同時標示 m² 和坪（例：132.12 m²（約 39.96 坪））
- 回覆風格：直接給結論和數據，禁止重複問題、禁止推理過程，300 字以內

#### Scenario: Price unit conversion
- **WHEN** query returns total_price = 150000000
- **THEN** Pass 2 displays "1.5 億元"，not "150 億" or "15,000 萬元"

#### Scenario: Area with dual units
- **WHEN** query returns building_area = 132.12
- **THEN** Pass 2 displays "132.12 m²（約 39.96 坪）"

#### Scenario: Concise response
- **WHEN** Pass 2 generates a response
- **THEN** the response does NOT contain the user's original question, reasoning steps, or filler phrases like "根據查詢結果"

### Requirement: Error handling — empty results
When the query returns zero rows and the SQL contains a time condition, the system SHALL automatically retry with a wider time range (up to 1 retry). Only after retry still returns empty SHALL the system inform the user.

#### Scenario: Auto-expand time range on empty result
- **WHEN** a query with INTERVAL '1 month' returns zero rows
- **THEN** the system automatically retries with INTERVAL '1 year' before returning "查無資料"

#### Scenario: No retry for non-time queries
- **WHEN** a query without time conditions returns zero rows
- **THEN** the system returns "查無資料" without retrying
