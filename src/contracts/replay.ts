import { z } from "zod";

import { capabilitySchema, riskTierSchema } from "./scenario.js";

export const currentReplayContextSchema = z.object({
  schemaVersion: z.literal(1),
  scenarioId: z.string().min(1),
  scenarioContentId: z.string().regex(/^[a-f0-9]{64}$/),
  appVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  taskIntent: z.string().min(1),
  riskTier: riskTierSchema,
  stateVersion: z.number().int().nonnegative(),
  uiFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  permittedCapabilities: z.array(capabilitySchema),
  evidenceLabels: z.array(z.string().min(1)),
  sessionStatus: z.enum(["active", "expired", "stale"]),
  recordChanged: z.boolean(),
  ambiguousControls: z.boolean()
});

export const replayPreconditionFieldSchema = z.enum([
  "scenario_id",
  "scenario_content_id",
  "app_version",
  "task_intent",
  "risk_tier",
  "state_version",
  "ui_fingerprint",
  "capability_scope",
  "evidence_requirements",
  "session_status",
  "record_changed",
  "ambiguous_controls",
  "expiry"
]);

export const replayPolicyEvidenceSchema = z.object({
  evidenceId: z.string().regex(/^[a-f0-9]{64}$/),
  field: replayPreconditionFieldSchema,
  expected: z.string(),
  actual: z.string(),
  passed: z.boolean(),
  reasonCode: z.string().regex(/^[a-z0-9_]+$/)
});

export const replayDecisionSchema = z.object({
  schemaVersion: z.literal(1),
  decisionId: z.string().regex(/^[a-f0-9]{64}$/),
  manifestId: z.string().regex(/^[a-f0-9]{64}$/),
  decision: z.enum(["replay_allowed", "replan_required", "human_handoff"]),
  sideEffectsPermitted: z.boolean(),
  reasonCodes: z.array(z.string().regex(/^[a-z0-9_]+$/)).min(1),
  policyEvidence: z.array(replayPolicyEvidenceSchema).min(1)
});

export type CurrentReplayContext = z.infer<typeof currentReplayContextSchema>;
export type ReplayDecision = z.infer<typeof replayDecisionSchema>;
export type ReplayPolicyEvidence = z.infer<typeof replayPolicyEvidenceSchema>;
