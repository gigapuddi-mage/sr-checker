// SR+ Checker for Google Sheets
// Paste this entire file into Extensions > Apps Script, then save and refresh your sheet.
//
// To add a raid:
//   1. Create two tabs in the sheet: "<RaidName>" and "<RaidName> Results"
//   2. On the "<RaidName>" tab, fill column B starting at B2:
//        B2  = current week's raidres.top event ID (e.g. SNDQJT)
//        B3+ = previous weeks' event IDs, newest first
//   3. Add "<RaidName>" to the RAIDS array below.
//   4. Add a matching runValidation_N wrapper at the bottom of this file.
//   5. Save the Apps Script, reload the spreadsheet, and pick the raid from the
//      "SR+ Checker" menu.

var EVENT_API = "https://raidres.top/api/events/";
var RAID_DATA_URL = "https://raidres.top/raids/";

// Add new raids here. Each entry becomes a menu item and expects two tabs:
//   "<name>"          : raid IDs in column B (B2 = current week, B3+ = previous weeks)
//   "<name> Results"  : auto-created/cleared on each run
var RAIDS = ["BWL", "AQ40", "NAXX", "KARA40"];

// Module-level cache: raidId (number) -> { itemId: itemName }
var itemNameCache = {};

// ─── Menu ────────────────────────────────────────────────────────────────────

function onOpen() {
  var menu = SpreadsheetApp.getUi().createMenu("SR+ Checker");
  for (var i = 0; i < RAIDS.length; i++) {
    menu.addItem("Run " + RAIDS[i], "runValidation_" + i);
  }
  menu.addToUi();
}

// ─── Data fetching ───────────────────────────────────────────────────────────

/**
 * Fetches one raid event and returns a player map:
 *   { [playerName]: [{ itemName, srValue }, ...] }
 */
function fetchRaidData(eventId) {
  var eventResponse = UrlFetchApp.fetch(EVENT_API + eventId, { muteHttpExceptions: true });
  var eventStatus = eventResponse.getResponseCode();
  if (eventStatus < 200 || eventStatus >= 300) {
    throw new Error("Failed to fetch event " + eventId + " (HTTP " + eventStatus + ")");
  }
  var eventData = JSON.parse(eventResponse.getContentText());
  var raidId = eventData.raidId;

  // Fetch item names, using cache to avoid duplicate requests for the same raid
  if (!itemNameCache[raidId]) {
    var raidResponse = UrlFetchApp.fetch(RAID_DATA_URL + "raid_" + raidId + ".json", { muteHttpExceptions: true });
    var itemMap = {};
    var raidStatus = raidResponse.getResponseCode();
    if (raidStatus >= 200 && raidStatus < 300) {
      var raidData = JSON.parse(raidResponse.getContentText());
      for (var i = 0; i < raidData.raidItems.length; i++) {
        var item = raidData.raidItems[i];
        itemMap[item.id] = item.name;
      }
    }
    itemNameCache[raidId] = itemMap;
  }
  var itemNameMap = itemNameCache[raidId];

  // Group reservations by player
  var playerMap = {};
  var reservations = eventData.reservations;
  for (var j = 0; j < reservations.length; j++) {
    var res = reservations[j];
    if (!res.srPlus) continue;
    var playerName = res.character.name;
    var itemName = itemNameMap[res.raidItemId] || ("Unknown Item (" + res.raidItemId + ")");
    var srValue = res.srPlus.value;

    if (!playerMap[playerName]) {
      playerMap[playerName] = [];
    }
    playerMap[playerName].push({ itemName: itemName, srValue: srValue });
  }

  return playerMap;
}

// ─── Validation logic (mirrors src/validator.ts) ─────────────────────────────

/**
 * Returns the SR+ item (srValue > 0), or the first item if all are 0.
 * Returns null if items is empty.
 */
function getSrPlusItem(items) {
  if (!items || items.length === 0) return null;
  for (var i = 0; i < items.length; i++) {
    if (items[i].srValue > 0) return items[i];
  }
  return items[0];
}

