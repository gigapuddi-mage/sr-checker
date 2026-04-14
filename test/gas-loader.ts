import { readFileSync } from "fs";
import { join } from "path";

// Stub GAS globals so Code.gs can be evaluated in Bun
const gasStubs = {
  SpreadsheetApp: {
    getUi: () => ({
      createMenu: () => ({ addItem: () => ({ addToUi: () => {} }) }),
    }),
    getActiveSpreadsheet: () => null,
  },
  UrlFetchApp: {
    fetch: () => {
      throw new Error("UrlFetchApp not available in tests");
    },
  },
  Logger: { log: console.log },
};

export interface GasModule {
  getSrPlusItem: (items: { itemName: string; srValue: number }[]) => { itemName: string; srValue: number } | null;
  validatePlayer: (
    playerName: string,
    currentItemName: string,
    currentSrPlus: number,
    previousWeeks: Record<string, { itemName: string; srValue: number }[]>[]
  ) => { status: "OK" | "WARNING" | "ERROR"; reason: string; expectedSrPlus: number };
}

export function loadGasModule(): GasModule {
  const source = readFileSync(join(__dirname, "..", "google-sheets", "Code.gs"), "utf-8");

  const fn = new Function(
    ...Object.keys(gasStubs),
    source + "\nreturn { getSrPlusItem, validatePlayer };"
  );

  return fn(...Object.values(gasStubs));
}
