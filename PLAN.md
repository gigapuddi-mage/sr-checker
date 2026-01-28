# SR+ Validation Script for Turtle WoW Raid Reserves

## Overview
Build a TypeScript/Bun CLI tool that scrapes raidres.top reservation data and validates SR+ values across multiple weeks.

## Requirements Summary
- **Language**: TypeScript with Bun runtime
- **Data Source**: raidres.top (uses CSV export via Playwright browser automation)
- **SR+ Rules**:
  - Each player has 1 item with SR+ (accumulating) and 1 plain SR item (always 0)
  - New players start at SR+ = 0
  - **Exalted players** start at SR+ = 2 (manual verification needed)
  - Same item week-to-week: SR+ should be previous + 1
  - Missed weeks (up to 3): continue from last known SR+ (+1)
  - Missed 4+ consecutive weeks: SR+ resets to 0
  - Changed item: SR+ resets to 0 (or 2 if exalted)
- **Output**: Terminal report showing each player's SR+ validity

---

## SR+ Rules in Detail

### Starting Values
| Scenario | Expected SR+ |
|----------|-------------|
| New player (normal) | 0 |
| New player (exalted) | 2 |
| Item change (normal) | 0 |
| Item change (exalted) | 2 |
| 4+ week gap | 0 |

### Continuation
- If a player reserves the same item as the previous week: `expected = previous + 1`
- Players can miss up to 3 weeks and still continue their SR+ counter

### Exalted Status
Players with "Exalted" guild reputation can start at SR+ = 2 instead of 0. When the validator detects a new player or item change with SR+ = 2, it flags this as a **WARNING** to manually verify exalted status (not an error).

---

## Implementation

### Data Extraction Method
Instead of parsing HTML (which is complex due to dynamic loading), the scraper:
1. Clicks the "Actions" button on the raid page
2. Clicks "Export data to CSV"
3. Reads the CSV content from the textarea in the modal
4. Parses the CSV to extract player reservations

### CSV Format
```csv
ID,Item,Boss,Attendee,Class,Specialization,Comment,"Date (GMT)",SR+
55093,"Remains of Overwhelming Power",Anomalus,Cinamo,Warlock,Affliction,,"2026-01-24 23:57:49",0
55129,Desecration,Kruul,Cinamo,Warlock,Affliction,,"2026-01-24 23:58:00",2
```

### Validation Statuses
- **OK**: SR+ matches expected value
- **WARNING**: New player or item change with SR+ = 2 (check for exalted status)
- **ERROR**: SR+ doesn't match expected value

---

## Files

| File | Purpose |
|------|---------|
| `src/index.ts` | CLI entry point |
| `src/scraper.ts` | Playwright scraping via CSV export |
| `src/validator.ts` | SR+ validation algorithm |
| `src/report.ts` | Terminal report formatting |
| `src/types.ts` | Shared TypeScript interfaces |
| `test/fixtures/*.csv` | Snapshot data for testing |
| `test/validator.test.ts` | Validation tests with fixtures |

---

## Usage

```bash
# Validate current week against previous weeks
bun run src/index.ts SNDQJT 2ECMWK MKJWXC 6TEQQ7

# Arguments:
#   1st = current week to validate
#   2nd+ = previous weeks (newest to oldest) for history comparison
```

---

## Test Fixtures

Snapshot data from 4 raids saved in `test/fixtures/`:
- `SNDQJT.csv` - Current week (Jan 24, 2026)
- `2ECMWK.csv` - Week -1 (Jan 3, 2026)
- `MKJWXC.csv` - Week -2 (Dec 20, 2025)
- `6TEQQ7.csv` - Week -3 (Dec 13, 2025)

Run tests:
```bash
bun test
```

---

## Example Output

```
SR+ Validation Report - Raid SNDQJT
================================================================================

Player Name        | Item                           |   SR+ | Expected | Status
-----------------------------------------------------------------------------------------
Gzeus              | Ephemeral Pendant              |     7 |        6 | ERROR: Expected 6, got 7
Mightymax          | Shar'tateth, the Shattered ... |     6 |        4 | ERROR: Expected 4, got 6
Aeteis             | Shifting Mantle of Ascendancy  |     2 |        0 | WARN: Check for Exalted Status (New player)
Cinamo             | Desecration                    |     2 |        0 | WARN: Check for Exalted Status (Item changed)
Boaramir           | King's Edict                   |     0 |        0 | OK (New player)
Ennvii             | Pure Jewel of Draenor          |     9 |        9 | OK
...

--------------------------------------------------------------------------------
Summary: 25/33 OK, 5 warnings, 3 errors
```
