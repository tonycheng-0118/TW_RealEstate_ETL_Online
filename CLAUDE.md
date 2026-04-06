# TW_RealEstate_ETL_Online

## 專案概述

台灣實價登錄 AI 自然語言查詢系統。使用者透過 ChatBox 輸入自然語言，系統經 Qwen API 轉換為 SQL 查詢 Supabase，回傳繁體中文結果。

## 技術棧

| 層級 | 技術 |
|------|------|
| Frontend | Next.js (App Router) + TypeScript + Tailwind CSS + shadcn/ui |
| API | Next.js API Routes (`/api/chat`) |
| AI | Qwen API — Pass 1: `qwen-plus` (text-to-SQL), Pass 2: `qwen-turbo` (回覆整理) |
| Database | Supabase (PostgreSQL) — tables: `transactions`, `rentals`, `etl_log` |
| ETL | Python scripts via GitHub Actions (cron: 每月 2/12/22 號) |
| Hosting | Vercel Hobby |

## 專案結構

```
TW_RealEstate_ETL_Online/
├── app/                    # Next.js App Router
│   ├── api/chat/           # AI query API route
│   │   └── route.ts
│   ├── components/         # React 元件
│   │   └── ChatBox.tsx
│   ├── lib/                # 共用模組
│   │   ├── qwen.ts         # Qwen API client
│   │   ├── sql-guard.ts    # SQL 安全檢查
│   │   ├── supabase.ts     # DB query executor
│   │   └── rate-limit.ts   # Rate limiter
│   ├── layout.tsx
│   └── page.tsx
├── etl/                    # Python ETL scripts (GitHub Actions 用)
│   ├── scripts/
│   │   ├── download.py
│   │   ├── transform.py
│   │   ├── load.py
│   │   └── run_etl.py
│   ├── config.py
│   └── requirements.txt
├── .github/workflows/
│   └── etl.yml             # ETL cron workflow
├── openspec/               # OpenSpec 規格與設計文件
└── .env.local              # 環境變數 (不進 git)
```

## 環境變數

| 變數 | 用途 | 使用位置 |
|------|------|----------|
| `SUPABASE_DB_URL` | PostgreSQL connection string (app_reader role) | Vercel API Routes |
| `SUPABASE_ETL_DB_URL` | PostgreSQL connection string (etl_writer role) | GitHub Actions ETL |
| `QWEN_API_KEY` | Qwen / DashScope API key | Vercel API Routes |

## 開發指引

### 本地啟動

```bash
npm install
cp .env.example .env.local   # 填入實際環境變數
npm run dev                   # http://localhost:3000
```

### API 流程

```
POST /api/chat { "message": "..." }
  → Rate Limit 檢查 (10 req/min/IP)
  → Qwen Pass 1: text-to-SQL (qwen-plus)
  → SQL Guard: 白名單驗證
  → Supabase: 執行 SQL (app_reader, timeout 10s)
  → 錯誤處理 (DB error / 空結果)
  → Qwen Pass 2: 整理回覆 (qwen-turbo)
  → Response { "reply": "...", "metadata": {...} }
```

### 安全機制

1. SQL 白名單：僅允許 `SELECT`，拒絕 `DROP/ALTER/INSERT/UPDATE/DELETE/TRUNCATE`，拒絕分號
2. DB read-only role：`app_reader` 僅有 SELECT 權限
3. Query timeout：10 秒
4. Rate limiting：10 req/min/IP

### ETL

既有 ETL scripts 來自 [TW_RealEstate_ETL](https://github.com/tonycheng-0118/TW_RealEstate_ETL)，透過 GitHub Actions 自動排程執行。手動觸發：GitHub repo → Actions → ETL workflow → Run workflow。

## OpenSpec（必須遵守）

**本 repo 的所有功能新增、修改、修復都必須嚴格遵守 OpenSpec 流程。不允許跳過 OpenSpec 直接寫 code。**

### 流程

1. **探索**（可選）：`/openspec-explore` — 不確定要做什麼時先聊
2. **提案**：`/openspec-propose` 或 `/openspec-new-change` — 建立 change + artifacts（proposal → specs → design → tasks）
3. **實作**：`/openspec-apply-change` — 按 tasks 逐一實作，每完成一項勾選
4. **驗證**：`/openspec-verify-change` — 對比 specs/design 確認實作正確
5. **同步**：`/openspec-sync-specs` — 將 delta specs 合併到 main specs
6. **歸檔**：`/openspec-archive-change` — 歸檔完成的 change

### 規則

- **禁止**未經 OpenSpec 流程直接修改功能性程式碼
- 純文件修改（README、CLAUDE.md）、git 設定、環境變數等非功能性變更可以不走 OpenSpec
- 每個 change 的 artifacts 存放在 `openspec/changes/<name>/`
- 歸檔後的 change 在 `openspec/changes/archive/`
- Main specs 在 `openspec/specs/`，代表系統目前的規格
- 執行 `openspec status` 查看目前進度
- 執行 `openspec list` 查看所有 active changes

## 相關資源

- 既有 ETL 系統: https://github.com/tonycheng-0118/TW_RealEstate_ETL
- 資料來源: https://plvr.land.moi.gov.tw (內政部實價登錄)
- Qwen API: https://help.aliyun.com/zh/dashscope/
- Supabase: https://supabase.com
