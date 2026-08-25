import type { Page } from "playwright";

import type { AgentAdapter, CompletedRun } from "../agent/contracts.js";
import { runAgentOnPage } from "../agent/runner.js";
import type { Scenario } from "../contracts/scenario.js";
import type { CurrentReplayContext, ReplayDecision } from "../contracts/replay.js";
import type { TrajectoryManifest } from "../contracts/trajectory.js";
import { evaluateReplay } from "./policy.js";

export interface ReplayRunResult {
  replayDecision: ReplayDecision;
  run: CompletedRun | null;
  sideEffectCount: number;
}

export async function runReplayOnPage(options: {
  page: Page;
  baseUrl: string;
  scenario: Scenario;
  adapter: AgentAdapter;
  manifest: TrajectoryManifest;
  currentContext: CurrentReplayContext;
  now: Date;
}): Promise<ReplayRunResult> {
  const replayDecision = evaluateReplay(options.manifest, options.currentContext, options.now);
  if (!replayDecision.sideEffectsPermitted) {
    return { replayDecision, run: null, sideEffectCount: 0 };
  }
  const run = await runAgentOnPage(options);
  return { replayDecision, run, sideEffectCount: run.trajectory.sideEffectCount };
}
