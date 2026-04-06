## Context

上游 TW_RealEstate_ETL repo 已修復這兩個 bug（commit 0663f8d）。直接同步修改到本 repo。

## Goals / Non-Goals

**Goals:**
- 同步上游已驗證的 bug fix
- 修復租賃��料的日期欄位
- 防止異常民國年產生錯誤日期

**Non-Goals:**
- 修改 ETL 架構或���程

## Decisions

### Decision 1: 直接同步上游 diff

從 TW_RealEstate_ETL@0663f8d 直接複製修改，不做額外改動。上游已測試驗證。

## Risks / Trade-offs

**[需重跑 ETL]** → 修完 code 後需重新跑 ETL 才能修復已存在的錯誤資料。可用 delete mode 清除後重灌。
