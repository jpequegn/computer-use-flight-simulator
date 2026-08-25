export interface ScenarioSummary {
  id: string;
  title: string;
  description: string;
  flow: "invoice_dispute" | "account_update" | "report_export";
  failureKind: string;
  riskTier: "read_only" | "reversible_write" | "irreversible";
  taskIntent: string;
}

export interface SessionSnapshot {
  scenarioId: string;
  scenarioTitle: string;
  flow: ScenarioSummary["flow"];
  failureKind: string;
  riskTier: ScenarioSummary["riskTier"];
  taskIntent: string;
  recordId: string;
  stateVersion: number;
  sessionStatus: "active" | "expired";
  record: Record<string, string | number | boolean>;
  receipt: string | null;
}
