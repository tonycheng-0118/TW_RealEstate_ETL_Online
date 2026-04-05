## Context

專案目前沒有任何自動化品質檢查。ESLint 和 TypeScript 已在 devDependencies 中，但沒有 CI 流程確保每次變更都通過檢查。也沒有測試框架和測試案例。

現有的 GitHub Actions workflow 只有 ETL 排程（`etl.yml`），CI 是獨立的 workflow。

## Goals / Non-Goals

**Goals:**
- 每次 push 和 PR 自動執行 lint、type check、build、test
- 為核心模組（SQL Guard、Rate Limiter、LLM client）建立測試
- CI 失敗時阻止 merge（GitHub branch protection，可選）

**Non-Goals:**
- E2E 測試（需要真實 DB 和 LLM API，不適合 CI）
- Code coverage 門檻（MVP 階段不強制）
- 部署相關的 CD（Vercel 已處理）

## Decisions

### Decision 1: Test Framework — Vitest

**選擇：** Vitest

**替代方案：**
- Jest — 需要額外設定才能支援 ESM 和 TypeScript
- Node.js built-in test runner — 生態系太小

**為什麼：** Vitest 原生支援 TypeScript + ESM，設定極簡，與 Vite 生態相容，速度快。Next.js 社群普遍採用。

### Decision 2: 測試範圍 — 單元測試為主

**選擇：** 只測純函式模組，不測 API route 或 React 元件。

測試目標：
- `sql-guard.ts` — 白名單驗證邏輯（最重要，安全相關）
- `rate-limit.ts` — rate limiter 邏輯
- `qwen.ts` — `extractSql()` 和 `stripThinking()` 工具函式

**為什麼：** 這些是純函式，不依賴外部服務，測試快且穩定。API route 和 React 元件需要 mock 太多東西，投資報酬率低。

### Decision 3: CI Workflow 結構

**選擇：** 單一 workflow，4 個 step 順序執行。

```yaml
on: [push, pull_request]

steps:
  1. npm ci
  2. npm run lint
  3. npm run typecheck (tsc --noEmit)
  4. npm run build
  5. npm run test
```

**為什麼：** 順序執行確保前一步失敗就停止（fail fast）。不需要 matrix 或 parallel jobs，專案體量小，單一 job 就夠快。

## Risks / Trade-offs

**[CI 時間]** → 預估 1-2 分鐘（npm ci ~20s, lint ~5s, typecheck ~5s, build ~30s, test ~10s）。在 GitHub Actions 免費額度內。

**[Vitest 與 Next.js 相容性]** → Vitest 不走 Next.js 的 build pipeline，但我們只測純函式，不涉及 Next.js 特有功能（Server Components 等），沒有相容性問題。

**[測試維護成本]** → 只測穩定的核心邏輯，不測頻繁變動的 UI，降低維護負擔。
