import { chromium, type Browser, type Page } from "playwright";
import type { RaidData, PlayerReservation, ItemReservation } from "./types";

const BASE_URL = "https://raidres.top/res/";

let browser: Browser | null = null;

export async function initBrowser(): Promise<void> {
  if (!browser) {
    browser = await chromium.launch({ headless: true });
  }
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
  }
}

interface CsvRow {
  id: string;
  item: string;
  boss: string;
  attendee: string;
  class: string;
  specialization: string;
  comment: string;
  date: string;
  srPlus: number;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);

  return result;
}

function parseCsv(csvContent: string): CsvRow[] {
  const lines = csvContent.trim().split("\n");
  if (lines.length < 2) return [];

  // Skip header row
  const dataLines = lines.slice(1);
  const rows: CsvRow[] = [];

  for (const line of dataLines) {
    const fields = parseCsvLine(line);
    if (fields.length >= 9) {
      rows.push({
        id: fields[0],
        item: fields[1],
        boss: fields[2],
        attendee: fields[3],
        class: fields[4],
        specialization: fields[5],
        comment: fields[6],
        date: fields[7],
        srPlus: parseInt(fields[8], 10) || 0,
      });
    }
  }

  return rows;
}

function groupByPlayer(rows: CsvRow[]): PlayerReservation[] {
  const playerMap = new Map<string, ItemReservation[]>();

  for (const row of rows) {
    const playerName = row.attendee;
    if (!playerMap.has(playerName)) {
      playerMap.set(playerName, []);
    }
    playerMap.get(playerName)!.push({
      itemName: row.item,
      srValue: row.srPlus,
    });
  }

  const reservations: PlayerReservation[] = [];
  for (const [playerName, items] of playerMap) {
    reservations.push({ playerName, items });
  }

  return reservations;
}

export async function scrapeRaid(raidId: string): Promise<RaidData> {
  if (!browser) {
    await initBrowser();
  }

  const page = await browser!.newPage();
  const url = `${BASE_URL}${raidId}`;

  try {
    console.log(`Fetching raid data from ${url}...`);
    await page.goto(url, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);

    // Click the Actions button
    const actionsButton = await page.locator('button:has-text("Actions")').first();
    await actionsButton.click();
    await page.waitForTimeout(500);

    // Click Export to CSV
    const exportButton = await page.locator('text=/export.*csv/i').first();
    if (!(await exportButton.isVisible())) {
      throw new Error("Export to CSV option not found");
    }
    await exportButton.click();
    await page.waitForTimeout(1000);

    // Get CSV content from textarea
    const csvContent = await page.evaluate(() => {
      const textarea = document.querySelector("textarea");
      return textarea?.value || "";
    });

    if (!csvContent) {
      throw new Error("No CSV content found in export dialog");
    }

    // Parse CSV and group by player
    const rows = parseCsv(csvContent);
    const reservations = groupByPlayer(rows);

    console.log(`  Found ${reservations.length} players with ${rows.length} total reservations`);

    return {
      raidId,
      url,
      reservations,
    };
  } finally {
    await page.close();
  }
}

export async function scrapeMultipleRaids(raidIds: string[]): Promise<RaidData[]> {
  const results: RaidData[] = [];

  await initBrowser();

  for (const raidId of raidIds) {
    try {
      const data = await scrapeRaid(raidId);
      results.push(data);
      // Small delay between requests to be respectful
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`Failed to scrape raid ${raidId}:`, error);
      results.push({
        raidId,
        url: `${BASE_URL}${raidId}`,
        reservations: [],
      });
    }
  }

  await closeBrowser();

  return results;
}
