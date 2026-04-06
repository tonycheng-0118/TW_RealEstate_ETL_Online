import { describe, it, expect } from "vitest";
import { formatResultRows } from "../format-result";

describe("formatResultRows", () => {
  // --- Area conversion (m² → 坪) ---
  describe("area conversion", () => {
    it("converts building_area to _ping", () => {
      const [row] = formatResultRows([{ building_area: 132.12 }]);
      expect(row.building_area_ping).toBe(39.96);
    });

    it("converts land_area to _ping", () => {
      const [row] = formatResultRows([{ land_area: 66.12 }]);
      expect(row.land_area_ping).toBe(20.0);
    });

    it("converts parking_area to _ping", () => {
      const [row] = formatResultRows([{ parking_area: 16.53 }]);
      expect(row.parking_area_ping).toBe(5.0);
    });

    it("converts Chinese alias with 面積", () => {
      const [row] = formatResultRows([{ "平均面積": 99.18 }]);
      expect(row["平均面積_ping"]).toBe(30.0);
    });
  });

  // --- Price conversion (元 → 萬元) ---
  describe("price conversion", () => {
    it("converts total_price to _wan", () => {
      const [row] = formatResultRows([{ total_price: 85000000 }]);
      expect(row.total_price_wan).toBe(8500.0);
    });

    it("converts parking_price to _wan", () => {
      const [row] = formatResultRows([{ parking_price: 2000000 }]);
      expect(row.parking_price_wan).toBe(200.0);
    });

    it("converts Chinese alias with 總價", () => {
      const [row] = formatResultRows([{ "最高總價": 150000000 }]);
      expect(row["最高總價_wan"]).toBe(15000.0);
    });

    it("converts Chinese alias with 房價", () => {
      const [row] = formatResultRows([{ "平均房價": 52800000 }]);
      expect(row["平均房價_wan"]).toBe(5280.0);
    });
  });

  // --- Unit price conversion (元/m² → 萬元/坪) ---
  describe("unit price conversion", () => {
    it("converts unit_price to _wan_ping", () => {
      const [row] = formatResultRows([{ unit_price: 460000 }]);
      // 460000 × 3.306 / 10000 = 152.076 → 152.08
      expect(row.unit_price_wan_ping).toBe(152.08);
    });

    it("converts Chinese alias with 單價", () => {
      const [row] = formatResultRows([{ "平均單價": 880500 }]);
      // 880500 × 3.306 / 10000 = 291.09
      expect(row["平均單價_wan_ping"]).toBe(291.09);
    });
  });

  // --- Rent exclusion ---
  describe("rent fields", () => {
    it("does NOT convert total_rent to _wan", () => {
      const [row] = formatResultRows([{ total_rent: 35000 }]);
      expect(row.total_rent).toBe(35000);
      expect(row.total_rent_wan).toBeUndefined();
    });

    it("does NOT convert Chinese rent alias to _wan", () => {
      const [row] = formatResultRows([{ "平均月租": 28000 }]);
      expect(row["平均月租_wan"]).toBeUndefined();
    });

    it("converts unit_rent to _ping (元/坪, not 萬/坪)", () => {
      const [row] = formatResultRows([{ unit_rent: 500 }]);
      // 500 × 3.306 = 1653.0
      expect(row.unit_rent_ping).toBe(1653.0);
      expect(row.unit_rent_wan_ping).toBeUndefined();
    });
  });

  // --- Edge cases: null, zero, negative ---
  describe("edge cases", () => {
    it("returns null for null values", () => {
      const [row] = formatResultRows([{ building_area: null }]);
      expect(row.building_area_ping).toBeNull();
    });

    it("returns null for zero values", () => {
      const [row] = formatResultRows([{ building_area: 0 }]);
      expect(row.building_area_ping).toBeNull();
    });

    it("returns null for negative values", () => {
      const [row] = formatResultRows([{ total_price: -100 }]);
      expect(row.total_price_wan).toBeNull();
    });

    it("returns null for undefined values", () => {
      const [row] = formatResultRows([{ building_area: undefined }]);
      expect(row.building_area_ping).toBeNull();
    });

    it("handles string numbers from DB", () => {
      const [row] = formatResultRows([{ building_area: "132.12" }]);
      expect(row.building_area_ping).toBe(39.96);
    });
  });

  // --- Zero-area anomaly annotation ---
  describe("zero-area annotation", () => {
    it("adds _note when building_area=0 but unit_price>0", () => {
      const [row] = formatResultRows([
        { building_area: 0, unit_price: 290000 },
      ]);
      expect(row.building_area_note).toBe("僅土地交易，無建物面積");
    });

    it("adds _note when building_area is null but unit_price>0", () => {
      const [row] = formatResultRows([
        { building_area: null, unit_price: 290000 },
      ]);
      expect(row.building_area_note).toBe("僅土地交易，無建物面積");
    });

    it("does NOT add _note when building_area is positive", () => {
      const [row] = formatResultRows([
        { building_area: 150.61, unit_price: 290000 },
      ]);
      expect(row.building_area_note).toBeUndefined();
    });

    it("does NOT add _note when unit_price is also 0", () => {
      const [row] = formatResultRows([
        { building_area: 0, unit_price: 0 },
      ]);
      expect(row.building_area_note).toBeUndefined();
    });
  });

  // --- Multiple rows ---
  describe("multiple rows", () => {
    it("processes all rows", () => {
      const rows = formatResultRows([
        { building_area: 132.12, total_price: 50000000 },
        { building_area: 99.18, total_price: 30000000 },
      ]);
      expect(rows).toHaveLength(2);
      expect(rows[0].building_area_ping).toBe(39.96);
      expect(rows[1].building_area_ping).toBe(30.0);
      expect(rows[0].total_price_wan).toBe(5000.0);
      expect(rows[1].total_price_wan).toBe(3000.0);
    });

    it("handles empty array", () => {
      expect(formatResultRows([])).toEqual([]);
    });
  });

  // --- Non-matching columns pass through ---
  describe("passthrough", () => {
    it("preserves non-matching columns unchanged", () => {
      const [row] = formatResultRows([
        { district: "大安區", rooms: 3, address: "忠孝東路" },
      ]);
      expect(row.district).toBe("大安區");
      expect(row.rooms).toBe(3);
      expect(row.address).toBe("忠孝東路");
    });
  });
});
