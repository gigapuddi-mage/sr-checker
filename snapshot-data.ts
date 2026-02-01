import { writeFileSync, mkdirSync } from "fs";

const EVENT_API = "https://raidres.top/api/events";
const RAID_DATA_URL = "https://raidres.top/raids";
const RAID_IDS = ["SNDQJT", "2ECMWK", "MKJWXC", "6TEQQ7"];

interface ApiReservation {
  raidItemId: number;
  character: { name: string };
  srPlus: { value: number };
}

interface ApiResponse {
  reference: string;
  raidId: number;
  reservations: ApiReservation[];
}

interface RaidItem {
  id: number;
  name: string;
}

interface RaidDataResponse {
  raidItems: RaidItem[];
}

// Cache raid item data
const raidDataCache = new Map<number, Map<number, string>>();

async function getItemNameMap(raidId: number): Promise<Map<number, string>> {
  if (raidDataCache.has(raidId)) {
    return raidDataCache.get(raidId)!;
  }

  const response = await fetch(`${RAID_DATA_URL}/raid_${raidId}.json`);
  if (!response.ok) {
    console.warn(`Could not fetch raid data for raid ${raidId}`);
    return new Map();
  }

  const data: RaidDataResponse = await response.json();
  const itemMap = new Map<number, string>();
  for (const item of data.raidItems) {
    itemMap.set(item.id, item.name);
  }

  raidDataCache.set(raidId, itemMap);
  return itemMap;
}

async function fetchAndConvertToCsv(eventId: string): Promise<string> {
  console.log(`Fetching ${eventId}...`);

  const response = await fetch(`${EVENT_API}/${eventId}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch event ${eventId}: ${response.status}`);
  }
  const data: ApiResponse = await response.json();

  const itemNames = await getItemNameMap(data.raidId);

  // Build CSV with header matching old format
  const lines: string[] = [];
  lines.push("id,item,boss,attendee,class,specialization,comment,date,srPlus");

  for (const res of data.reservations) {
    const itemName = itemNames.get(res.raidItemId) || `Unknown Item (${res.raidItemId})`;
    // Escape quotes in item names
    const escapedItemName = itemName.includes(",") ? `"${itemName}"` : itemName;
    const playerName = res.character.name;
    const srPlus = res.srPlus.value;

    // id, item, boss, attendee, class, specialization, comment, date, srPlus
    lines.push(`${res.raidItemId},${escapedItemName},,${playerName},,,,${new Date().toISOString()},${srPlus}`);
  }

  return lines.join("\n");
}

async function main() {
  mkdirSync("test/fixtures", { recursive: true });

  for (const raidId of RAID_IDS) {
    const csv = await fetchAndConvertToCsv(raidId);
    const filename = `test/fixtures/${raidId}.csv`;
    writeFileSync(filename, csv);
    console.log(`  Saved ${filename} (${csv.split("\n").length} lines)`);
  }

  console.log("\nDone! Test fixtures saved to test/fixtures/");
}

main().catch(console.error);
