## ADDED Requirements

### Requirement: Area conversion (m² to 坪)
The system SHALL programmatically convert all area fields (columns ending with `_area` or aliases containing「面積」) from m² to 坪 using the formula: `坪 = m² ÷ 3.306`, rounded to 2 decimal places. The converted value SHALL be appended as a new field with suffix `_ping`.

#### Scenario: Building area conversion
- **WHEN** a DB row contains `building_area: 132.12`
- **THEN** the enriched row SHALL contain `building_area_ping: 39.96`

#### Scenario: Aggregate area alias conversion
- **WHEN** a DB row contains `平均面積: 99.18`
- **THEN** the enriched row SHALL contain `平均面積_ping: 30.0`

#### Scenario: Zero area
- **WHEN** a DB row contains `building_area: 0`
- **THEN** the enriched row SHALL contain `building_area_ping: null`

#### Scenario: Null area
- **WHEN** a DB row contains `building_area: null`
- **THEN** the enriched row SHALL contain `building_area_ping: null`

### Requirement: Price conversion (元 to 萬元)
The system SHALL programmatically convert price fields (`total_price`, `parking_price`, and aliases containing「總價」「房價」) from 元 to 萬元 using the formula: `萬元 = 元 ÷ 10000`, rounded to 2 decimal places. The converted value SHALL be appended as a new field with suffix `_wan`.

#### Scenario: Total price conversion
- **WHEN** a DB row contains `total_price: 85000000`
- **THEN** the enriched row SHALL contain `total_price_wan: 8500.0`

#### Scenario: Aggregate price alias conversion
- **WHEN** a DB row contains `最高總價: 150000000`
- **THEN** the enriched row SHALL contain `最高總價_wan: 15000.0`

#### Scenario: Null price
- **WHEN** a DB row contains `total_price: null`
- **THEN** the enriched row SHALL contain `total_price_wan: null`

### Requirement: Unit price conversion (元/m² to 萬元/坪)
The system SHALL programmatically convert unit price fields (`unit_price` and aliases containing「單價」) from 元/m² to 萬元/坪 using the formula: `萬元/坪 = 元/m² × 3.306 ÷ 10000`, rounded to 2 decimal places. The converted value SHALL be appended with suffix `_wan_ping`.

#### Scenario: Unit price conversion
- **WHEN** a DB row contains `unit_price: 460000`
- **THEN** the enriched row SHALL contain `unit_price_wan_ping: 152.08`

#### Scenario: Aggregate unit price alias conversion
- **WHEN** a DB row contains `平均單價: 880500`
- **THEN** the enriched row SHALL contain `平均單價_wan_ping: 291.05`

### Requirement: Rent fields are not converted to 萬
The system SHALL NOT convert rent fields (`total_rent` and aliases containing「租金」「月租」) to 萬元. Rent unit price (`unit_rent`) SHALL be converted from 元/m² to 元/坪 (not 萬元/坪) with suffix `_ping`.

#### Scenario: Rent preserved as-is
- **WHEN** a DB row contains `total_rent: 35000`
- **THEN** the enriched row SHALL NOT contain `total_rent_wan`

#### Scenario: Unit rent conversion
- **WHEN** a DB row contains `unit_rent: 500`
- **THEN** the enriched row SHALL contain `unit_rent_ping: 1653.0`

### Requirement: Zero-area anomaly annotation
When `building_area` is 0 or null but `unit_price` has a positive value, the system SHALL append a `_note` field with value `"僅土地交易，無建物面積"` to help Pass 2 LLM generate an appropriate explanation.

#### Scenario: Zero building area with unit price
- **WHEN** a DB row contains `building_area: 0` and `unit_price: 290000`
- **THEN** the enriched row SHALL contain `building_area_note: "僅土地交易，無建物面積"`

#### Scenario: Normal building area
- **WHEN** a DB row contains `building_area: 150.61` and `unit_price: 290000`
- **THEN** the enriched row SHALL NOT contain `building_area_note`
