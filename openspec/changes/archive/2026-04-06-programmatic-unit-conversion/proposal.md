## Why

Pass 2 LLM (qwen3-8B) 負責將 DB 查詢結果的數值換算成使用者友善格式（元→萬、m²→坪、單價換算），但 LLM 做算術本質上不可靠。實測發現每筆坪數換算比率都不同（3.01~3.03 而非正確的 3.306），面積為零時仍顯示單價，且 DB 的 unit_price（已扣車位）與總價/面積的計算結果不一致卻未說明。這些錯誤直接影響使用者對數據的信任度。

## What Changes

- **新增程式化數值預處理層**：在 SQL 結果送入 Pass 2 之前，用 TypeScript 精確換算所有數值（面積 m²→坪、價格元→萬、單價元/m²→萬/坪），確保 100% 正確
- **更新 Pass 2 prompt**：告知 LLM 數值已預先換算完成，禁止自行計算，只負責組織文字
- **處理邊界案例**：面積為 0 時加入提示標記（如「僅土地交易」），避免除以零或顯示矛盾數值
- **加入車位扣除說明指引**：當 unit_price 與 total_price/building_area 差距大時，提示 Pass 2 說明「單價已扣除車位」

## Non-goals

- 不修改 Pass 1 (text-to-SQL) 的邏輯
- 不修改 DB schema 或 ETL 流程
- 不變更前端 UI

## Capabilities

### New Capabilities
- `result-preprocessing`: DB 查詢結果的程式化數值換算層，在 Pass 2 之前將原始數值轉換為使用者友善格式

### Modified Capabilities
- `ai-query`: Response formatting requirement 改為由程式預處理數值 + LLM 僅負責文字組織，不再依賴 LLM 做數學換算

## Impact

- `app/lib/format-result.ts` — 新增模組
- `app/api/chat/route.ts` — 在 Pass 2 呼叫前插入預處理步驟
- `app/lib/prompts.ts` — 更新 PASS2_SYSTEM_PROMPT
- 測試：新增 format-result 的 unit tests
