## Why

既有的台灣實價登錄 ETL 系統（TW_RealEstate_ETL）僅能在本地執行，查詢需透過 Claude Skill 或直接操作 PostgreSQL。我們要將這套系統搬上線，讓任何人都能透過網頁的 AI ChatBox 用自然語言查詢實價登錄資料，無需安裝任何工具。

## What Changes

- 新建 Next.js（App Router）全端應用，部署於 Vercel Hobby
- 資料庫從本地 PostgreSQL 遷移至 Supabase（hosted PostgreSQL），沿用既有 schema（transactions、rentals、etl_log）
- 新增 AI Coordinator：整合 Qwen API 實現 two-pass 自然語言查詢（Pass 1: qwen-plus text-to-SQL、Pass 2: qwen-turbo 整理回覆）
- 新增 SQL Guard 安全層：白名單檢查、read-only DB role、query timeout、rate limiting
- ETL 排程從 macOS LaunchAgent 遷移至 GitHub Actions（每月 2/12/22 號自動執行）
- 前端提供 ChatBox UI（純文字）與常用查詢快捷按鈕

## Capabilities

### New Capabilities
- `ai-query`: AI 自然語言查詢介面 — 使用者輸入自然語言，系統透過 Qwen API 轉換為 SQL 查詢 Supabase，並以繁體中文回覆結果
- `chatbox-ui`: 前端 ChatBox 元件 — React 聊天介面，含訊息輸入、回覆顯示、常用查詢快捷按鈕
- `sql-guard`: SQL 安全防護層 — 白名單檢查（僅允許 SELECT）、query timeout、rate limiting，防止注入與濫用
- `cloud-etl`: 雲端 ETL 排程 — GitHub Actions 定期從內政部下載實價登錄資料，轉換後匯入 Supabase

### Modified Capabilities
<!-- 全新專案，無既有 spec 需修改 -->

## Impact

- **新增程式碼**：Next.js 應用（前端 + API routes）、GitHub Actions workflow
- **外部服務依賴**：Supabase（PostgreSQL）、Qwen API（dashscope.aliyuncs.com）、Vercel（部署）、GitHub Actions（ETL 排程）
- **資料庫**：沿用既有 schema，新增 read-only role 供 API 查詢使用
- **環境變數**：Supabase connection string、Qwen API key、相關設定需在 Vercel 與 GitHub Actions 中配置