/**
 * Validates one player's SR+ value against their history.
 *
 * @param {string}   playerName      - Character name
 * @param {string}   currentItemName - Item they SR+ed this week
 * @param {number}   currentSrPlus   - SR+ value this week
 * @param {Object[]} previousWeeks   - Array of playerMaps, newest → oldest
 * @returns {{ status, reason, expectedSrPlus }}
 */
function validatePlayer(playerName, currentItemName, currentSrPlus, previousWeeks) {
  // Search all previous weeks
  var foundWeekIndex = -1;
  var previousItem = null;

  for (var i = 0; i < previousWeeks.length; i++) {
    var weekMap = previousWeeks[i];
    if (weekMap[playerName]) {
      var prevSrPlusItem = getSrPlusItem(weekMap[playerName]);
      if (prevSrPlusItem) {
        foundWeekIndex = i;
        previousItem = prevSrPlusItem;
        break;
      }
    }
  }

  var expectedSrPlus;
  var isNewOrReset;
  var baseReason;

  if (foundWeekIndex === -1) {
    expectedSrPlus = 0;
    isNewOrReset = true;
    baseReason = "New player";
  } else {
    // Found in recent weeks
    var sameItem =
      currentItemName.toLowerCase().trim() === previousItem.itemName.toLowerCase().trim();

    if (sameItem) {
      expectedSrPlus = previousItem.srValue + 1;
      isNewOrReset = false;
      baseReason = foundWeekIndex === 0 ? "" : "Continued from " + (foundWeekIndex + 1) + " weeks ago";
    } else {
      expectedSrPlus = 0;
      isNewOrReset = true;
      baseReason = 'Item changed from "' + previousItem.itemName + '"';
    }
  }

  // Determine status
  var status, reason;

  if (currentSrPlus === expectedSrPlus) {
    status = "OK";
    reason = baseReason || "";
  } else if (isNewOrReset && currentSrPlus === 2) {
    // Exalted players legitimately start at 2
    status = "WARNING";
    reason = "Check for Exalted Status (" + baseReason + ")";
  } else {
    status = "ERROR";
    reason = "Expected " + expectedSrPlus + ", got " + currentSrPlus +
             (baseReason ? " (" + baseReason + ")" : "");
  }

  return { status: status, reason: reason, expectedSrPlus: expectedSrPlus };
}

// ─── Main entry point ────────────────────────────────────────────────────────

