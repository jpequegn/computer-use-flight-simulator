import { describe, expect, it } from "vitest";

import { TrajectoryBuilder } from "../src/agent/trajectory.js";
import type { CurrentReplayContext } from "../src/contracts/replay.js";
import { SCENARIOS } from "../src/fixtures/scenarios.js";
import { contentId } from "../src/lib/canonical-json.js";
import {
  createReplayManifest,
  currentReplayContext,
  evaluateReplay,
  uiFingerprintFor
} from "../src/replay/policy.js";
import { createInitialSnapshot } from "../src/server/state.js";

function fixture() {
  const scenario = SCENARIOS.find((item) => item.id === "invoice-clean");
  if (!scenario) throw new Error("Missing fixture");
  const snapshot = createInitialSnapshot(scenario);
  const builder = new TrajectoryBuilder();
  builder.record(
    {
      action: "click",
      target: "Submit dispute",
      capability: "submit_dispute",
      result: "succeeded",
      reasonCode: "permitted_action",
      evidence: []
    },
    true
  );
  builder.record({
    action: "claim_complete",
    target: "task",
    result: "succeeded",
    reasonCode: "receipt_verified",
    evidence: [
      {
        evidenceId: contentId("receipt"),
        kind: "action_receipt",
        label: "final-decision",
        path: "evidence/receipt.json"
      }
    ]
  });
  const trajectory = builder.finish({
    scenario,
    adapter: { name: "fixture", version: "1" },
    finalAction: "complete",
    outcome: "completed"
  });
  const manifest = createReplayManifest({
    scenario,
    trajectory,
    stateVersion: snapshot.stateVersion,
    uiFingerprint: uiFingerprintFor(snapshot),
    expiresAt: "2026-09-01T00:00:00.000Z"
  });
  return { scenario, snapshot, manifest, context: currentReplayContext(scenario, snapshot) };
}

describe("replay precondition policy", () => {
  it("allows only an exact compatible context and records every check", () => {
    const { manifest, context } = fixture();
    const first = evaluateReplay(manifest, context, new Date("2026-08-25T00:00:00.000Z"));
    const second = evaluateReplay(manifest, context, new Date("2026-08-25T00:00:00.000Z"));
    expect(first).toEqual(second);
    expect(first).toMatchObject({
      decision: "replay_allowed",
      sideEffectsPermitted: true,
      reasonCodes: ["all_preconditions_match"]
    });
    expect(first.policyEvidence).toHaveLength(13);
    expect(first.policyEvidence.every((item) => item.passed)).toBe(true);
  });

  const invalidContexts: [
    string,
    (context: CurrentReplayContext) => CurrentReplayContext,
    string,
    "replan_required" | "human_handoff"
  ][] = [
    [
      "changed layout",
      (context) => ({ ...context, uiFingerprint: contentId("different-layout") }),
      "layout_changed",
      "replan_required"
    ],
    [
      "expired session",
      (context) => ({ ...context, sessionStatus: "expired" }),
      "session_not_active",
      "human_handoff"
    ],
    [
      "stale session",
      (context) => ({ ...context, sessionStatus: "stale" }),
      "session_not_active",
      "human_handoff"
    ],
    [
      "changed record version",
      (context) => ({ ...context, stateVersion: context.stateVersion + 1, recordChanged: true }),
      "state_version_changed",
      "human_handoff"
    ],
    [
      "revoked capability",
      (context) => ({ ...context, permittedCapabilities: ["view_invoice"] }),
      "capability_scope_changed",
      "human_handoff"
    ],
    [
      "mismatched intent",
      (context) => ({ ...context, taskIntent: "Approve the whole invoice" }),
      "intent_mismatch",
      "human_handoff"
    ],
    [
      "ambiguous controls",
      (context) => ({ ...context, ambiguousControls: true }),
      "ambiguous_controls",
      "human_handoff"
    ],
    [
      "missing required evidence",
      (context) => ({ ...context, evidenceLabels: [] }),
      "required_evidence_unavailable",
      "replan_required"
    ],
    [
      "changed application version",
      (context) => ({ ...context, appVersion: "2.0.0" }),
      "app_version_changed",
      "replan_required"
    ]
  ];

  it.each(invalidContexts)("denies %s before side effects", (_name, mutate, reason, decision) => {
    const { manifest, context } = fixture();
    const result = evaluateReplay(manifest, mutate(context), new Date("2026-08-25T00:00:00.000Z"));
    expect(result.decision).toBe(decision);
    expect(result.sideEffectsPermitted).toBe(false);
    expect(result.reasonCodes).toContain(reason);
    expect(result.policyEvidence.find((item) => item.reasonCode === reason)?.passed).toBe(false);
  });

  it("denies an expired manifest", () => {
    const { manifest, context } = fixture();
    const result = evaluateReplay(manifest, context, new Date("2026-09-02T00:00:00.000Z"));
    expect(result).toMatchObject({
      decision: "human_handoff",
      sideEffectsPermitted: false,
      reasonCodes: ["manifest_expired"]
    });
  });
});
