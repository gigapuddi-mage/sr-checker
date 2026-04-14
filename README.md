# SR+ Checker

A Google Sheets tool to validate SR+ (Soft Reserve Plus) values for Turtle WoW raids using [raidres.top](https://raidres.top).

## What it does

Fetches reservation data from the raidres.top API and validates that players have entered the correct SR+ values based on their history across multiple weeks.

### SR+ Rules
- **New players** start at SR+ = 0
- **Exalted players** can start at SR+ = 2
- **Same item week-to-week**: SR+ should increment by 1
- **Item change**: SR+ resets to 0
- **Miss up to 3 weeks**: Continue from last SR+ value
- **Miss 4+ weeks**: SR+ resets to 0

See [PLAN.md](PLAN.md) for the full rules specification.

## Setup

1. Open your Google Sheet
2. Create a **Config** sheet with raid IDs:
   - `B2`: Current raid ID (e.g. `SNDQJT`)
   - `B3`: Previous week 1
   - `B4`: Previous week 2
   - `B5`: Previous week 3
3. Go to **Extensions > Apps Script**
4. Paste the contents of [`google-sheets/Code.gs`](google-sheets/Code.gs)
5. Save and refresh the sheet
6. Use the **SR+ Checker > Run Validation** menu

The raid ID is the code at the end of the raidres.top URL:
```
https://raidres.top/res/SNDQJT
                        ^^^^^^
```

## Testing

```bash
bun test
```

Tests load and execute the actual `Code.gs` validation functions against CSV fixture data.
