import { scrapeMultipleRaids, closeBrowser } from "./scraper";
import { validateSrPlus } from "./validator";
import { printReport, formatSummary } from "./report";
import type { RaidData, ValidationReport } from "./types";

function printUsage(): void {
  console.log(`
SR+ Validation Tool for Turtle WoW Raid Reserves
=================================================

Usage:
  bun run src/index.ts <current_raid_id> [previous_raid_ids...]

Arguments:
  current_raid_id     - The raid ID to validate (required)
  previous_raid_ids   - Previous week raid IDs for comparison (optional, newest to oldest)

Examples:
  bun run src/index.ts SNDQJT
  bun run src/index.ts SNDQJT 2ECMWK MKJWXC 6TEQQ7

The first argument is the current week to validate.
Subsequent arguments are previous weeks (newest first) used for SR+ history comparison.
`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    printUsage();
    process.exit(1);
  }

  if (args.includes("--help") || args.includes("-h")) {
    printUsage();
    process.exit(0);
  }

  const [currentRaidId, ...previousRaidIds] = args;

  console.log(`\nSR+ Validation Tool`);
  console.log(`===================\n`);
  console.log(`Current raid to validate: ${currentRaidId}`);

  if (previousRaidIds.length > 0) {
    console.log(`Previous raids for comparison: ${previousRaidIds.join(", ")}`);
  } else {
    console.log(`No previous raids provided - all players will be expected to have SR+ = 1`);
  }

  console.log("");

  try {
    // Scrape all raids
    const allRaidIds = [currentRaidId, ...previousRaidIds];
    console.log(`Scraping ${allRaidIds.length} raid(s)...\n`);

    const allRaids = await scrapeMultipleRaids(allRaidIds);

    const currentWeek = allRaids[0];
    const previousWeeks = allRaids.slice(1);

    if (currentWeek.reservations.length === 0) {
      console.error(`Error: No reservations found for raid ${currentRaidId}`);
      console.error(`Please check if the raid ID is correct and the page is accessible.`);
      process.exit(1);
    }

    console.log(`\nFound ${currentWeek.reservations.length} players in current raid.`);

    for (let i = 0; i < previousWeeks.length; i++) {
      const week = previousWeeks[i];
      console.log(`Previous week ${i + 1} (${week.raidId}): ${week.reservations.length} players`);
    }

    // Validate
    const report = validateSrPlus(currentWeek, previousWeeks);

    // Print report
    printReport(report);

  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  } finally {
    await closeBrowser();
  }
}

main();
