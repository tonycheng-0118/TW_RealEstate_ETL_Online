## Context

AI 回覆品質有 4 個已知問題（README TODO），全都可以透過修改 prompt 和加一段 retry 邏輯來解決。不需要改架構。

## Goals / Non-Goals

**Goals:**
- 修正價格單位換算（萬元/億元）
- 面積數字必須標示 m² 和坪
- 精簡 AI 回覆（去除自言自語）
- 空結果時自動擴大時間範圍重查

**Non-Goals:**
- 修改 Pass 1 的 SQL 生成邏輯
- 加入多輪對話

## Decisions

### Decision 1: Pass 2 prompt 加入明確換算公式

在 prompt 中直接寫出換算公式和範例，不靠 AI 自己推算：
- `15,000,000 元 = 1,500 萬元`
- `150,000,000 元 = 1.5 億元`（不是 150 億）
- `132.12 m² = 約 39.96 坪`

**為什麼：** 給 AI 模糊規則（「用萬元表示」）會出錯，給明確公式和範例最穩。

### Decision 2: 空結果 retry — 替換 SQL 中的 INTERVAL

空結果時，用正規表達式找 SQL 中的 `INTERVAL 'X month/week/day'`，替換成 `INTERVAL '1 year'` 重新執行。

**替代方案：** 重新呼叫 Pass 1 讓 AI 產新 SQL → 多一次 LLM 呼叫，太慢太貴。

**為什麼：** 直接字串替換最快（0ms），不需要額外 API 呼叫。只替換短時間範圍（< 1 year），已經是 1 year 的不 retry。

## Risks / Trade-offs

**[Retry 誤替換]** → 只替換 `INTERVAL '...'` pattern，不動其他 SQL 部分。最壞情況是 retry 也查無資料，使用者看到跟現在一樣的「查無資料」訊息。
