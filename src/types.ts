export interface ItemReservation {
  itemName: string;
  srValue: number; // 0 for plain SR, >0 for SR+ item
}

export interface PlayerReservation {
  playerName: string;
  items: ItemReservation[];
}

export interface RaidData {
  raidId: string;
  url: string;
  reservations: PlayerReservation[];
}

export interface ValidationResult {
  playerName: string;
  itemName: string;
  actualSrPlus: number;
  expectedSrPlus: number;
  status: "OK" | "WARNING" | "ERROR";
  reason?: string;
}

export interface ValidationReport {
  raidId: string;
  results: ValidationResult[];
  totalPlayers: number;
  correctCount: number;
  warningCount: number;
  errorCount: number;
}
