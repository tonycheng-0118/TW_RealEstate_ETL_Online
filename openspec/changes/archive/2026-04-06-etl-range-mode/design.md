## Context

目前 ETL workflow 有兩種模式：`current`（最新一期）和 `season`（單一季度）。`run_etl.py` 已內建 `--from`/`--to` 參數和 `parse_season_range()` 函式，但 GitHub Actions workflow 沒有暴露這個功能。另外沒有任何資料刪除機制。

## Goals / Non-Goals

**Goals:**
- 在 workflow 中暴露 range mode，讓使用者可以一次灌多季歷史資料
- 新增 delete mode，可以刪除指定季度/城市的資料
- delete mode 僅限手動觸發，不允許排程自動執行

**Non-Goals:**
- 修改 ETL 核心邏輯（download/transform/load）
- 自動判斷該灌哪些歷史資料

## Decisions

### Decision 1: Range mode — 直接用既有的 `--from`/`--to`

`run_etl.py` 已經支援 `--from 113S1 --to 114S4`，只需要在 `etl.yml` 的 workflow_dispatch inputs 新增 `from_season` 和 `to_season` 欄位，然後在 Run step 中傳遞給 script。

**替代方案：** 新寫一個 range 專用腳本 → 不需要，既有 code 已經做好了。

### Decision 2: Delete mode — 新增 `delete.py` 腳本

新增一個獨立的 `etl/scripts/delete.py`，接收 `--season` 和可選的 `--city` 參數，執行：
1. `DELETE FROM transactions WHERE source_season = ? [AND city_code = ?]`
2. `DELETE FROM rentals WHERE source_season = ? [AND city_code = ?]`
3. `DELETE FROM etl_log WHERE season = ? [AND file_name LIKE ?]`

**為什麼獨立腳本：** 刪除是破壞性操作，不應該混在 ETL 主流程裡。獨立腳本更安全，也方便在 workflow 中設為獨立的 mode。

### Decision 3: Workflow mode 選項擴充

```yaml
inputs:
  mode:
    type: choice
    options:
      - current    # 既有：抓最新一期
      - season     # 既有：指定單一季度
      - range      # 新增：指定起迄季度
      - delete     # 新增：刪除指定季度資料
  season:          # season mode 用
  from_season:     # range mode 用
  to_season:       # range mode 用
  city:            # 所有 mode 共用
```

**替代方案：** 把 range 和 delete 拆成獨立的 workflow → 太分散，一個 workflow 管全部比較好管理。

## Risks / Trade-offs

**[Delete 誤刪]** → workflow_dispatch 需要使用者手動選擇 mode=delete 並填入季度，不會被 cron 觸發。GitHub Actions UI 會顯示參數讓使用者確認。

**[Range mode 執行時間]** → 20 季的 range（5 年）可能跑 30-60 分鐘。GitHub Actions timeout 設為 120 分鐘，足夠。但 Supabase 免費方案 500MB 可能不夠放 5 年資料。

**[下載限速]** → 內政部網站有 rate limiting，既有的 `DOWNLOAD_DELAY_SEC = 10` 秒間隔應該足夠。20 季 × 10 秒 = 額外 ~3 分鐘等待。
