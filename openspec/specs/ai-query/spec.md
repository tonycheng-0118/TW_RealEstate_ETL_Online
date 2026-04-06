## Purpose

AI 自然語言查詢介面 — 使用者輸入自然語言，系統透過 LLM API 轉換為 SQL 查詢 Supabase，並以繁體中文回覆結果。

## Requirements

### Requirement: Two-pass AI query flow
The system SHALL implement a two-pass AI flow for natural language real estate queries. Pass 1 uses qwen-plus to convert user input to a PostgreSQL SELECT statement. Pass 2 uses qwen-turbo to format the query results into a human-readable Traditional Chinese response.

#### Scenario: Successful natural language query
- **WHEN** user submits "大安區近一年兩房公寓均價"
- **THEN** Pass 1 generates a valid SELECT query filtering by district='大安區', rooms=2, building_type LIKE '%公寓%', and transaction_date_ad >= CURRENT_DATE - INTERVAL '1 year', and Pass 2 returns a formatted response with average price, count, and price range in Traditional Chinese

#### Scenario: Complex multi-condition query
- **WHEN** user submits "信義區捷運站旁三房電梯大樓，總價 3000 萬以下"
- **THEN** Pass 1 generates a SELECT with address trigram search for '捷運', rooms=3, building_type LIKE '%大樓%', and total_price < 30000000

### Requirement: Text-to-SQL system prompt
The system SHALL send a system prompt to qwen-plus containing: (1) role definition as a PostgreSQL expert that only returns SQL, (2) database DDL with column comments in Chinese, (3) at least 5 few-shot examples covering common query patterns, and (4) the user's actual question.

#### Scenario: System prompt includes schema and examples
- **WHEN** the API route processes a user query
- **THEN** the system prompt sent to qwen-plus MUST include the full DDL of transactions and rentals tables, column-level comments, and few-shot examples mapping Chinese natural language to SQL

### Requirement: Response formatting
Pass 2 SHALL format SQL query results using pre-computed conversion values provided by the result preprocessing layer. Pass 2 SHALL NOT perform any mathematical calculations. Specifically:
- 總價：使用 `_wan` 欄位（萬元），超過 10,000 萬元改用億元
- 單價：使用 `_wan_ping` 欄位（萬元/坪），同時顯示原始 元/m² 值
- 月租金：直接用元表示（未換算）
- 面積：同時顯示原始 m² 值和 `_ping` 欄位（坪）
- 當出現 `_note` 欄位時，SHALL 將該說明融入回覆文字
- 回覆風格：直接給結論和數據，禁止重複問題、禁止推理過程，300 字以內

#### Scenario: Format tabular results
- **WHEN** Pass 1 SQL returns multiple rows with price data
- **THEN** Pass 2 response MUST include: count of records, average unit price, and price range (min-max)

#### Scenario: Price unit conversion
- **WHEN** query returns `total_price: 150000000` with pre-computed `total_price_wan: 15000.0`
- **THEN** Pass 2 displays "1.5 億元" using the pre-computed value, NOT by calculating 150000000 ÷ 100000000

#### Scenario: Area with dual units
- **WHEN** query returns `building_area: 132.12` with pre-computed `building_area_ping: 39.96`
- **THEN** Pass 2 displays "132.12 m²（約 39.96 坪）" using the pre-computed value

#### Scenario: Concise response
- **WHEN** Pass 2 generates a response
- **THEN** the response does NOT contain the user's original question, reasoning steps, or filler phrases like "根據查詢結果"

#### Scenario: Zero-area annotation
- **WHEN** query returns a row with `building_area_note: "僅土地交易，無建物面積"`
- **THEN** Pass 2 mentions this is a land-only transaction in the response

### Requirement: Error handling — DB error
When the database returns an error or the AI-generated SQL is invalid, the system SHALL return a friendly message suggesting the user simplify their query, along with preset quick-query suggestions.

#### Scenario: SQL syntax error from AI
- **WHEN** qwen-plus generates invalid SQL that causes a database error
- **THEN** the system responds with "目前的查詢條件過於複雜，系統無法精確解析。請嘗試簡化您的問題。" and displays quick-query buttons

### Requirement: Error handling — empty results
When the query returns zero rows and the SQL contains a time condition, the system SHALL automatically retry with a wider time range (up to 1 retry). Only after retry still returns empty SHALL the system query the actual data season range and inform the user.

#### Scenario: Query returns no data
- **WHEN** a valid SQL query returns zero rows (after retry)
- **THEN** the system queries MIN/MAX source_season from transactions and responds with "查無符合條件的資料。目前資料庫收錄 民國{year}年第{quarter}季 ~ 民國{year}年第{quarter}季 的成交紀錄，請調整查詢的時間範圍或條件。"

#### Scenario: Empty result shows DB season range
- **WHEN** a query returns zero rows (after retry)
- **THEN** the response includes the actual season range (source_season) of data in the database, formatted as 民國年第N季

#### Scenario: Auto-expand time range on empty result
- **WHEN** a query with INTERVAL '1 month' returns zero rows
- **THEN** the system automatically retries with INTERVAL '1 year' before returning "查無資料"

#### Scenario: No retry for non-time queries
- **WHEN** a query without time conditions returns zero rows
- **THEN** the system returns "查無資料" without retrying
