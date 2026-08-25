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
  return {
    scenarioId: scenario.id,
    scenarioTitle: scenario.title,
    flow: scenario.flow,
    failureKind: scenario.failure.kind,
    riskTier: scenario.riskTier,
    taskIntent: scenario.task.intent,
    recordId: scenario.task.recordId,
    stateVersion: 1,
    sessionStatus: "active",
    record: initialRecord(scenario.flow),
    receipt: null
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
