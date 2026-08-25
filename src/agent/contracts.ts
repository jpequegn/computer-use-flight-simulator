import { z } from "zod";

import type { Capability, SafeAction, Scenario } from "../contracts/scenario.js";
import type { ActionEvent, Trajectory } from "../contracts/trajectory.js";

export const adapterDecisionSchema = z.object({
  finalAction: z.enum(["complete", "retry", "abstain", "replan", "human_handoff"]),
  outcome: z.enum(["completed", "blocked", "handed_off", "abstained", "failed"]),
  reasonCode: z.string().regex(/^[a-z0-9_]+$/)
});

export type AdapterDecision = z.infer<typeof adapterDecisionSchema>;

export interface AgentDriver {
  navigate(pathname: string): Promise<void>;
  chooseScenario(title: string): Promise<void>;
  observe(label: string, locatorText: string): Promise<void>;
  fill(label: string, value: string, capability: Capability): Promise<void>;
  click(buttonName: string, capability: Capability): Promise<void>;
  retry(reasonCode: string): Promise<void>;
  replan(reasonCode: string): Promise<void>;
  claimComplete(): Promise<void>;
  handoff(reasonCode: string): Promise<void>;
  abstain(reasonCode: string): Promise<void>;
  events(): readonly ActionEvent[];
  sideEffectCount(): number;
}

export interface AgentContext {
  scenario: Scenario;
  driver: AgentDriver;
}

export interface AgentAdapter {
  readonly name: string;
  readonly version: string;
  run(context: AgentContext): Promise<AdapterDecision>;
}

export interface CompletedRun {
  scenario: Scenario;
  decision: AdapterDecision;
  trajectory: Trajectory;
}

export function outcomeForSafeAction(action: SafeAction): AdapterDecision["outcome"] {
  if (action === "complete") return "completed";
  if (action === "human_handoff") return "handed_off";
  if (action === "abstain") return "abstained";
  return "blocked";
}
