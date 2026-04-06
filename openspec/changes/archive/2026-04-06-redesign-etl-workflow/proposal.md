## Why

目前 ETL workflow 有 4 種 mode（current/season/range/delete），加上不同的參數組合（season, from_season, to_season），使用起來不直覺，容易搞混。簡化為 2 種 mode + 統一的 start/end season 參數，降低認知負擔。

## What Changes

- 將 4 種 mode 簡化為 2 種：`import`（匯入）和 `delete`（刪除）
- 用 `start_season` / `end_season` 取代原本的 `season` / `from_season` / `to_season`
- 兩個參數都可選：不填 = current，超過目前季度 = current
- 單一季度 = start 和 end 填同一個值
- 修改 `etl.yml` workflow inputs
- 修改 `run_etl.py` 和 `delete.py` 的 CLI 參數以配合新設計
- cron 排程不變（自動跑 import current）

## Capabilities

### New Capabilities
<!-- 無 -->

### Modified Capabilities
- `cloud-etl`: 重新設計 workflow inputs 和 mode 結構

## Impact

- **修改檔案**：`.github/workflows/etl.yml`、`etl/scripts/run_etl.py`、`etl/scripts/delete.py`
- **Breaking change**：舊的 mode 選項（current/season/range）不再存在，改為 import + start/end
- 不影響 ETL 核心邏輯（download/transform/load 不變）
