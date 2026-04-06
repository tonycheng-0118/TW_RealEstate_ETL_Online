## Context

目前空結果回應只顯示 etl_log 的最後更新時間。使用者不知道 DB 裡實際有哪段時間的資料，無從判斷該怎麼調整查詢。

## Goals / Non-Goals

**Goals:**
- 空結果時顯示 DB 中資料的實際時間範圍（最早～最晚成交日期）

**Non-Goals:**
- 改變有結果時的回應格式

## Decisions

### Decision 1: 新增 getDataDateRange() 函式

在 `db.ts` 新增：
```sql
SELECT
  MIN(transaction_date_ad) as earliest,
  MAX(transaction_date_ad) as latest
FROM transactions
WHERE transaction_date_ad IS NOT NULL
```

同時查 rentals 取兩者的 min/max。或用 UNION 合併。

**選擇簡單做法：** 只查 transactions（資料量最大、使用者最常查的表）。rentals 的時間範圍通常跟 transactions 差不多。

### Decision 2: 回應格式

```
查無符合條件的資料。目前資料庫收錄 2024-01-15 ~ 2025-12-20 的成交紀錄，請調整查詢時間範圍。
```
