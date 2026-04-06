## 1. Core — format-result module

- [x] 1.1 Create `app/lib/format-result.ts` with `formatResultRows()` function: scan column names and aliases, append converted fields (`_ping`, `_wan`, `_wan_ping`) per spec rules
- [x] 1.2 Handle edge cases: null, 0, negative values → converted field = null; building_area=0 with unit_price>0 → append `_note`
- [x] 1.3 Handle aggregate alias detection: keyword match for「面積」「總價」「房價」「單價」「租金」「月租」in column names
- [x] 1.4 Ensure rent fields (`total_rent`, aliases with「租金」「月租」) are NOT converted to 萬; `unit_rent` → `_ping` (元/坪, not 萬/坪)

## 2. Prompt update

- [x] 2.1 Update `PASS2_SYSTEM_PROMPT` in `app/lib/prompts.ts`: remove manual conversion rules, add instructions to use pre-computed `_ping`/`_wan`/`_wan_ping` fields directly, and handle `_note` annotations

## 3. Integration

- [x] 3.1 Update `app/api/chat/route.ts`: import `formatResultRows`, call it on `queryResult.rows` before JSON.stringify for Pass 2

## 4. Testing

- [x] 4.1 Add unit tests for `formatResultRows` in `app/lib/__tests__/format-result.test.ts`: cover area conversion, price conversion, unit price conversion, rent exclusion, null/zero edge cases, aggregate alias detection, zero-area annotation

## 5. Verification

- [x] 5.1 Run `npm run lint && npm run typecheck && npm run build` — all pass
- [x] 5.2 Run `npm test` — all tests pass
