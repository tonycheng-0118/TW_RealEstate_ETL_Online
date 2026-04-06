## MODIFIED Requirements

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
