import { z } from "zod";

export const flowSchema = z.enum(["invoice_dispute", "account_update", "report_export"]);
export const failureKindSchema = z.enum([
  "none",
  "slow_load",
  "layout_shift",
  "expired_session",
  "stale_tab",
  "deceptive_confirmation",
  "duplicate_submit",
  "missing_field",
  "changed_record",
  "revoked_capability"
]);
export const riskTierSchema = z.enum(["read_only", "reversible_write", "irreversible"]);
export const safeActionSchema = z.enum(["complete", "retry", "abstain", "replan", "human_handoff"]);
export const capabilitySchema = z.enum([
  "authenticate",
  "view_invoice",
  "submit_dispute",
  "view_account",
  "update_account",
  "view_report",
  "export_report"
]);

export const evidenceRequirementSchema = z.object({
  kind: z.enum(["observation", "screenshot", "state", "action_receipt"]),
  label: z.string().min(1).max(100),
  required: z.boolean().default(true)
});

export const scenarioSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    title: z.string().min(3).max(120),
    description: z.string().min(10).max(500),
    flow: flowSchema,
    seed: z.number().int().nonnegative(),
    synthetic: z.literal(true),
    appVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
    allowedOrigin: z.literal("http://127.0.0.1"),
    task: z.object({
      intent: z.string().min(3).max(160),
      recordId: z.string().regex(/^[A-Z]+-\d+$/),
      instructions: z.string().min(3).max(500)
    }),
    riskTier: riskTierSchema,
    permittedCapabilities: z.array(capabilitySchema).min(1),
    failure: z.object({
      kind: failureKindSchema,
      delayMs: z.number().int().min(0).max(10_000).optional(),
      trigger: z.string().min(1).max(120).optional()
    }),
    expectedSafeActions: z.array(safeActionSchema).min(1),
    requiredEvidence: z.array(evidenceRequirementSchema).min(1),
    retryBudget: z.number().int().min(0).max(5)
  })
  .superRefine((scenario, context) => {
    const flowCapabilities: Record<z.infer<typeof flowSchema>, Set<string>> = {
      invoice_dispute: new Set(["authenticate", "view_invoice", "submit_dispute"]),
      account_update: new Set(["authenticate", "view_account", "update_account"]),
      report_export: new Set(["authenticate", "view_report", "export_report"])
    };
    const invalid = scenario.permittedCapabilities.find(
      (capability) => !flowCapabilities[scenario.flow].has(capability)
    );
    if (invalid) {
      context.addIssue({
        code: "custom",
        path: ["permittedCapabilities"],
        message: `${invalid} is not valid for ${scenario.flow}`
      });
    }
    if (
      scenario.riskTier === "irreversible" &&
      !scenario.expectedSafeActions.includes("human_handoff")
    ) {
      context.addIssue({
        code: "custom",
        path: ["expectedSafeActions"],
        message: "Irreversible tasks must permit human handoff"
      });
    }
    if (scenario.failure.kind === "slow_load" && scenario.failure.delayMs === undefined) {
      context.addIssue({
        code: "custom",
        path: ["failure", "delayMs"],
        message: "Slow-load scenarios require a bounded delay"
      });
    }
  });

export type Scenario = z.infer<typeof scenarioSchema>;
export type Flow = z.infer<typeof flowSchema>;
export type FailureKind = z.infer<typeof failureKindSchema>;
export type SafeAction = z.infer<typeof safeActionSchema>;
export type Capability = z.infer<typeof capabilitySchema>;
