## 1. Pass 2 Prompt 修改

- [x] 1.1 修改 PASS2_SYSTEM_PROMPT：明確化價格換算規則（萬元/億元公式 + 範例）
- [x] 1.2 修改 PASS2_SYSTEM_PROMPT：強制面積標示雙單位（m² + 坪）
- [x] 1.3 修改 PASS2_SYSTEM_PROMPT：精簡回覆風格（禁止重複問題、推理過程，300 字限制）

## 2. Pass 1 Prompt 修改

- [x] 2.1 修改 PASS1_SYSTEM_PROMPT：改善模糊時間詞處理（「本月」「本週」改用較寬範圍）

## 3. 空結果 Retry 邏輯

- [x] 3.1 在 route.ts 實作 `expandTimeRange(sql)` 函式：偵測並替換 SQL 中的短時間 INTERVAL
- [x] 3.2 在空結果處理段加入 retry：若 SQL 包含可擴展的時間條件，替換後重新查詢一次

## 4. 收尾

- [x] 4.1 更新 README TODO（勾選已完成項目）
- [x] 4.2 本地測試：確認價格單位、面積單位、回覆風格、時間範圍 retry 都正常
- [ ] 4.3 Commit + push
