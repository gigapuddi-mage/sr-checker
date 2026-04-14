import { describe, it, expect } from "bun:test";
import { readFileSync } from "fs";
import { loadGasModule } from "./gas-loader";

const gas = loadGasModule();

// --- CSV fixture loading ---

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

type PlayerMap = Record<string, { itemName: string; srValue: number }[]>;

function loadFixture(raidId: string): PlayerMap {
  const csv = readFileSync(`test/fixtures/${raidId}.csv`, "utf-8");
  const lines = csv.trim().split("\n").slice(1); // skip header

  const playerMap: PlayerMap = {};

  for (const line of lines) {
    const fields = parseCsvLine(line);
    if (fields.length >= 9) {
      const playerName = fields[3]; // Attendee
      const itemName = fields[1]; // Item
      const srValue = parseInt(fields[8], 10) || 0; // SR+

      if (!playerMap[playerName]) {
        playerMap[playerName] = [];
      }
      playerMap[playerName].push({ itemName, srValue });
    }
  }

  return playerMap;
}

// --- Validate a full week (mirrors Code.gs runValidation logic) ---

interface ValidationResult {
  playerName: string;
  itemName: string;
  actualSrPlus: number;
  expectedSrPlus: number;
  status: "OK" | "WARNING" | "ERROR";
  reason: string;
}

function validateWeek(currentWeek: PlayerMap, previousWeeks: PlayerMap[]): ValidationResult[] {
  const results: ValidationResult[] = [];

  for (const playerName of Object.keys(currentWeek)) {
    const items = currentWeek[playerName];
    const srPlusItem = gas.getSrPlusItem(items);

    if (!srPlusItem) {
      results.push({
        playerName,
        itemName: "N/A",
        actualSrPlus: 0,
        expectedSrPlus: 0,
        status: "ERROR",
        reason: "No items found",
      });
      continue;
    }

    const validation = gas.validatePlayer(
      playerName,
      srPlusItem.itemName,
      srPlusItem.srValue,
      previousWeeks
    );

    results.push({
      playerName,
      itemName: srPlusItem.itemName,
      actualSrPlus: srPlusItem.srValue,
      expectedSrPlus: validation.expectedSrPlus,
      status: validation.status,
      reason: validation.reason,
    });
  }

  return results;
}

// --- Load fixtures ---

const SNDQJT = loadFixture("SNDQJT"); // Current week
const _2ECMWK = loadFixture("2ECMWK"); // Week -1
const MKJWXC = loadFixture("MKJWXC"); // Week -2
const _6TEQQ7 = loadFixture("6TEQQ7"); // Week -3

// --- Tests ---

