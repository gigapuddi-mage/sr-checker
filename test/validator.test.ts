import { describe, it, expect } from "bun:test";
import { readFileSync } from "fs";
import { validateSrPlus } from "../src/validator";
import type { RaidData, PlayerReservation, ItemReservation } from "../src/types";

// Parse CSV fixtures
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

function loadFixture(raidId: string): RaidData {
  const csv = readFileSync(`test/fixtures/${raidId}.csv`, "utf-8");
  const lines = csv.trim().split("\n").slice(1); // skip header

  const playerMap = new Map<string, ItemReservation[]>();

  for (const line of lines) {
    const fields = parseCsvLine(line);
    if (fields.length >= 9) {
      const playerName = fields[3]; // Attendee
      const itemName = fields[1]; // Item
      const srValue = parseInt(fields[8], 10) || 0; // SR+

      if (!playerMap.has(playerName)) {
        playerMap.set(playerName, []);
      }
      playerMap.get(playerName)!.push({ itemName, srValue });
    }
  }

  const reservations: PlayerReservation[] = [];
  for (const [playerName, items] of playerMap) {
    reservations.push({ playerName, items });
  }

  return {
    raidId,
    url: `https://raidres.top/res/${raidId}`,
    reservations,
  };
}

// Load all fixtures
const SNDQJT = loadFixture("SNDQJT"); // Current week
const _2ECMWK = loadFixture("2ECMWK"); // Week -1
const MKJWXC = loadFixture("MKJWXC"); // Week -2
const _6TEQQ7 = loadFixture("6TEQQ7"); // Week -3

describe("SR+ Validation", () => {
  it("loads fixtures correctly", () => {
    expect(SNDQJT.reservations.length).toBe(33);
    expect(_2ECMWK.reservations.length).toBe(39);
    expect(MKJWXC.reservations.length).toBe(41);
    expect(_6TEQQ7.reservations.length).toBe(37);
  });

  it("validates current week against previous weeks", () => {
    const report = validateSrPlus(SNDQJT, [_2ECMWK, MKJWXC, _6TEQQ7]);

    console.log("\n=== VALIDATION REPORT ===");
    console.log(`Total: ${report.totalPlayers}, Correct: ${report.correctCount}, Errors: ${report.errorCount}`);

    // Log all errors for review
    const errors = report.results.filter(r => r.status === "ERROR");
    console.log("\n=== ERRORS ===");
    for (const err of errors) {
      console.log(`${err.playerName}: ${err.itemName} - SR+ ${err.actualSrPlus} (expected ${err.expectedSrPlus}) - ${err.reason}`);
    }

    expect(report.totalPlayers).toBe(33);
  });
});

// Helper to trace a player's history
function tracePlayerHistory(playerName: string) {
  console.log(`\n=== HISTORY FOR ${playerName} ===`);

  const weeks = [
    { name: "SNDQJT (current)", data: SNDQJT },
    { name: "2ECMWK (week -1)", data: _2ECMWK },
    { name: "MKJWXC (week -2)", data: MKJWXC },
    { name: "6TEQQ7 (week -3)", data: _6TEQQ7 },
  ];

  for (const week of weeks) {
    const player = week.data.reservations.find(
      p => p.playerName.toLowerCase() === playerName.toLowerCase()
    );
    if (player) {
      const srPlusItem = player.items.find(i => i.srValue > 0);
      const plainItem = player.items.find(i => i.srValue === 0);
      console.log(`${week.name}:`);
      console.log(`  SR+ item: ${srPlusItem?.itemName || "none"} (${srPlusItem?.srValue || 0})`);
      console.log(`  Plain SR: ${plainItem?.itemName || "none"}`);
    } else {
      console.log(`${week.name}: NOT PRESENT`);
    }
  }
}

describe("Player History Traces", () => {
  it("traces Gzeus history", () => {
    tracePlayerHistory("Gzeus");
  });

  it("traces Mightymax history", () => {
    tracePlayerHistory("Mightymax");
  });

  it("traces Aeteis history", () => {
    tracePlayerHistory("Aeteis");
  });

  it("traces Cinamo history", () => {
    tracePlayerHistory("Cinamo");
  });

  it("traces Galedar history", () => {
    tracePlayerHistory("Galedar");
  });

  it("traces Hulreech history", () => {
    tracePlayerHistory("Hulreech");
  });

  it("traces Psst history", () => {
    tracePlayerHistory("Psst");
  });
});
