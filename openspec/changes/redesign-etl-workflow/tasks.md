## 1. Season 工具模組

- [x] 1.1 建立 `etl/scripts/season_utils.py`：get_current_season(), validate_season(), compare_seasons(), resolve_params()
- [x] 1.2 在 resolve_params() 實作完整的 16 種 start×end 組合解析和驗證

## 2. 廢掉 'current' 標記

- [x] 2.1 修改 `run_etl.py`：current mode 改用 get_current_season() 算出季度號作為 source_season
- [x] 2.2 修改 `run_etl.py` main()：用 resolve_params() 取代舊的 argparse 邏輯，支援 --start/--end

## 3. delete.py 支援 range

- [x] 3.1 修改 `delete.py`：新增 --start/--end 參數，用 season_range 逐季刪除，partial failure accepted

## 4. Workflow 重寫

- [x] 4.1 重寫 `etl.yml`：mode 改為 import/delete，inputs 改為 start_season/end_season/city
- [x] 4.2 在 Run step 用 shell 傳遞 --start/--end flags，Python 端做驗證和解析

## 5. 收尾

- [ ] 5.1 更新 README 的 ETL 操作說明
- [ ] 5.2 本地驗證 + commit + push
- [ ] 5.3 手動觸發 workflow 驗證 import 和 delete 正常
