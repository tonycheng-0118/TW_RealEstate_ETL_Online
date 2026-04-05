# 台灣實價登錄 AI 查詢系統

[![CI](https://github.com/tonycheng-0118/TW_RealEstate_ETL_Online/actions/workflows/ci.yml/badge.svg)](https://github.com/tonycheng-0118/TW_RealEstate_ETL_Online/actions/workflows/ci.yml)
[![Deploy](https://img.shields.io/badge/demo-tw--realestate--query.vercel.app-blue)](https://tw-realestate-query.vercel.app)

用自然語言查詢台灣不動產實價登錄資料。輸入「大安區近一年兩房公寓均價」，AI 幫你查。

**線上體驗：https://tw-realestate-query.vercel.app**

## 架構

```
┌────────────────────────────────────────────────────────┐
│                       使用者                           │
│                 「大安區兩房公寓均價」                  │
└───────────────────────┬────────────────────────────────┘
                        │
                        ▼
┌─────────────────── Vercel ────────────────────────────┐
│                                                       │
│  ┌──────────┐   POST /api/chat   ┌───────────────┐   │
│  │ ChatBox  │ ─────────────────▶ │  API Route    │   │
│  │ (React)  │                    │               │   │
│  │ shadcn/  │ ◀───────────────── │ 1. Rate Limit │   │
│  │ Tailwind │   JSON response    │ 2. LLM Pass1  │   │
│  └──────────┘                    │ 3. SQL Guard  │   │
│                                  │ 4. DB Query   │   │
│                                  │ 5. LLM Pass2  │   │
│                                  └──────┬────────┘   │
└─────────────────────────────────────────┼────────────┘
                   │                      │
         ┌────────┘                       │
         ▼                                ▼
┌─────────────────┐          ┌─────────────────────┐
│    LLM API      │          │     Supabase        │
│  (HF Inference) │          │    (PostgreSQL)     │
│                 │          │                     │
│  Pass 1: SQL    │          │  ┌───────────────┐  │
│  Pass 2: 回覆   │          │  │ transactions  │  │
└─────────────────┘          │  │ rentals       │  │
                             │  │ etl_log       │  │
                             │  └───────────────┘  │
                             │         ▲           │
                             └─────────┼───────────┘
                                       │
                             ┌─────────┴───────────┐
                             │  GitHub Actions      │
                             │  ETL (每月 3 次)     │
                             │                     │
                             │  Download → Transform│
                             │  → Load (UPSERT)    │
                             └─────────────────────┘
```

## 功能

- **AI 自然語言查詢** — 不需要會 SQL，用中文問就好
- **常用查詢快捷鍵** — 一鍵查詢熱門行情
- **自動更新資料** — 每月 3 次自動從內政部匯入最新資料
- **安全防護** — SQL 白名單 + Read-only DB + Rate Limiting

## 技術棧

| 層級 | 技術 |
|------|------|
| 前端 | Next.js (App Router) · TypeScript · Tailwind CSS · shadcn/ui |
| AI | Qwen API (qwen-plus + qwen-turbo) |
| 資料庫 | Supabase (PostgreSQL) |
| ETL | Python · GitHub Actions |
| 部署 | Vercel Hobby |

## 本地開發

### 前置需求

- Node.js 18+
- npm 或 pnpm
- Supabase 帳號 + 專案
- Qwen API Key ([DashScope](https://dashscope.console.aliyun.com/))

### 啟動

```bash
# 1. Clone
git clone https://github.com/tonycheng-0118/TW_RealEstate_ETL_Online.git
cd TW_RealEstate_ETL_Online

# 2. 安裝依賴
npm install

# 3. 設定環境變數
cp .env.example .env.local
# 編輯 .env.local，填入：
#   SUPABASE_DB_URL=postgresql://...
#   QWEN_API_KEY=sk-...

# 4. 啟動開發伺服器
npm run dev
# → http://localhost:3000
```

## 環境變數

| 變數 | 說明 |
|------|------|
| `SUPABASE_DB_URL` | Supabase PostgreSQL 連線字串（app_reader role，僅 SELECT） |
| `SUPABASE_ETL_DB_URL` | Supabase PostgreSQL 連線字串（etl_writer role，GitHub Actions 用） |
| `QWEN_API_KEY` | DashScope / Qwen API 金鑰 |

## ETL 資料更新

資料來自[內政部實價登錄](https://plvr.land.moi.gov.tw/)，透過 GitHub Actions 自動排程：

- **頻率**：每月 2 號、12 號、22 號（UTC+8 03:00）
- **流程**：下載 ZIP → 解壓 CSV → 轉換（編碼 / 日期 / 欄位映射）→ UPSERT 至 Supabase
- **手動觸發**：GitHub repo → Actions → ETL → Run workflow

ETL 腳本沿用自 [TW_RealEstate_ETL](https://github.com/tonycheng-0118/TW_RealEstate_ETL)。

## 資料庫 Schema

| 資料表 | 說明 | 筆數量級 |
|--------|------|----------|
| `transactions` | 買賣 + 預售屋成交紀錄 | 數十萬筆 |
| `rentals` | 租賃成交紀錄 | 數十萬筆 |
| `etl_log` | ETL 匯入紀錄 | 數百筆 |

主要欄位：district（行政區）、address（地址）、building_type（建物型態）、rooms/halls/bathrooms（格局）、total_price/unit_price（總價/單價）、transaction_date_ad（成交日期）等。

## 安全機制

| 層級 | 措施 |
|------|------|
| 應用層 | SQL 白名單（僅 SELECT，拒絕危險關鍵字和分號） |
| 資料庫層 | read-only role `app_reader`（僅 SELECT 權限） |
| 效能 | Query timeout 10 秒 |
| 流量 | Rate limiting 10 req/min/IP |

## TODO

- [x] **單位換算錯誤**：Pass 2 prompt 已加入明確換算公式和範例
- [x] **面積單位不明確**：Pass 2 prompt 已強制標示 m² 和坪
- [x] **AI 回覆過於冗長**：Pass 2 prompt 已精簡（禁止重複問題、推理過程，300 字限制）
- [x] **時間範圍不夠彈性**：新增 expandTimeRange retry 邏輯，空結果自動擴大時間範圍重查

## 授權

MIT
