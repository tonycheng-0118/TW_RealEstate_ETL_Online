## 1. Test Framework 設定

- [x] 1.1 安裝 Vitest（`npm install -D vitest`）
- [x] 1.2 建立 `vitest.config.ts`（設定 test include pattern、path alias）
- [x] 1.3 在 `package.json` 新增 `"test": "vitest run"` 和 `"typecheck": "tsc --noEmit"` scripts

## 2. 撰寫單元測試

- [x] 2.1 建立 `app/lib/__tests__/sql-guard.test.ts` — 測試 SQL 白名單驗證（合法 SELECT 通過、DROP/INSERT/分號/註解被擋）
- [x] 2.2 建立 `app/lib/__tests__/rate-limit.test.ts` — 測試 rate limiter（限額內通過、超過限額被擋、window 過期重置）
- [x] 2.3 建立 `app/lib/__tests__/qwen.test.ts` — 測試 `extractSql()`（去除 code block wrapper）和 `stripThinking()`（去除 think tags）

## 3. CI Workflow

- [x] 3.1 建立 `.github/workflows/ci.yml`（on: push + pull_request，ubuntu-latest，Node.js 22）
- [x] 3.2 Steps: checkout → setup Node → npm ci → lint → typecheck → build → test
- [x] 3.3 本地驗證：手動跑 `npm run lint && npm run typecheck && npm run build && npm run test` 全部通過

## 4. 驗證

- [x] 4.1 Push 並確認 GitHub Actions CI workflow 自動觸發且全部通過
