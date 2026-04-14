Default to using Bun instead of Node.js.

- Use `bun test` to run tests
- Use `bun install` instead of `npm install`

## Project Structure

This is a Google Apps Script project. The production code lives in `google-sheets/Code.gs` — a single self-contained file pasted into the Google Sheets Apps Script editor.

Tests use Bun to evaluate `Code.gs` directly via `test/gas-loader.ts`, so they exercise the actual production validation logic.

## SR+ Rules

See `PLAN.md` for the full business logic specification.
