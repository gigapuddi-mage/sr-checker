import type {
  RaidData,
  PlayerReservation,
  ValidationResult,
  ValidationReport,
} from "./types";

function findSrPlusItem(player: PlayerReservation): { itemName: string; srValue: number } | null {
  // The SR+ item is the one with srValue > 0
  const srPlusItem = player.items.find((item) => item.srValue > 0);
  if (srPlusItem) {
    return { itemName: srPlusItem.itemName, srValue: srPlusItem.srValue };
  }

  // If all items have srValue 0, this is a new player starting fresh
  // Return the first item with srValue = 0
  if (player.items.length > 0) {
    return { itemName: player.items[0].itemName, srValue: 0 };
  }

  return null;
}

function findPlayerInPreviousWeeks(
  playerName: string,
  previousWeeks: RaidData[],
  maxWeeksBack: number = 3
): { weekIndex: number; srPlusItem: { itemName: string; srValue: number } } | null {
  // previousWeeks is ordered newest to oldest
  // We search up to maxWeeksBack weeks
  for (let i = 0; i < Math.min(previousWeeks.length, maxWeeksBack); i++) {
    const week = previousWeeks[i];
    const player = week.reservations.find(
      (p) => p.playerName.toLowerCase() === playerName.toLowerCase()
    );

    if (player) {
      const srPlusItem = findSrPlusItem(player);
      if (srPlusItem) {
        return { weekIndex: i, srPlusItem };
      }
    }
  }

  return null;
}

export function validateSrPlus(
  currentWeek: RaidData,
  previousWeeks: RaidData[]
): ValidationReport {
  const results: ValidationResult[] = [];

  for (const player of currentWeek.reservations) {
    const currentSrPlus = findSrPlusItem(player);

    if (!currentSrPlus) {
      // No items found for this player
      results.push({
        playerName: player.playerName,
        itemName: "N/A",
        actualSrPlus: 0,
        expectedSrPlus: 0,
        status: "ERROR",
        reason: "No items found",
      });
      continue;
    }

    // Search for this player in previous weeks (up to 3 weeks back)
    const previousData = findPlayerInPreviousWeeks(player.playerName, previousWeeks, 3);

    let expectedSrPlus: number;
    let isNewOrReset = false;
    let baseReason: string;

    if (!previousData) {
      // Player not found in the last 3 weeks
      // Check if they exist 4+ weeks back (would indicate a reset)
      const olderData = findPlayerInPreviousWeeks(
        player.playerName,
        previousWeeks.slice(3),
        previousWeeks.length
      );

      expectedSrPlus = 0;
      isNewOrReset = true;

      if (olderData) {
        baseReason = "4+ week gap";
      } else {
        baseReason = "New player";
      }
    } else {
      // Player found in previous weeks
      const { srPlusItem: previousItem, weekIndex } = previousData;

      // Normalize item names for comparison
      const sameItem =
        currentSrPlus.itemName.toLowerCase().trim() ===
        previousItem.itemName.toLowerCase().trim();

      if (sameItem) {
        // Same item - SR+ should be previous + 1
        expectedSrPlus = previousItem.srValue + 1;
        isNewOrReset = false;
        baseReason = weekIndex === 0 ? "" : `Continued from ${weekIndex + 1} weeks ago`;
      } else {
        // Different item - SR+ resets to 0
        expectedSrPlus = 0;
        isNewOrReset = true;
        baseReason = `Item changed from "${previousItem.itemName}"`;
      }
    }

    // Determine status
    let status: "OK" | "WARNING" | "ERROR";
    let reason: string | undefined;

    if (currentSrPlus.srValue === expectedSrPlus) {
      // Exact match
      status = "OK";
      reason = baseReason || undefined;
    } else if (isNewOrReset && currentSrPlus.srValue === 2) {
      // New player or item change with SR+ = 2 -> check for exalted
      status = "WARNING";
      reason = `Check for Exalted Status (${baseReason})`;
    } else {
      // Mismatch
      status = "ERROR";
      reason = `Expected ${expectedSrPlus}, got ${currentSrPlus.srValue}${baseReason ? ` (${baseReason})` : ""}`;
    }

    results.push({
      playerName: player.playerName,
      itemName: currentSrPlus.itemName,
      actualSrPlus: currentSrPlus.srValue,
      expectedSrPlus,
      status,
      reason,
    });
  }

  const errorCount = results.filter((r) => r.status === "ERROR").length;
  const warningCount = results.filter((r) => r.status === "WARNING").length;

  return {
    raidId: currentWeek.raidId,
    results,
    totalPlayers: results.length,
    correctCount: results.length - errorCount - warningCount,
    warningCount,
    errorCount,
  };
}
