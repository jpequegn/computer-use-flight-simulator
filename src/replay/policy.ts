import type { Scenario } from "../contracts/scenario.js";
import {
  currentReplayContextSchema,
  replayDecisionSchema,
  type CurrentReplayContext,
  type ReplayDecision,
  type ReplayPolicyEvidence
} from "../contracts/replay.js";
import {
  trajectoryManifestSchema,
  trajectorySchema,
  type Trajectory,
  type TrajectoryManifest
} from "../contracts/trajectory.js";
import { contentId } from "../lib/canonical-json.js";
import type { SessionSnapshot } from "../server/state.js";

type CheckInput = Omit<ReplayPolicyEvidence, "evidenceId">;

const humanHandoffReasons = new Set([
  "scenario_mismatch",
  "scenario_definition_changed",
  "intent_mismatch",
  "risk_tier_changed",
  "state_version_changed",
  "capability_scope_changed",
  "session_not_active",
  "record_changed",
  "ambiguous_controls",
  "manifest_expired"
]);

function encoded(value: unknown): string {
  if (Array.isArray(value)) return JSON.stringify((value as unknown[]).map(String).sort());
  return String(value);
}

function check(
  field: ReplayPolicyEvidence["field"],
  expected: unknown,
  actual: unknown,
  passed: boolean,
  reasonCode: string
): ReplayPolicyEvidence {
  const draft: CheckInput = {
    field,
    expected: encoded(expected),
    actual: encoded(actual),
    passed,
    reasonCode
  };
  return { ...draft, evidenceId: contentId(draft) };
}

export function uiFingerprintFor(snapshot: SessionSnapshot): string {
  return contentId({
    flow: snapshot.flow,
    layoutShifted: snapshot.condition.layoutShifted,
    ambiguousControl: snapshot.condition.ambiguousControl,
    missingField: snapshot.condition.missingField,
    availableRecordFields: Object.keys(snapshot.record).sort()
  });
}

export function currentReplayContext(
  scenario: Scenario,
  snapshot: SessionSnapshot
): CurrentReplayContext {
  const permittedCapabilities = snapshot.condition.capabilityRevoked
    ? scenario.permittedCapabilities.filter((capability) => capability !== "export_report")
    : scenario.permittedCapabilities;
  return currentReplayContextSchema.parse({
    schemaVersion: 1,
    scenarioId: scenario.id,
    scenarioContentId: contentId(scenario),
    appVersion: scenario.appVersion,
    taskIntent: snapshot.taskIntent,
    riskTier: snapshot.riskTier,
    stateVersion: snapshot.stateVersion,
    uiFingerprint: uiFingerprintFor(snapshot),
    permittedCapabilities,
    evidenceLabels: scenario.requiredEvidence.map((item) => item.label),
    sessionStatus: snapshot.condition.staleRecord ? "stale" : snapshot.sessionStatus,
    recordChanged: snapshot.condition.changedRecord,
    ambiguousControls: snapshot.condition.ambiguousControl
  });
}

export function createReplayManifest(options: {
  scenario: Scenario;
  trajectory: Trajectory;
  stateVersion: number;
  uiFingerprint: string;
  expiresAt: string;
}): TrajectoryManifest {
  const trajectory = trajectorySchema.parse(options.trajectory);
  const scenarioContentId = contentId(options.scenario);
  if (
    trajectory.scenarioId !== options.scenario.id ||
    trajectory.scenarioContentId !== scenarioContentId
  ) {
    throw new Error("Trajectory does not belong to the supplied scenario definition");
  }
  const draft = {
    schemaVersion: 1 as const,
    trajectoryId: trajectory.trajectoryId,
    scenarioId: options.scenario.id,
    scenarioSchemaVersion: options.scenario.schemaVersion,
    scenarioContentId,
    appVersion: options.scenario.appVersion,
    taskIntent: options.scenario.task.intent,
    riskTier: options.scenario.riskTier,
    requiredStateVersion: options.stateVersion,
    requiredUiFingerprint: options.uiFingerprint,
    permittedCapabilities: options.scenario.permittedCapabilities,
    evidenceLabels: options.scenario.requiredEvidence
      .filter((item) => item.required)
      .map((item) => item.label),
    expiresAt: options.expiresAt
  };
  return trajectoryManifestSchema.parse({ ...draft, manifestId: contentId(draft) });
}

export function evaluateReplay(
  manifestInput: TrajectoryManifest,
  contextInput: CurrentReplayContext,
  now: Date
): ReplayDecision {
  const manifest = trajectoryManifestSchema.parse(manifestInput);
  const context = currentReplayContextSchema.parse(contextInput);
  const checks = [
    check(
      "scenario_id",
      manifest.scenarioId,
      context.scenarioId,
      manifest.scenarioId === context.scenarioId,
      "scenario_mismatch"
    ),
    check(
      "scenario_content_id",
      manifest.scenarioContentId,
      context.scenarioContentId,
      manifest.scenarioContentId === context.scenarioContentId,
      "scenario_definition_changed"
    ),
    check(
      "app_version",
      manifest.appVersion,
      context.appVersion,
      manifest.appVersion === context.appVersion,
      "app_version_changed"
    ),
    check(
      "task_intent",
      manifest.taskIntent,
      context.taskIntent,
      manifest.taskIntent === context.taskIntent,
      "intent_mismatch"
    ),
    check(
      "risk_tier",
      manifest.riskTier,
      context.riskTier,
      manifest.riskTier === context.riskTier,
      "risk_tier_changed"
    ),
    check(
      "state_version",
      manifest.requiredStateVersion,
      context.stateVersion,
      manifest.requiredStateVersion === context.stateVersion,
      "state_version_changed"
    ),
    check(
      "ui_fingerprint",
      manifest.requiredUiFingerprint,
      context.uiFingerprint,
      manifest.requiredUiFingerprint === context.uiFingerprint,
      "layout_changed"
    ),
    check(
      "capability_scope",
      manifest.permittedCapabilities,
      context.permittedCapabilities,
      encoded(manifest.permittedCapabilities) === encoded(context.permittedCapabilities),
      "capability_scope_changed"
    ),
    check(
      "evidence_requirements",
      manifest.evidenceLabels,
      context.evidenceLabels,
      manifest.evidenceLabels.every((label) => context.evidenceLabels.includes(label)),
      "required_evidence_unavailable"
    ),
    check(
      "session_status",
      "active",
      context.sessionStatus,
      context.sessionStatus === "active",
      "session_not_active"
    ),
    check("record_changed", false, context.recordChanged, !context.recordChanged, "record_changed"),
    check(
      "ambiguous_controls",
      false,
      context.ambiguousControls,
      !context.ambiguousControls,
      "ambiguous_controls"
    ),
    check(
      "expiry",
      `after:${now.toISOString()}`,
      manifest.expiresAt,
      new Date(manifest.expiresAt) > now,
      "manifest_expired"
    )
  ];
  const failures = checks.filter((item) => !item.passed);
  const reasonCodes = failures.map((item) => item.reasonCode);
  const decision =
    failures.length === 0
      ? "replay_allowed"
      : reasonCodes.some((reason) => humanHandoffReasons.has(reason))
        ? "human_handoff"
        : "replan_required";
  const draft = {
    schemaVersion: 1 as const,
    manifestId: manifest.manifestId,
    decision,
    sideEffectsPermitted: decision === "replay_allowed",
    reasonCodes: failures.length === 0 ? ["all_preconditions_match"] : reasonCodes,
    policyEvidence: checks
  };
  return replayDecisionSchema.parse({ ...draft, decisionId: contentId(draft) });
}
