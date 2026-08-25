import { z } from "zod";

import { capabilitySchema, riskTierSchema, safeActionSchema } from "./scenario.js";

export const evidenceRefSchema = z.object({
  evidenceId: z.string().regex(/^[a-f0-9]{64}$/),
  kind: z.enum(["observation", "screenshot", "state", "action_receipt"]),
  label: z.string().min(1),
  path: z.string().regex(/^[a-zA-Z0-9_./-]+$/)
});

export const actionEventSchema = z.object({
  sequence: z.number().int().positive(),
  action: z.enum([
    "observe",
    "navigate",
    "click",
    "fill",
    "retry",
    "claim_complete",
    "abstain",
    "replan",
    "human_handoff"
  ]),
  target: z.string().min(1).max(200),
  capability: capabilitySchema.optional(),
  timestampOffsetMs: z.number().int().nonnegative(),
  result: z.enum(["succeeded", "failed", "blocked", "pending"]),
  reasonCode: z.string().regex(/^[a-z0-9_]+$/),
  evidence: z.array(evidenceRefSchema).default([])
});

export const trajectorySchema = z.object({
  schemaVersion: z.literal(1),
  trajectoryId: z.string().regex(/^[a-f0-9]{64}$/),
  scenarioId: z.string().min(1),
  scenarioContentId: z.string().regex(/^[a-f0-9]{64}$/),
  adapter: z.object({ name: z.string().min(1), version: z.string().min(1) }),
  events: z.array(actionEventSchema),
  finalAction: safeActionSchema,
  outcome: z.enum(["completed", "blocked", "handed_off", "abstained", "failed"]),
  sideEffectCount: z.number().int().nonnegative()
});

export const trajectoryManifestSchema = z.object({
  schemaVersion: z.literal(1),
  manifestId: z.string().regex(/^[a-f0-9]{64}$/),
  trajectoryId: z.string().regex(/^[a-f0-9]{64}$/),
  scenarioId: z.string().min(1),
  appVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  taskIntent: z.string().min(1),
  riskTier: riskTierSchema,
  requiredStateVersion: z.number().int().nonnegative(),
  requiredUiFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  permittedCapabilities: z.array(capabilitySchema).min(1),
  evidenceLabels: z.array(z.string().min(1)),
  expiresAt: z.iso.datetime()
});

export type ActionEvent = z.infer<typeof actionEventSchema>;
export type Trajectory = z.infer<typeof trajectorySchema>;
export type TrajectoryManifest = z.infer<typeof trajectoryManifestSchema>;
