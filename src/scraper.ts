import type { RaidData, PlayerReservation, ItemReservation } from "./types";

const EVENT_API = "https://raidres.top/api/events";
const RAID_DATA_URL = "https://raidres.top/raids";

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

// Cache raid data to avoid refetching for same raid
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

export async function fetchRaid(eventId: string): Promise<RaidData> {
  // 1. Fetch event data
  const response = await fetch(`${EVENT_API}/${eventId}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch event ${eventId}: ${response.status}`);
  }
  const data: ApiResponse = await response.json();

  // 2. Fetch item names for this raid
  const itemNames = await getItemNameMap(data.raidId);

  // 3. Group reservations by player
  const playerMap = new Map<string, ItemReservation[]>();
  for (const res of data.reservations) {
    const playerName = res.character.name;
    const itemName = itemNames.get(res.raidItemId) || `Unknown Item (${res.raidItemId})`;

    if (!playerMap.has(playerName)) {
      playerMap.set(playerName, []);
    }
    playerMap.get(playerName)!.push({
      itemName,
      srValue: res.srPlus.value,
    });
  }

  const reservations: PlayerReservation[] = [];
  for (const [playerName, items] of playerMap) {
    reservations.push({ playerName, items });
  }

  console.log(`Fetched ${eventId}: ${reservations.length} players, ${data.reservations.length} reservations`);

  return {
    raidId: eventId,
    url: `https://raidres.top/res/${eventId}`,
    reservations,
  };
}

export async function fetchMultipleRaids(eventIds: string[]): Promise<RaidData[]> {
  const results: RaidData[] = [];
  for (const eventId of eventIds) {
    try {
      const data = await fetchRaid(eventId);
      results.push(data);
    } catch (error) {
      console.error(`Failed to fetch event ${eventId}:`, error);
      results.push({ raidId: eventId, url: `https://raidres.top/res/${eventId}`, reservations: [] });
    }
  }
  return results;
}

// Backward compatibility - no-ops
export async function initBrowser(): Promise<void> {}
export async function closeBrowser(): Promise<void> {}
export const scrapeRaid = fetchRaid;
export const scrapeMultipleRaids = fetchMultipleRaids;
