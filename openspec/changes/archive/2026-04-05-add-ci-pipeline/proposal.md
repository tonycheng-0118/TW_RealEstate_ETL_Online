## Why

目前專案沒有任何自動化品質檢查，程式碼錯誤只能在本地開發或 Vercel 部署時才發現。需要在 GitHub Actions 建立 CI pipeline，確保每次 push 和 PR 都通過 lint、type check、build 和測試，儘早攔截問題。

## What Changes

- 新增 GitHub Actions CI workflow（`.github/workflows/ci.yml`），在 push 和 PR 時自動觸發
- CI 執行四個步驟：ESLint → TypeScript type check → Next.js build → 測試
- 新增測試框架（Vitest）和測試案例，覆蓋核心模組：SQL Guard、Rate Limiter、Qwen client
- 新增 `npm run typecheck` 和 `npm run test` scripts

## Capabilities

### New Capabilities
- `ci-pipeline`: GitHub Actions CI workflow — 自動化 lint、type check、build、test，在 push 和 PR 時觸發

### Modified Capabilities
<!-- 無既有 spec 需修改，CI 是基礎設施層面的新增 -->

## Impact

- **新增檔案**：`.github/workflows/ci.yml`、`vitest.config.ts`、`app/lib/__tests__/` 目錄下的測試檔案
- **修改檔案**：`package.json`（新增 devDependencies 和 scripts）
- **外部服務**：GitHub Actions（使用既有免費額度，每次 CI 約 1-2 分鐘）
