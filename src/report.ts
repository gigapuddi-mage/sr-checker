import type { ValidationReport, ValidationResult } from "./types";

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + "...";
}

function padRight(str: string, len: number): string {
  return str.padEnd(len);
}

function padLeft(str: string, len: number): string {
  return str.padStart(len);
}

function statusOrder(status: string): number {
  if (status === "ERROR") return 0;
  if (status === "WARNING") return 1;
  return 2;
}

export function formatReport(report: ValidationReport): string {
  const lines: string[] = [];

  lines.push("");
  lines.push(`SR+ Validation Report - Raid ${report.raidId}`);
  lines.push("=".repeat(80));
  lines.push("");

  // Column widths
  const nameWidth = 18;
  const itemWidth = 30;
  const srWidth = 5;
  const expectedWidth = 8;
  const statusWidth = 16;

  // Header
  const header = [
    padRight("Player Name", nameWidth),
    padRight("Item", itemWidth),
    padLeft("SR+", srWidth),
    padLeft("Expected", expectedWidth),
    padRight("Status", statusWidth),
  ].join(" | ");

  lines.push(header);
  lines.push("-".repeat(header.length));

  // Sort results: errors first, then warnings, then OK, then alphabetically
  const sortedResults = [...report.results].sort((a, b) => {
    const orderDiff = statusOrder(a.status) - statusOrder(b.status);
    if (orderDiff !== 0) return orderDiff;
    return a.playerName.localeCompare(b.playerName);
  });

  for (const result of sortedResults) {
    const statusDisplay = formatStatus(result);
    const row = [
      padRight(truncate(result.playerName, nameWidth), nameWidth),
      padRight(truncate(result.itemName, itemWidth), itemWidth),
      padLeft(result.actualSrPlus.toString(), srWidth),
      padLeft(result.expectedSrPlus.toString(), expectedWidth),
      statusDisplay,
    ].join(" | ");

    lines.push(row);
  }

  lines.push("");
  lines.push("-".repeat(80));

  // Summary
  const parts: string[] = [];
  parts.push(`${report.correctCount}/${report.totalPlayers} OK`);
  if (report.warningCount > 0) {
    parts.push(`${report.warningCount} warnings`);
  }
  if (report.errorCount > 0) {
    parts.push(`${report.errorCount} errors`);
  }
  lines.push(`Summary: ${parts.join(", ")}`);

  lines.push("");

  return lines.join("\n");
}

function formatStatus(result: ValidationResult): string {
  if (result.status === "OK") {
    if (result.reason) {
      return `OK (${result.reason})`;
    }
    return "OK";
  }

  if (result.status === "WARNING") {
    return `WARN: ${result.reason || "check needed"}`;
  }

  // For errors, show what went wrong
  return `ERROR: ${result.reason || "mismatch"}`;
}

export function printReport(report: ValidationReport): void {
  console.log(formatReport(report));
}

export function formatSummary(reports: ValidationReport[]): string {
  const lines: string[] = [];

  lines.push("");
  lines.push("=".repeat(80));
  lines.push("OVERALL SUMMARY");
  lines.push("=".repeat(80));
  lines.push("");

  let totalErrors = 0;
  let totalWarnings = 0;
  let totalPlayers = 0;

  for (const report of reports) {
    totalErrors += report.errorCount;
    totalWarnings += report.warningCount;
    totalPlayers += report.totalPlayers;

    const parts: string[] = [];
    if (report.warningCount > 0) parts.push(`${report.warningCount} warnings`);
    if (report.errorCount > 0) parts.push(`${report.errorCount} errors`);
    const status = parts.length === 0 ? "OK" : parts.join(", ");

    lines.push(`  Raid ${report.raidId}: ${report.totalPlayers} players, ${status}`);
  }

  lines.push("");
  lines.push(`Total: ${totalPlayers} players, ${totalWarnings} warnings, ${totalErrors} errors`);
  lines.push("");

  return lines.join("\n");
}
