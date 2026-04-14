# SR+ Validation Rules for Turtle WoW Raid Reserves

## Overview

Validates SR+ (Soft Reserve Plus) values for players across weekly raids using data from [raidres.top](https://raidres.top). The tool runs as a Google Sheets Apps Script.

## SR+ Rules

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

### Validation Statuses
- **OK**: SR+ matches expected value
- **WARNING**: New player or item change with SR+ = 2 (check for exalted status)
- **ERROR**: SR+ doesn't match expected value

## Data Source

The raidres.top API provides:
1. Event data: `https://raidres.top/api/events/{eventId}` — reservation data (character names, SR+ values)
2. Item names: `https://raidres.top/raids/raid_{raidId}.json` — item ID to name mapping

Each player has 1 item with SR+ (accumulating) and 1 plain SR item (always 0).

## Google Sheets Setup

### Config Sheet
| Cell | Value |
|------|-------|
| A2: "Current Raid ID" | B2: e.g. `SNDQJT` |
| A3: "Previous Week 1" | B3: e.g. `2ECMWK` |
| A4: "Previous Week 2" | B4: e.g. `MKJWXC` |
| A5: "Previous Week 3" | B5: e.g. `6TEQQ7` |

The raid ID is the code at the end of the raidres.top URL: `https://raidres.top/res/SNDQJT`

### Installation
1. Open your Google Sheet
2. Go to **Extensions > Apps Script**
3. Paste the contents of `google-sheets/Code.gs`
4. Save and refresh the sheet
5. Use the **SR+ Checker > Run Validation** menu

### Results
The script writes a "Results" sheet with color-coded rows:
- Red: ERROR
- Yellow: WARNING
- Green: OK

## Testing

Tests run against the actual `Code.gs` validation functions using Bun:

```bash
bun test
```

Test fixtures in `test/fixtures/` are CSV snapshots from real raidres.top data:
- `SNDQJT.csv` — Current week (33 players)
- `2ECMWK.csv` — Week -1 (39 players)
- `MKJWXC.csv` — Week -2 (41 players)
- `6TEQQ7.csv` — Week -3 (37 players)

The test loader (`test/gas-loader.ts`) evaluates `Code.gs` with GAS globals stubbed, so tests exercise the actual production validation logic.
