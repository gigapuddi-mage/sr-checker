import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "fs";

const BASE_URL = "https://raidres.top/res/";
const RAID_IDS = ["SNDQJT", "2ECMWK", "MKJWXC", "6TEQQ7"];

async function snapshotRaid(page: any, raidId: string): Promise<string> {
  const url = `${BASE_URL}${raidId}`;
  console.log(`Fetching ${raidId}...`);

  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  // Click Actions button
  const actionsButton = await page.locator('button:has-text("Actions")').first();
  await actionsButton.click();
  await page.waitForTimeout(500);

  // Click Export to CSV
  const exportButton = await page.locator('text=/export.*csv/i').first();
  await exportButton.click();
  await page.waitForTimeout(1000);

  // Get CSV content
  const csvContent = await page.evaluate(() => {
    const textarea = document.querySelector("textarea");
    return textarea?.value || "";
  });

  return csvContent;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  mkdirSync("test/fixtures", { recursive: true });

  for (const raidId of RAID_IDS) {
    const csv = await snapshotRaid(page, raidId);
    const filename = `test/fixtures/${raidId}.csv`;
    writeFileSync(filename, csv);
    console.log(`  Saved ${filename} (${csv.split("\n").length} lines)`);
    await page.waitForTimeout(1000);
  }

  await browser.close();
  console.log("\nDone! Test fixtures saved to test/fixtures/");
}

main().catch(console.error);