function runValidationForRaid(raidName) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();

  // Read the raid's input sheet
  var configSheet = ss.getSheetByName(raidName);
  if (!configSheet) {
    ui.alert("Please create a '" + raidName + "' tab with raid IDs starting in B2.");
    return;
  }

  var lastRow = configSheet.getLastRow();
  var raidIdValues = lastRow >= 2 ? configSheet.getRange("B2:B" + lastRow).getValues() : [];
  var raidIds = [];
  for (var i = 0; i < raidIdValues.length; i++) {
    var id = String(raidIdValues[i][0]).trim();
    if (id && id !== "") raidIds.push(id);
  }

  if (raidIds.length === 0) {
    ui.alert("No raid IDs found in '" + raidName + "' tab (column B).");
    return;
  }

  var currentRaidId = raidIds[0];
  var previousRaidIds = raidIds.slice(1);

  // Fetch current raid
  var currentRaidMap;
  try {
    currentRaidMap = fetchRaidData(currentRaidId);
  } catch (e) {
    ui.alert("Failed to fetch current " + raidName + " raid " + currentRaidId + ":\n" + e.message);
    return;
  }

  // Fetch previous raids (failures become empty maps so validation still runs)
  var previousWeekMaps = [];
  for (var p = 0; p < previousRaidIds.length; p++) {
    try {
      previousWeekMaps.push(fetchRaidData(previousRaidIds[p]));
    } catch (e) {
      Logger.log("Failed to fetch previous raid " + previousRaidIds[p] + ": " + e.message);
      previousWeekMaps.push({});
    }
  }

  // Validate every player in the current raid
  var results = [];
  var playerNames = Object.keys(currentRaidMap);
  for (var n = 0; n < playerNames.length; n++) {
    var playerName = playerNames[n];
    var items = currentRaidMap[playerName];
    var srPlusItem = getSrPlusItem(items);

    if (!srPlusItem) {
      results.push({
        playerName: playerName,
        itemName: "N/A",
        actualSrPlus: 0,
        expectedSrPlus: 0,
        status: "ERROR",
        reason: "No items found",
      });
      continue;
    }

    var validation = validatePlayer(
      playerName,
      srPlusItem.itemName,
      srPlusItem.srValue,
      previousWeekMaps
    );

    results.push({
      playerName: playerName,
      itemName: srPlusItem.itemName,
      actualSrPlus: srPlusItem.srValue,
      expectedSrPlus: validation.expectedSrPlus,
      status: validation.status,
      reason: validation.reason,
    });
  }

  // Sort: ERROR → WARNING → OK, then A-Z by name
  var statusOrder = { ERROR: 0, WARNING: 1, OK: 2 };
  results.sort(function(a, b) {
    var diff = statusOrder[a.status] - statusOrder[b.status];
    if (diff !== 0) return diff;
    return a.playerName.localeCompare(b.playerName);
  });

  // ── Write Results sheet ──────────────────────────────────────────────────

  var resultsSheetName = raidName + " Results";
  var resultsSheet = ss.getSheetByName(resultsSheetName);
  if (!resultsSheet) {
    resultsSheet = ss.insertSheet(resultsSheetName);
  } else {
    resultsSheet.clear();
  }

  // Header
  var headers = ["Player", "Item", "SR+", "Expected", "Status", "Notes"];
  var headerRange = resultsSheet.getRange(1, 1, 1, headers.length);
  headerRange.setValues([headers]);
  headerRange.setFontWeight("bold").setBackground("#CCCCCC");

  // Data rows + row coloring
  if (results.length > 0) {
    var rowData = [];
    for (var r = 0; r < results.length; r++) {
      rowData.push([
        results[r].playerName,
        results[r].itemName,
        results[r].actualSrPlus,
        results[r].expectedSrPlus,
        results[r].status,
        results[r].reason || "",
      ]);
    }
    resultsSheet.getRange(2, 1, rowData.length, headers.length).setValues(rowData);

    for (var r2 = 0; r2 < results.length; r2++) {
      var bgColor;
      if      (results[r2].status === "ERROR")   bgColor = "#FFCCCC";
      else if (results[r2].status === "WARNING") bgColor = "#FFFFCC";
      else                                        bgColor = "#CCFFCC";
      resultsSheet.getRange(r2 + 2, 1, 1, headers.length).setBackground(bgColor);
    }
  }

  // Summary row (merged, bold)
  var errorCount   = results.filter(function(r) { return r.status === "ERROR";   }).length;
  var warningCount = results.filter(function(r) { return r.status === "WARNING"; }).length;
  var okCount      = results.filter(function(r) { return r.status === "OK";      }).length;
  var total        = results.length;

  var summaryText = okCount + "/" + total + " OK, " +
    warningCount + " warning" + (warningCount !== 1 ? "s" : "") + ", " +
    errorCount   + " error"   + (errorCount   !== 1 ? "s" : "");

  var summaryRow = results.length + 2;
  resultsSheet.getRange(summaryRow, 1, 1, headers.length).merge();
  resultsSheet.getRange(summaryRow, 1).setValue(summaryText).setFontWeight("bold");

  // Auto-resize columns
  for (var col = 1; col <= headers.length; col++) {
    resultsSheet.autoResizeColumn(col);
  }

  // Switch to Results sheet and notify
  ss.setActiveSheet(resultsSheet);
  ui.alert("Validation complete for " + raidName + "!\n\n" + summaryText);
}

// ─── Menu dispatchers ────────────────────────────────────────────────────────
// Apps Script menus require named global functions — one wrapper per RAIDS entry.
// Add runValidation_4, runValidation_5, ... as you grow RAIDS.

function runValidation_0() { runValidationForRaid(RAIDS[0]); }
function runValidation_1() { runValidationForRaid(RAIDS[1]); }
function runValidation_2() { runValidationForRaid(RAIDS[2]); }
function runValidation_3() { runValidationForRaid(RAIDS[3]); }
