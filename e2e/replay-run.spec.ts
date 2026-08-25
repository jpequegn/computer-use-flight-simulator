import { expect, test } from "@playwright/test";

import { runAgentOnPage } from "../src/agent/runner.js";
import { ScriptedPolicyAdapter } from "../src/agent/scripted-adapter.js";
import type { CurrentReplayContext } from "../src/contracts/replay.js";
import { SCENARIOS } from "../src/fixtures/scenarios.js";
import { contentId } from "../src/lib/canonical-json.js";
import { runReplayOnPage } from "../src/replay/browser-runner.js";
import {
  createReplayManifest,
  currentReplayContext,
  uiFingerprintFor
} from "../src/replay/policy.js";
import type { SessionSnapshot } from "../src/server/state.js";

const now = new Date("2026-08-25T00:00:00.000Z");

async function reset(baseURL: string, scenarioId: string): Promise<SessionSnapshot> {
  const response = await fetch(`${baseURL}/api/sessions/${scenarioId}/reset`, { method: "POST" });
  return (await response.json()) as SessionSnapshot;
}

test("an exact replay executes once through the browser", async ({ page, baseURL }) => {
  const scenario = SCENARIOS.find((item) => item.id === "invoice-clean");
  if (!scenario || !baseURL) throw new Error("Missing browser test configuration");
  const initial = await reset(baseURL, scenario.id);
  const source = await runAgentOnPage({
    page,
    baseUrl: baseURL,
    scenario,
    adapter: new ScriptedPolicyAdapter()
  });
  const manifest = createReplayManifest({
    scenario,
    trajectory: source.trajectory,
    stateVersion: initial.stateVersion,
    uiFingerprint: uiFingerprintFor(initial),
    expiresAt: "2026-09-01T00:00:00.000Z"
  });
  const current = await reset(baseURL, scenario.id);
  const result = await runReplayOnPage({
    page,
    baseUrl: baseURL,
    scenario,
    adapter: new ScriptedPolicyAdapter(),
    manifest,
    currentContext: currentReplayContext(scenario, current),
    now
  });
  expect(result.replayDecision.decision).toBe("replay_allowed");
  expect(result.sideEffectCount).toBe(1);
  const after = (await (
    await fetch(`${baseURL}/api/sessions/${scenario.id}`)
  ).json()) as SessionSnapshot;
  expect(after.stateVersion).toBe(2);
});

test("invalid replay variants never reach a browser side effect", async ({ page, baseURL }) => {
  const scenario = SCENARIOS.find((item) => item.id === "invoice-clean");
  if (!scenario || !baseURL) throw new Error("Missing browser test configuration");
  const initial = await reset(baseURL, scenario.id);
  const source = await runAgentOnPage({
    page,
    baseUrl: baseURL,
    scenario,
    adapter: new ScriptedPolicyAdapter()
  });
  const manifest = createReplayManifest({
    scenario,
    trajectory: source.trajectory,
    stateVersion: initial.stateVersion,
    uiFingerprint: uiFingerprintFor(initial),
    expiresAt: "2026-09-01T00:00:00.000Z"
  });
  const variants: ((context: CurrentReplayContext) => CurrentReplayContext)[] = [
    (context) => ({ ...context, uiFingerprint: contentId("changed-layout") }),
    (context) => ({ ...context, sessionStatus: "expired" }),
    (context) => ({ ...context, stateVersion: 2, recordChanged: true }),
    (context) => ({ ...context, permittedCapabilities: ["view_invoice"] }),
    (context) => ({ ...context, taskIntent: "Approve the full invoice" }),
    (context) => ({ ...context, ambiguousControls: true })
  ];

  for (const mutate of variants) {
    const before = await reset(baseURL, scenario.id);
    const result = await runReplayOnPage({
      page,
      baseUrl: baseURL,
      scenario,
      adapter: new ScriptedPolicyAdapter(),
      manifest,
      currentContext: mutate(currentReplayContext(scenario, before)),
      now
    });
    const after = (await (
      await fetch(`${baseURL}/api/sessions/${scenario.id}`)
    ).json()) as SessionSnapshot;
    expect(result.replayDecision.decision).not.toBe("replay_allowed");
    expect(result.sideEffectCount).toBe(0);
    expect(result.run).toBeNull();
    expect(after.stateVersion).toBe(before.stateVersion);
    expect(after.record).toEqual(before.record);
  }
});