describe("SR+ Validation (Code.gs)", () => {
  it("loads fixtures correctly", () => {
    expect(Object.keys(SNDQJT).length).toBe(33);
    expect(Object.keys(_2ECMWK).length).toBe(39);
    expect(Object.keys(MKJWXC).length).toBe(41);
    expect(Object.keys(_6TEQQ7).length).toBe(37);
  });

  it("validates current week against previous weeks", () => {
    const results = validateWeek(SNDQJT, [_2ECMWK, MKJWXC, _6TEQQ7]);

    const errors = results.filter((r) => r.status === "ERROR");
    const warnings = results.filter((r) => r.status === "WARNING");
    const ok = results.filter((r) => r.status === "OK");

    console.log("\n=== VALIDATION REPORT ===");
    console.log(`Total: ${results.length}, OK: ${ok.length}, Warnings: ${warnings.length}, Errors: ${errors.length}`);

    console.log("\n=== ERRORS ===");
    for (const err of errors) {
      console.log(`${err.playerName}: ${err.itemName} - SR+ ${err.actualSrPlus} (expected ${err.expectedSrPlus}) - ${err.reason}`);
    }

    expect(results.length).toBe(33);
  });

  it("getSrPlusItem returns item with srValue > 0", () => {
    const items = [
      { itemName: "Plain Item", srValue: 0 },
      { itemName: "SR+ Item", srValue: 5 },
    ];
    const result = gas.getSrPlusItem(items);
    expect(result).toEqual({ itemName: "SR+ Item", srValue: 5 });
  });

  it("getSrPlusItem returns first item when all are 0", () => {
    const items = [
      { itemName: "First Item", srValue: 0 },
      { itemName: "Second Item", srValue: 0 },
    ];
    const result = gas.getSrPlusItem(items);
    expect(result).toEqual({ itemName: "First Item", srValue: 0 });
  });

  it("getSrPlusItem returns null for empty array", () => {
    expect(gas.getSrPlusItem([])).toBeNull();
  });

  it("validates new player with SR+ = 0 as OK", () => {
    const result = gas.validatePlayer("NewGuy", "Some Item", 0, []);
    expect(result.status).toBe("OK");
    expect(result.expectedSrPlus).toBe(0);
  });

  it("validates new player with SR+ = 2 as WARNING (exalted check)", () => {
    const result = gas.validatePlayer("NewGuy", "Some Item", 2, []);
    expect(result.status).toBe("WARNING");
    expect(result.expectedSrPlus).toBe(0);
  });

  it("validates new player with SR+ = 3 as ERROR", () => {
    const result = gas.validatePlayer("NewGuy", "Some Item", 3, []);
    expect(result.status).toBe("ERROR");
    expect(result.expectedSrPlus).toBe(0);
  });

  it("validates same item continuation as previous + 1", () => {
    const previousWeeks = [{ Player1: [{ itemName: "Cool Sword", srValue: 4 }] }];
    const result = gas.validatePlayer("Player1", "Cool Sword", 5, previousWeeks);
    expect(result.status).toBe("OK");
    expect(result.expectedSrPlus).toBe(5);
  });

  it("validates item change resets to 0", () => {
    const previousWeeks = [{ Player1: [{ itemName: "Old Sword", srValue: 4 }] }];
    const result = gas.validatePlayer("Player1", "New Axe", 0, previousWeeks);
    expect(result.status).toBe("OK");
    expect(result.expectedSrPlus).toBe(0);
  });

  it("validates item change with SR+ = 2 as WARNING (exalted)", () => {
    const previousWeeks = [{ Player1: [{ itemName: "Old Sword", srValue: 4 }] }];
    const result = gas.validatePlayer("Player1", "New Axe", 2, previousWeeks);
    expect(result.status).toBe("WARNING");
    expect(result.expectedSrPlus).toBe(0);
  });

  it("validates continuation after 1 missed week", () => {
    const previousWeeks = [
      {}, // missed week
      { Player1: [{ itemName: "Cool Sword", srValue: 3 }] },
    ];
    const result = gas.validatePlayer("Player1", "Cool Sword", 4, previousWeeks);
    expect(result.status).toBe("OK");
    expect(result.expectedSrPlus).toBe(4);
  });

  it("validates continuation after 2 missed weeks", () => {
    const previousWeeks = [
      {}, // missed
      {}, // missed
      { Player1: [{ itemName: "Cool Sword", srValue: 3 }] },
    ];
    const result = gas.validatePlayer("Player1", "Cool Sword", 4, previousWeeks);
    expect(result.status).toBe("OK");
    expect(result.expectedSrPlus).toBe(4);
  });

  it("validates continuation after many missed weeks", () => {
    const previousWeeks = [
      {}, // missed week 1
      {}, // missed week 2
      {}, // missed week 3
      { Player1: [{ itemName: "Cool Sword", srValue: 5 }] }, // 4+ weeks ago
    ];
    const result = gas.validatePlayer("Player1", "Cool Sword", 6, previousWeeks);
    expect(result.status).toBe("OK");
    expect(result.expectedSrPlus).toBe(6);
  });

  it("validates continuation after 10 missed weeks", () => {
    const previousWeeks: Record<string, { itemName: string; srValue: number }[]>[] = [];
    for (let i = 0; i < 10; i++) previousWeeks.push({});
    previousWeeks.push({ Player1: [{ itemName: "Cool Sword", srValue: 3 }] });
    const result = gas.validatePlayer("Player1", "Cool Sword", 4, previousWeeks);
    expect(result.status).toBe("OK");
    expect(result.expectedSrPlus).toBe(4);
  });

  it("validates case-insensitive item name matching", () => {
    const previousWeeks = [{ Player1: [{ itemName: "COOL SWORD", srValue: 2 }] }];
    const result = gas.validatePlayer("Player1", "cool sword", 3, previousWeeks);
    expect(result.status).toBe("OK");
    expect(result.expectedSrPlus).toBe(3);
  });
});

// --- Player history traces (debugging helpers) ---

function tracePlayerHistory(playerName: string) {
  console.log(`\n=== HISTORY FOR ${playerName} ===`);

  const weeks = [
    { name: "SNDQJT (current)", data: SNDQJT },
    { name: "2ECMWK (week -1)", data: _2ECMWK },
    { name: "MKJWXC (week -2)", data: MKJWXC },
    { name: "6TEQQ7 (week -3)", data: _6TEQQ7 },
  ];

  for (const week of weeks) {
    const items = week.data[playerName];
    if (items) {
      const srPlusItem = items.find((i) => i.srValue > 0);
      const plainItem = items.find((i) => i.srValue === 0);
      console.log(`${week.name}:`);
      console.log(`  SR+ item: ${srPlusItem?.itemName || "none"} (${srPlusItem?.srValue || 0})`);
      console.log(`  Plain SR: ${plainItem?.itemName || "none"}`);
    } else {
      console.log(`${week.name}: NOT PRESENT`);
    }
  }
}

describe("Player History Traces", () => {
  it("traces Gzeus history", () => tracePlayerHistory("Gzeus"));
  it("traces Mightymax history", () => tracePlayerHistory("Mightymax"));
  it("traces Aeteis history", () => tracePlayerHistory("Aeteis"));
  it("traces Cinamo history", () => tracePlayerHistory("Cinamo"));
  it("traces Galedar history", () => tracePlayerHistory("Galedar"));
  it("traces Hulreech history", () => tracePlayerHistory("Hulreech"));
  it("traces Psst history", () => tracePlayerHistory("Psst"));
});
