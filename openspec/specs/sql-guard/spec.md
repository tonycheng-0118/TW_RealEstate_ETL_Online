## Purpose

SQL 安全防護層 — 白名單檢查（僅允許 SELECT）、query timeout、rate limiting，防止注入與濫用。

## Requirements

### Requirement: SQL whitelist validation
The system SHALL validate all AI-generated SQL before execution. Only statements beginning with SELECT (case-insensitive) SHALL be allowed. Statements containing DROP, ALTER, INSERT, UPDATE, DELETE, TRUNCATE, or EXECUTE keywords MUST be rejected.

#### Scenario: Valid SELECT query passes
- **WHEN** the AI generates "SELECT district, AVG(unit_price) FROM transactions GROUP BY district"
- **THEN** the SQL passes validation and is executed against the database

#### Scenario: Dangerous SQL is rejected
- **WHEN** the AI generates "DROP TABLE transactions; SELECT 1"
- **THEN** the SQL is rejected before execution and a friendly error message is returned to the user

#### Scenario: Multi-statement SQL is rejected
- **WHEN** the AI generates SQL containing semicolons (multiple statements)
- **THEN** the SQL is rejected before execution

### Requirement: Read-only database role
The system SHALL connect to Supabase using a read-only PostgreSQL role (app_reader) that only has SELECT privileges on transactions, rentals, and etl_log tables.

#### Scenario: Write attempt from app role
- **WHEN** any INSERT, UPDATE, or DELETE is attempted via the app_reader role
- **THEN** PostgreSQL rejects the operation with a permission error

### Requirement: Query timeout
The system SHALL enforce a maximum query execution time of 10 seconds. Queries exceeding this limit MUST be terminated.

#### Scenario: Long-running query is terminated
- **WHEN** a query takes more than 10 seconds to execute
- **THEN** the query is cancelled and the user receives a friendly timeout message

### Requirement: Rate limiting
The system SHALL enforce rate limiting on the /api/chat endpoint. The limit SHALL be 10 requests per minute per IP address.

#### Scenario: Normal usage within limit
- **WHEN** a user sends 5 queries within one minute
- **THEN** all queries are processed normally

#### Scenario: Rate limit exceeded
- **WHEN** a user sends more than 10 queries within one minute
- **THEN** subsequent requests receive a 429 status code with a message indicating they should wait before trying again
