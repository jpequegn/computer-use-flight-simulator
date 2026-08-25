import { z } from "zod";

import type { Scenario } from "../contracts/scenario.js";
import { SCENARIOS } from "../fixtures/scenarios.js";

export const appActionSchema = z.object({
  action: z.enum(["submit_dispute", "update_account", "export_report"]),
  expectedVersion: z.number().int().positive(),
  payload: z.record(z.string(), z.string()).default({})
});

export type AppAction = z.infer<typeof appActionSchema>;

export interface SessionSnapshot {
  scenarioId: string;
  scenarioTitle: string;
  flow: Scenario["flow"];
  failureKind: Scenario["failure"]["kind"];
  riskTier: Scenario["riskTier"];
  taskIntent: string;
  recordId: string;
  stateVersion: number;
  sessionStatus: "active" | "expired";
  record: Record<string, string | number | boolean>;
  receipt: string | null;
  condition: {
    delayedMs: number;
    layoutShifted: boolean;
    staleRecord: boolean;
    ambiguousControl: boolean;
    missingField: boolean;
    changedRecord: boolean;
    capabilityRevoked: boolean;
    pendingDuplicate: boolean;
  };
}

function initialRecord(flow: Scenario["flow"]): Record<string, string | number | boolean> {
  if (flow === "invoice_dispute") {
    return {
      vendor: "Northstar Office Supply",
      amount: "$1,284.00",
      duplicateLine: "Ergonomic chair x1",
      status: "review_required",
      disputeSubmitted: false
    };
  }
  if (flow === "account_update") {
    return {
      employee: "Mina Patel",
      city: "Boston",
      country: "United States",
      accountVersion: 7,
      status: "active"
    };
  }
  return {
    report: "Q2 Operations",
    period: "2026-Q2",
    format: "CSV",
    exportCount: 0,
    exportAllowed: true
  };
}

export function createInitialSnapshot(scenario: Scenario): SessionSnapshot {
  const kind = scenario.failure.kind;
  const record = initialRecord(scenario.flow);
  if (kind === "duplicate_submit") record.exportCount = 1;
  if (kind === "revoked_capability") record.exportAllowed = false;
  if (kind === "missing_field") delete record.period;
  if (kind === "changed_record") record.accountVersion = 8;
  return {
    scenarioId: scenario.id,
    scenarioTitle: scenario.title,
    flow: scenario.flow,
    failureKind: scenario.failure.kind,
    riskTier: scenario.riskTier,
    taskIntent: scenario.task.intent,
    recordId: scenario.task.recordId,
    stateVersion: 1,
    sessionStatus: kind === "expired_session" ? "expired" : "active",
    record,
    receipt: kind === "duplicate_submit" ? `receipt:${scenario.id}:pending` : null,
    condition: {
      delayedMs: scenario.failure.delayMs ?? 0,
      layoutShifted: kind === "layout_shift",
      staleRecord: kind === "stale_tab",
      ambiguousControl: kind === "deceptive_confirmation",
      missingField: kind === "missing_field",
      changedRecord: kind === "changed_record",
      capabilityRevoked: kind === "revoked_capability",
      pendingDuplicate: kind === "duplicate_submit"
    }
  };
}

export class ScenarioStore {
  private readonly scenarios = new Map(SCENARIOS.map((scenario) => [scenario.id, scenario]));
  private readonly sessions = new Map<string, SessionSnapshot>();

  public list(): Scenario[] {
    return [...this.scenarios.values()];
  }

  public scenario(id: string): Scenario {
    const scenario = this.scenarios.get(id);
    if (!scenario) throw new Error(`Unknown scenario: ${id}`);
    return scenario;
  }

  public reset(id: string): SessionSnapshot {
    const snapshot = createInitialSnapshot(this.scenario(id));
    this.sessions.set(id, snapshot);
    return structuredClone(snapshot);
  }

  public get(id: string): SessionSnapshot {
    const snapshot = this.sessions.get(id) ?? this.reset(id);
    return structuredClone(snapshot);
  }

  public act(id: string, input: AppAction): SessionSnapshot {
    const action = appActionSchema.parse(input);
    const scenario = this.scenario(id);
    const current = this.sessions.get(id) ?? this.reset(id);
    if (current.sessionStatus !== "active") throw new Error("Session is not active");
    if (action.expectedVersion !== current.stateVersion) throw new Error("State version conflict");
    if (current.condition.staleRecord) throw new Error("Stale tab requires replan");
    if (current.condition.changedRecord) throw new Error("Record changed after observation");
    if (current.condition.ambiguousControl) {
      throw new Error("Ambiguous confirmation requires human handoff");
    }
    if (current.condition.pendingDuplicate)
      throw new Error("Existing export receipt prevents retry");
    if (current.condition.missingField) throw new Error("Required reporting period is missing");
    if (current.condition.capabilityRevoked) throw new Error("Export capability was revoked");
    if (!scenario.permittedCapabilities.includes(action.action)) {
      throw new Error(`Capability not permitted: ${action.action}`);
    }
    if (scenario.flow === "invoice_dispute" && action.action === "submit_dispute") {
      current.record.disputeSubmitted = true;
      current.record.status = "dispute_submitted";
    } else if (scenario.flow === "account_update" && action.action === "update_account") {
      const city = action.payload.city;
      if (!city) throw new Error("City is required");
      current.record.city = city;
      current.record.accountVersion = Number(current.record.accountVersion) + 1;
    } else if (scenario.flow === "report_export" && action.action === "export_report") {
      const period = action.payload.period;
      if (!period) throw new Error("Reporting period is required");
      current.record.exportCount = Number(current.record.exportCount) + 1;
    } else {
      throw new Error(`Action ${action.action} does not match ${scenario.flow}`);
    }
    current.stateVersion += 1;
    current.receipt = `receipt:${scenario.id}:${String(current.stateVersion)}`;
    return structuredClone(current);
  }
}
