## Context

目前 route.ts 第 209 行將 DB rows 直接 JSON.stringify 後丟給 Pass 2 LLM，由 LLM 負責所有數值換算（元→萬、m²→坪、單價換算）。但小模型做算術不可靠，導致坪數、單價等數字經常錯誤。

現有流程：
```
DB rows (元, m²) → JSON.stringify → Pass 2 LLM → 使用者看到的回覆
                                     ↑ 這裡做換算（不可靠）
```

## Goals / Non-Goals

**Goals:**
- 數值換算 100% 正確（坪數、萬元、萬/坪）
- 面積為零等邊界案例有適當標記
- Pass 2 LLM 只負責文字組織，不做任何數學

**Non-Goals:**
- 不修改 Pass 1 text-to-SQL 邏輯
- 不修改 DB schema 或 ETL
- 不改前端 UI
- 不處理 DB 資料品質問題（如政府原始資料缺漏）

## Decisions

### Decision 1: 新增 `app/lib/format-result.ts` 模組

在 DB query 結果和 Pass 2 之間插入純函式預處理層。

```
DB rows → formatResultRows(rows) → enriched rows → Pass 2 LLM
                ↑ 程式化換算（100% 正確）
```

**函式設計：**

```typescript
// 主函式：處理整個結果集
export function formatResultRows(rows: Record<string, unknown>[]): Record<string, unknown>[]

// 單筆處理邏輯（內部）
// 掃描每個 key，依照命名慣例自動附加換算欄位
```

**換算規則（以 column name 偵測）：**

| 原始欄位 pattern | 附加欄位 | 換算公式 |
|---|---|---|
| `*_area` (m²) | `{name}_ping` | `÷ 3.306`，四捨五入到小數 2 位 |
| `total_price`, `parking_price` (元) | `{name}_wan` | `÷ 10000`，四捨五入到小數 2 位 |
| `total_rent` (元) | 不換算 | 月租金保持元 |
| `unit_price` (元/m²) | `unit_price_wan_ping` | `× 3.306 ÷ 10000`，小數 2 位 |
| `unit_rent` (元/m²) | `unit_rent_ping` | `× 3.306`，小數 2 位（元/坪） |
| AVG/MIN/MAX/SUM 聚合欄位 | 同上規則 | 依內容值域判斷（見下方） |

**聚合欄位處理：** Pass 1 產生的 SQL 常用中文 alias（如 `平均單價`、`最高總價`、`平均面積`），需用 keyword matching 偵測：
- alias 含「面積」→ 視為面積欄位
- alias 含「總價」「房價」→ 視為價格欄位
- alias 含「單價」→ 視為單價欄位
- alias 含「租金」→ 不換算

**邊界案例：**
- 值為 `null`、`0`、負數 → 附加欄位也設為 `null`
- 面積為 0 但 unit_price > 0 → 附加 `_note: "僅土地交易，無建物面積"` 提示

**替代方案考量：**
- ~~在 Pass 1 SQL 裡用 SQL expression 換算~~ → 會讓 prompt 更複雜，增加 LLM 產生錯誤 SQL 的機率
- ~~在前端換算~~ → 前端目前只顯示 LLM 文字回覆，沒有結構化資料可換算

### Decision 2: 更新 Pass 2 prompt

修改 `PASS2_SYSTEM_PROMPT`，核心變更：

1. **刪除**現有的「價格換算規則」和「面積換算規則」兩大段
2. **新增**指示：「所有數值已預先換算完成，欄位名稱帶 `_ping` 表示坪、`_wan` 表示萬元、`_wan_ping` 表示萬元/坪。直接使用這些數值，禁止自行計算。」
3. **新增**呈現規則：面積同時顯示 m² 和坪（從 `building_area` 和 `building_area_ping` 取值），價格用萬元或億元
4. **保留**回覆風格規則（300字、不重複問題等）

**替代方案考量：**
- ~~保留換算規則但加 "double check" 指示~~ → LLM 仍會算錯，治標不治本
- ~~完全移除 Pass 2，用 template engine~~ → 失去自然語言組織能力，回覆品質大幅下降

### Decision 3: route.ts 整合方式

在 route.ts 第 209 行（`const rowsFormatted = JSON.stringify(...)`）之前插入一行：

```typescript
const enrichedRows = formatResultRows(queryResult.rows.slice(0, 100));
const rowsFormatted = JSON.stringify(enrichedRows);
```

最小化對既有流程的侵入。

**替代方案考量：**
- ~~middleware 模式~~ → 過度工程，這是單一插入點
- ~~在 db.ts 的 executeQuery 裡做~~ → 違反單一職責，db 層不應知道顯示邏輯

## Risks / Trade-offs

- **[Risk] 聚合欄位的 keyword matching 不完整** → 用保守策略：未匹配到的欄位不換算，寧可少換不要換錯。隨時間觀察 log 補充 keyword。
- **[Risk] enriched rows JSON 變大，可能影響 Pass 2 token 用量** → 實測 100 筆資料增加約 30-40% token，仍在可接受範圍。且欄位名稱比數值本身佔的 token 少。
- **[Trade-off] 硬編碼的欄位名稱偵測** → 簡單但脆弱，若未來改 DB schema 需同步更新。但 schema 極少變動，可接受。
