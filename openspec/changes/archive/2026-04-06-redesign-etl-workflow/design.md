## Context

原本 workflow 有 4 種 mode + 5 個參數 + `current` 特殊標記。重新設計為 2 mode + 3 參數，廢掉 `current` 標記改用實際季度號。

舊設計：
```
mode: current | season | range | delete
season, from_season, to_season, city
source_season 可能 = 'current'（無時間資訊，多次 ETL 混在一起）
```

新設計：
```
mode: import | delete
start_season, end_season, city
source_season 永遠 = 實際季度號（如 115S2）
```

## Goals / Non-Goals

**Goals:**
- 2 個 mode 涵蓋所有操作
- start/end season 統一處理單季、多季、current
- 廢掉 'current' 標記，改用實際季度號
- 完整的邊界驗證（16 種 start×end 組合）

**Non-Goals:**
- 修改 ETL 核心（download/transform/load）
- 修改 delete.py 的 SQL 邏輯（只加 range 支援）

## Decisions

### Decision 1: Workflow inputs

```yaml
inputs:
  mode:
    type: choice
    options: [import, delete]
    default: import
  start_season:
    description: "起始季度（如 113S1）。留空 = 當前季度"
  end_season:
    description: "結束季度（如 114S4）。留空 = 從 start 到當前季度"
  city:
    default: "all"
```

### Decision 2: 參數解析邏輯（Python helper）

新增一個 `season_utils.py` 提供：
- `get_current_season()` → 如 '115S2'（ROC year = AD - 1911, quarter = ceil(month/3)）
- `validate_season(s)` → 驗證格式 `{year}S{1-4}`
- `compare_seasons(a, b)` → -1/0/1
- `resolve_params(start, end)` → 解析後的 (start, end, is_current) tuple

解析邏輯：
```
start 空 + end 空           → (current, current, True)
start 空 + end=current      → (current, current, True)
start 空 + end=季度         → 報錯
start=current + end=空      → (current, current, True)
start=current + end=current → (current, current, True)
start=current + end=季度    → 報錯
start=季度 + end=空         → (start, current, False) — 展開到 current
start=季度 + end=current    → (start, current, False) — 同上
start=季度 + end=季度       → (start, end, False) — 驗證 start ≤ end
```

驗證：
- 格式不合法 → 報錯
- 季度超過 current → 報錯
- end < start → 報錯

### Decision 3: 廢掉 'current' source_season 標記

`run_etl.py` 的 `--current` flag 改為內部呼叫 `get_current_season()` 算出季度號，然後用該季度號作為 source_season。

**影響**：新灌的資料不再有 `source_season='current'`。舊資料裡已存在的 'current' 標記需要手動清理（或下次重灌時自然覆蓋）。

### Decision 4: delete.py 支援 range

新增 `--from` / `--to` 參數，import `parse_season_range` 產生季度清單，逐季刪除。失敗不中斷後續季度（跟 import 的 failure isolation 一致）。

### Decision 5: cron 排程不變

cron 觸發時 `mode` 預設 `import`，`start_season` 為空 → 算出 current season。行為與舊版一致，但 source_season 改為實際季度號。

## Risks / Trade-offs

**[Breaking change]** → 舊 mode 不再存在。`source_season='current'` 的舊資料需要清理或重灌。

**[季度計算精度]** → ceil(month/3) 在季度邊界（1月、4月、7月、10月）是正確的。政府資料公布可能有延遲（Q1 資料可能到 Q2 才公布），但我們標記的是「哪一季跑的 ETL」，不是「資料屬於哪一季」，所以用跑 ETL 的時間算即可。
