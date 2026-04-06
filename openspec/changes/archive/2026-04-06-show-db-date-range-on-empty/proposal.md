## Why

查詢結果為空時，使用者只看到「查無符合條件的資料」，不知道 DB 裡實際有哪段時間的資料。加上 DB 資料的時間範圍提示，讓使用者知道該怎麼調整查詢。

## What Changes

- 修改空結果回應：查詢 DB 中 transactions 和 rentals 的 `MIN(transaction_date_ad)` ~ `MAX(transaction_date_ad)`，附在「查無資料」訊息中
- 修改 `db.ts` 新增查詢資料時間範圍的函式

## Capabilities

### New Capabilities
<!-- 無 -->

### Modified Capabilities
- `ai-query`: 修改 Error handling — empty results 的回應內容

## Impact

- **修改檔案**：`app/lib/db.ts`（新增函式）、`app/api/chat/route.ts`（空結果回應）
- **無新依賴**
