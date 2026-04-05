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
Pass 2 SHALL format SQL query results into a concise Traditional Chinese response that includes a summary, key data points, and relevant statistics.

#### Scenario: Format tabular results
- **WHEN** Pass 1 SQL returns multiple rows with price data
- **THEN** Pass 2 response MUST include: count of records, average unit price, and price range (min-max)

### Requirement: Error handling — DB error
When the database returns an error or the AI-generated SQL is invalid, the system SHALL return a friendly message suggesting the user simplify their query, along with preset quick-query suggestions.

#### Scenario: SQL syntax error from AI
- **WHEN** qwen-plus generates invalid SQL that causes a database error
- **THEN** the system responds with "目前的查詢條件過於複雜，系統無法精確解析。請嘗試簡化您的問題。" and displays quick-query buttons

### Requirement: Error handling — empty results
When the query executes successfully but returns zero rows, the system SHALL check etl_log to confirm data availability, then inform the user that no matching records were found.

#### Scenario: Query returns no data
- **WHEN** a valid SQL query returns zero rows
- **THEN** the system checks etl_log for the latest import status, then responds with "查無符合條件的資料" along with the most recent data update timestamp
