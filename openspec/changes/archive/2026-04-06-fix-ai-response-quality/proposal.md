## Why

AI 回覆有四個品質問題影響使用體驗：單位換算錯誤、面積單位不明確、回覆過於冗長、時間範圍不夠彈性。這些都是 prompt 和 route 邏輯的問題，不需要改架構。

## What Changes

- 修改 Pass 2 system prompt：明確化價格換算規則、強制標示面積單位、精簡回覆風格
- 修改 Pass 1 system prompt：改善模糊時間詞的處理
- 新增空結果自動 retry 邏輯：查無資料時自動擴大時間範圍重新查詢

## Capabilities

### New Capabilities
<!-- 無新 capability -->

### Modified Capabilities
- `ai-query`: 修改 Response formatting 和 Error handling — empty results 兩個 requirement 的行為

## Impact

- **修改檔案**：`app/lib/prompts.ts`（Pass 1 + Pass 2 prompt）、`app/api/chat/route.ts`（retry 邏輯）
- **無新依賴**
