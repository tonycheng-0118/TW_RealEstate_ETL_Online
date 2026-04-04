## Context

既有的 TW_RealEstate_ETL 是一套本地 Python ETL 系統，每月從內政部實價登錄平台下載 ZIP/CSV 資料，經轉換後匯入本地 PostgreSQL。查詢需透過 Claude Skill 或 SQL client。

本專案目標是將這套系統搬上線：前端透過 Vercel 部署，資料庫使用 Supabase，AI 查詢整合 Qwen API，ETL 排程移至 GitHub Actions。

**限制條件：**
- Vercel Hobby（免費）：Serverless function timeout 60s、100K invocations/月
- Qwen API 免費額度：需控制呼叫頻率
- Supabase 免費方案：500MB 儲存、50K 月活用戶
- 全新 codebase，無既有程式碼需相容

## Goals / Non-Goals

**Goals:**
- 任何人都能透過網頁用自然語言查詢台灣實價登錄資料
- ETL 自動化，無需人工介入即可定期更新資料
- 安全防護：防止 SQL injection、濫用查詢、資料竄改

**Non-Goals:**
- 使用者帳號系統 / 登入功能
- 查詢結果的圖表可視化（僅純文字）
- 即時資料串流（依靠定期 batch ETL）
- 行動端 App
- 變現功能（廣告、付費方案等留待 PMF 驗證後）

## Decisions

### Decision 1: Two-pass AI 架構

**選擇：** 將 AI 查詢拆為兩次獨立的 Qwen API 呼叫。

- **Pass 1（qwen-plus）**：專注 text-to-SQL，system prompt 精簡嚴格，僅回傳純 SQL
- **Pass 2（qwen-turbo）**：接收 SQL 結果 + 原始問題，整理成繁體中文回覆

**替代方案：** Single-pass — 一次呼叫同時生成 SQL 和回覆。

**為什麼不選：** Single-pass 的 prompt 更複雜，SQL 精準度難以獨立調校，出錯時難以定位是 SQL 生成還是結果格式化的問題。Two-pass 允許 Pass 1 用更強的模型（qwen-plus）確保 SQL 品質，Pass 2 用更快的模型（qwen-turbo）節省延遲和成本。

### Decision 2: SQL Guard 多層防護

**選擇：** 四層安全機制堆疊。

1. **應用層白名單**：正規表達式檢查 SQL 必須以 SELECT 開頭，拒絕危險關鍵字和分號
2. **資料庫層 read-only role**：`app_reader` 角色僅有 SELECT 權限
3. **Query timeout**：10 秒上限，透過 `statement_timeout` 設定
4. **Rate limiting**：10 req/min/IP，使用 in-memory Map 或 Vercel KV

**為什麼：** AI 生成的 SQL 不可信任。即使 prompt 指示「只回傳 SELECT」，模型可能被 prompt injection 攻擊。多層防護確保任何一層被突破時仍有後續保護。

### Decision 3: Next.js App Router + shadcn/ui

**選擇：** Next.js 14+ App Router，搭配 Tailwind CSS + shadcn/ui。

**替代方案：**
- Pages Router — 較舊，缺乏 Server Components 支援
- Vite + React — 需另外設定 API 層
- Remix — 生態系較小

**為什麼：** App Router 是 Next.js 的主推架構，API Routes 直接處理後端邏輯，部署至 Vercel 零設定。shadcn/ui 提供可客製的 UI 元件，不綁定特定設計系統。

### Decision 4: Supabase 作為資料庫

**選擇：** Supabase hosted PostgreSQL，沿用既有 schema（transactions、rentals、etl_log）。

**替代方案：**
- PlanetScale（MySQL）— 需要 schema 轉換
- Neon（PostgreSQL）— 可行但 Supabase 提供更完整的 dashboard
- 自建 PostgreSQL on VPS — 需維運

**為什麼：** Supabase 是 PostgreSQL，與既有 schema 100% 相容。免費方案足夠 MVP 使用。提供 connection pooling（PgBouncer）和 SQL editor 方便除錯。

### Decision 5: GitHub Actions 執行 ETL

**選擇：** 將既有 Python ETL scripts 放入 GitHub Actions workflow，cron 排程每月 2/12/22 號執行。

**替代方案：**
- Vercel Cron — Hobby 方案僅支援每日一次，且 serverless timeout 60s 不夠
- 獨立 VM + cron — 多一台機器要維護
- Supabase Edge Functions — 不適合長時間 Python 任務

**為什麼：** GitHub Actions 免費額度足夠（2000 min/月），timeout 6 小時綽綽有餘，可直接用 Python + psycopg2 連 Supabase。既有 ETL scripts 幾乎不需修改。

### Decision 6: API Route 架構

**選擇：** 單一 API route `/api/chat`，處理完整的查詢流程。

```
POST /api/chat
Body: { "message": "大安區兩房公寓均價" }

Response: {
  "reply": "大安區近一年兩房公寓平均單價為...",
  "metadata": { "sql": "SELECT ...", "rowCount": 127 }
}
```

流程：
1. Rate limit 檢查
2. 呼叫 Qwen Pass 1（text-to-SQL）
3. SQL Guard 驗證
4. 執行 SQL（Supabase, app_reader role, 10s timeout）
5. 錯誤處理（DB error → 友善訊息 / 空結果 → 查 etl_log）
6. 呼�� Qwen Pass 2（結果整理）
7. 回傳回覆

### Decision 7: Qwen API 整合方式

**選擇：** 透過 DashScope API（dashscope.aliyuncs.com）呼叫 Qwen 模型。

- Pass 1：`qwen-plus` — SQL 精準度優先
- Pass 2：`qwen-turbo` — 速度優先，成本較低

使用 OpenAI-compatible API format（Qwen 支援），方便未來切換模型。

## Risks / Trade-offs

**[Qwen API 穩定性]** → 加入 retry（最多 2 次）和 timeout（15s per call）。若 Qwen 完全不可用，回傳「系統暫時無法提供服務」。

**[Vercel Hobby 60s timeout]** → 兩次 Qwen 呼叫 + 一次 DB query 通常 5-15 秒。若 Qwen 回應慢，可能接近限制。Pass 1 和 Pass 2 各設 15s timeout，DB 10s，總計最壞情況 40s，仍在限制內。

**[SQL 精準度]** → Few-shot examples 覆蓋常見查詢模式。但邊緣案例（如跨區域比較、時間序列分析）可能生成不精確的 SQL。靠 SQL Guard 和 read-only role 確保安全，靠 error handling 確保使用體驗不崩壞。

**[Supabase 免費方案限制]** → 500MB 儲存。台灣實價登錄每季約數萬筆，估計數年資料約 200-300MB，暫時足夠。需監控用量。

**[Rate limiting 精準度]** → In-memory rate limiter 在 serverless 環境中每個 instance 獨立計數，可能不精確。接受這個限制作為 MVP；若需精確控制可升級至 Vercel KV。

**[GitHub Actions cron 精度]** → GitHub Actions 的 cron 可能延遲 5-15 分鐘，對月度 ETL 無影響。

## Open Questions

- Qwen API 免費額度的具體限制（每日/每月呼叫次數）需確認
- Supabase connection pooling 的 concurrent connection 限制（免費方案）需確認
