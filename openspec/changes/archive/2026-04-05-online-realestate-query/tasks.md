## 1. Supabase 設定

- [x] 1.1 建立 Supabase 專案（到 supabase.com 建立新專案，記錄 Project URL 和 anon key）
- [x] 1.2 在 Supabase SQL Editor 中執行 schema DDL（建立 transactions、rentals、etl_log 表，含 indexes 和 triggers，沿用 TW_RealEstate_ETL 的 sql/schema.sql）
- [x] 1.3 建立 read-only role `app_reader`（僅 SELECT 權限於 transactions、rentals、etl_log）
- [x] 1.4 建立 ETL 寫入用 role `etl_writer`（INSERT、UPDATE 權限）
- [x] 1.5 記錄 Supabase PostgreSQL connection string（Settings > Database > Connection string）

## 2. GitHub Repository 與 Next.js 初始化

- [x] 2.1 在 GitHub 建立 TW_RealEstate_ETL_Online repository
- [x] 2.2 用 `npx create-next-app@latest` 初始化 Next.js 專案（App Router、TypeScript、Tailwind CSS、ESLint）
- [x] 2.3 安裝 shadcn/ui（`npx shadcn@latest init`）並加入所需元件（Button、Input、Card、ScrollArea）
- [x] 2.4 建立 `.env.local` 並設定環境變數（SUPABASE_DB_URL、QWEN_API_KEY、NEXT_PUBLIC_SITE_URL）
- [x] 2.5 建立 `.env.example` 作為環境變數範本（不含實際密鑰）

## 3. 核心 API — AI Query Route

- [x] 3.1 建立 `/app/api/chat/route.ts`，實作 POST handler 骨架（接收 message，回傳 reply）
- [x] 3.2 實作 Rate Limiter（in-memory Map，10 req/min/IP，回傳 429）
- [x] 3.3 實作 Qwen API client（OpenAI-compatible format，支援 qwen-plus 和 qwen-turbo）
- [x] 3.4 撰寫 Pass 1 system prompt（角色定義 + DDL + 欄位註解 + 至少 5 組 few-shot examples）
- [x] 3.5 實作 Pass 1 呼叫邏輯（送出 system prompt + user message 給 qwen-plus，解析回傳 SQL）
- [x] 3.6 實作 SQL Guard（正規表達式白名單：僅允許 SELECT、拒絕危險關鍵字、拒絕分號）
- [x] 3.7 實作 Supabase query executor（使用 app_reader role 連線，設定 statement_timeout 10s）
- [x] 3.8 實作錯誤處理邏輯（DB 報錯 → 友善訊息 + 常用查詢建議；空結果 → 查 etl_log → 回覆查無資料）
- [x] 3.9 實作 Pass 2 呼叫邏輯（送出 SQL 結果 + 原始問題給 qwen-turbo，取回格式化回覆）
- [x] 3.10 組裝完整 API route 流程（Rate limit → Pass 1 → SQL Guard → Execute → Error handling → Pass 2 → Response）

## 4. 前端 — ChatBox UI

- [x] 4.1 建立 ChatBox 元件（`/app/components/ChatBox.tsx`）：訊息列表、輸入欄、送出按鈕
- [x] 4.2 實作訊息狀態管理（useState：messages array，含 role 和 content）
- [x] 4.3 實作 API 呼叫（fetch POST /api/chat，處理 loading 和 error 狀態）
- [x] 4.4 實作常用查詢快捷按鈕（至少 4 個預設查詢：如「台北市本月成交行情」「新北市三房大樓均價」等）
- [x] 4.5 實作載入中狀態（送出後 disable input、顯示 loading 動畫）
- [x] 4.6 實作歡迎訊息（初始載入顯示歡迎文字 + 快捷按鈕）
- [x] 4.7 整合 ChatBox 到 `/app/page.tsx` 主頁面，含頁面標題和說明

## 5. ETL 上雲 — GitHub Actions

- [x] 5.1 將既有 ETL Python scripts（download.py、transform.py、load.py、run_etl.py、config.py）複製到 `etl/` 目錄
- [x] 5.2 修改 config.py，改為從環境變數讀取 Supabase connection string（移除本地 config.json 依賴）
- [x] 5.3 建立 `requirements.txt`（pandas、psycopg2-binary、requests、python-dotenv、chardet）
- [x] 5.4 建立 `.github/workflows/etl.yml`（cron: 每月 2/12/22 號 UTC 19:00 = UTC+8 03:00，Python 3.12，pip install，執行 run_etl.py --current）
- [x] 5.5 在 GitHub repo Settings > Secrets 中設定 SUPABASE_ETL_DB_URL
- [x] 5.6 手動觸發一次 ETL workflow 驗證連線和匯入是否正常

## 6. Vercel 部署

- [x] 6.1 在 Vercel 連結 GitHub repo（Import Project，選擇 Next.js framework）
- [x] 6.2 在 Vercel 設定環境變數（SUPABASE_DB_URL、LLM_API_KEY、LLM_API_URL、LLM_MODEL_PASS1/PASS2）
- [x] 6.3 確認首次部署成功，前端頁面可正常載入
- [x] 6.4 端對端測試：在部署後的網站上輸入查詢，確認完整 AI 查詢流程正常運作

## 7. 收尾與測試

- [x] 7.1 撰寫 README.md（專案說明、架構圖、本地開發指引、環境變數清單）
- [x] 7.2 全面測試常用查詢場景（至少 10 種不同的自然語言查詢）
- [x] 7.3 測試錯誤處理場景（複雜查詢導致 SQL 錯誤、查無資料、rate limit 超過）
- [x] 7.4 測試 SQL Guard（嘗試各種 injection 攻擊模式，確認全部被擋下）
