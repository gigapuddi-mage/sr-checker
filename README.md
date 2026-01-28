# SR+ Checker

A CLI tool to validate SR+ (Soft Reserve Plus) values for Turtle WoW raids using [raidres.top](https://raidres.top).

## What it does

This tool scrapes reservation data from raidres.top and validates that players have entered the correct SR+ values based on their history across multiple weeks.

### SR+ Rules
- **New players** start at SR+ = 0
- **Exalted players** can start at SR+ = 2
- **Same item week-to-week**: SR+ should increment by 1
- **Item change**: SR+ resets to 0
- **Miss up to 3 weeks**: Continue from last SR+ value
- **Miss 4+ weeks**: SR+ resets to 0

## Installation

```bash
# Install dependencies
bun install

# Install Playwright browser
bunx playwright install chromium
```

## Usage

```bash
bun run src/index.ts <current_raid> [previous_raids...]
```

### Arguments
- **First argument**: The raid ID to validate (current week)
- **Remaining arguments**: Previous raid IDs for history comparison (newest to oldest)

### Examples

Validate a single raid (all players expected to have SR+ = 0):
```bash
bun run src/index.ts SNDQJT
```

Validate against 3 previous weeks of history:
```bash
bun run src/index.ts SNDQJT 2ECMWK MKJWXC 6TEQQ7
```

The raid ID is the code at the end of the raidres.top URL:
```
https://raidres.top/res/SNDQJT
                        ^^^^^^
                        This is the raid ID
```

## Output

The tool generates a report showing each player's SR+ status:

```
SR+ Validation Report - Raid SNDQJT
================================================================================

Player Name        | Item                           |   SR+ | Expected | Status
-----------------------------------------------------------------------------------------
Gzeus              | Ephemeral Pendant              |     7 |        6 | ERROR: Expected 6, got 7
Mightymax          | Shar'tateth, the Shattered ... |     6 |        4 | ERROR: Expected 4, got 6
Aeteis             | Shifting Mantle of Ascendancy  |     2 |        0 | WARN: Check for Exalted Status (New player)
Boaramir           | King's Edict                   |     0 |        0 | OK (New player)
Ennvii             | Pure Jewel of Draenor          |     9 |        9 | OK
...

--------------------------------------------------------------------------------
Summary: 25/33 OK, 5 warnings, 3 errors
```

### Status Types
- **OK**: SR+ matches expected value
- **WARNING**: New player or item change with SR+ = 2 (verify exalted status manually)
- **ERROR**: SR+ doesn't match expected value

## Testing

Run tests using the snapshot fixtures:
```bash
bun test
```

## How it works

1. Opens each raid page in a headless browser (Playwright)
2. Clicks "Actions" → "Export data to CSV"
3. Parses the CSV data to extract player reservations
4. Compares current week against previous weeks to calculate expected SR+ values
5. Generates a validation report
