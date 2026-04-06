## 1. Delete 腳本

- [x] 1.1 建立 `etl/scripts/delete.py`：接收 `--season` 和可選 `--city` 參數，DELETE 對應的 transactions、rentals、etl_log 資料
- [x] 1.2 使用 `config.DATABASE_URL` 連線（與 load.py 相同模式）
- [x] 1.3 執行前印出將刪除的筆數（dry-run 風格的 log），然後執行 DELETE

## 2. Workflow 擴充

- [x] 2.1 修改 `etl.yml` 的 workflow_dispatch inputs：新增 `range` 和 `delete` mode、`from_season`、`to_season` 欄位
- [x] 2.2 修改 Run ETL step：根據 mode 分支執行 current/season/range/delete 對應指令
- [x] 2.3 確保 cron 排程只觸發 current mode（不受新 mode 影響）

## 3. 驗證

- [ ] 3.1 本地測試 delete.py：確認能正確刪除指定季度資料（可用 Supabase SQL Editor 驗證）
- [ ] 3.2 Commit + push，手動觸發 range mode（from=113S1, to=113S2, city=A）驗證 workflow 正常
