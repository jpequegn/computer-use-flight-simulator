import { z } from "zod";

import { safeActionSchema } from "./scenario.js";

export const findingCodeSchema = z.enum([
  "risky_click",
  "missing_confirmation",
  "duplicate_write",
  "unsupported_completion",
  "repeated_failure",
  "unsafe_retry",
  "missing_evidence",
  "incorrect_handoff",
  "capability_violation",
  "unexpected_terminal_action",
  "safe_abstention",
  "safe_handoff"
]);

export const evaluationFindingSchema = z.object({
  code: findingCodeSchema,
  severity: z.enum(["info", "warning", "error"]),
  message: z.string().min(1),
  actionSequences: z.array(z.number().int().positive()),
  evidenceIds: z.array(z.string().regex(/^[a-f0-9]{64}$/))
});

const scoreSchema = z.number().min(0).max(1);

export const processEvaluationSchema = z.object({
  schemaVersion: z.literal(1),
  evaluationId: z.string().regex(/^[a-f0-9]{64}$/),
  trajectoryId: z.string().regex(/^[a-f0-9]{64}$/),
  scenarioId: z.string().min(1),
  verdict: z.enum(["pass", "review", "fail"]),
  decision: z.object({
    action: safeActionSchema,
    accepted: z.boolean(),
    reasonCode: z.string().min(1)
  }),
  approvalBoundary: z.object({
    required: z.boolean(),
    reasonCodes: z.array(z.string().regex(/^[a-z0-9_]+$/)),
    allowedWithoutApproval: z.array(safeActionSchema)
  }),
  metrics: z.object({
    taskCompletion: z.object({
      score: scoreSchema,
      expectedActions: z.array(safeActionSchema),
      actualAction: safeActionSchema,
      outcomeConsistent: z.boolean()
    }),
    policyCompliance: z.object({
      score: scoreSchema,
      evaluatedActions: z.number().int().nonnegative(),
      violations: z.number().int().nonnegative()
    }),
    recoveryQuality: z.object({
      score: scoreSchema,
      retriesUsed: z.number().int().nonnegative(),
      retryBudget: z.number().int().nonnegative(),
      replansUsed: z.number().int().nonnegative(),
      failedActions: z.number().int().nonnegative()
    }),
    evidenceCoverage: z.object({
      score: scoreSchema,
      required: z.number().int().nonnegative(),
      satisfied: z.number().int().nonnegative(),
      missingLabels: z.array(z.string().min(1))
    }),
    handoffCorrectness: z.object({
      score: scoreSchema,
      required: z.boolean(),
      performed: z.boolean(),
      appropriate: z.boolean()
    })
  }),
  findings: z.array(evaluationFindingSchema)
});

export type EvaluationFinding = z.infer<typeof evaluationFindingSchema>;
export type ProcessEvaluation = z.infer<typeof processEvaluationSchema>;
