## Why

目前 ETL workflow 只支援 `current`（最新一期）和 `season`（單一季度），無法一次灌入多季歷史資料，也無法刪除不需要的季度資料。需要擴充 workflow 支援區間匯入和資料刪除。

## What Changes

- 在 GitHub Actions workflow 新增 `range` mode：指定起迄季度（如 `113S1` ~ `114S4`），一次執行多季 ETL
- 在 GitHub Actions workflow 新增 `delete` mode：刪除指定季度和城市的資料（transactions + rentals + etl_log）
- 修改 `run_etl.py` 支援 `--from`/`--to` 參數的 range 模式（既有程式碼已有 `parse_season_range`）
- 新增 `delete.py` 腳本，執行指定季度/城市的 DELETE 操作

## Capabilities

### New Capabilities
<!-- 無，這是對既有 cloud-etl capability 的擴充 -->

### Modified Capabilities
- `cloud-etl`: 新增 range mode（區間匯入）和 delete mode（資料刪除）

## Impact

- **修改檔案**：`.github/workflows/etl.yml`（新增 range/delete mode 選項）、`etl/scripts/run_etl.py`（已支援 --from/--to，可能需微調）
- **新增檔��**：`etl/scripts/delete.py`（DELETE 操作）
- **風險**：delete mode 是破壞性操作，需加確認機制（workflow 層面限制，不開放排程自動觸發）
