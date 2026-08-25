import { z } from "zod";

import { processEvaluationSchema } from "./evaluation.js";
import { evidenceRefSchema, trajectorySchema } from "./trajectory.js";

export const reviewPacketSchema = z.object({
  schemaVersion: z.literal(1),
  packetId: z.string().regex(/^[a-f0-9]{64}$/),
  scenario: z.object({
    id: z.string().min(1),
    title: z.string().min(1),
    riskTier: z.string().min(1),
    failureKind: z.string().min(1),
    taskIntent: z.string().min(1)
  }),
  trajectory: trajectorySchema,
  evaluation: processEvaluationSchema,
  evidence: z.array(evidenceRefSchema),
  handoff: z.object({
    required: z.boolean(),
    performed: z.boolean(),
    reasonCode: z.string().nullable()
  }),
  remediation: z.array(z.string().min(1))
});

export type ReviewPacket = z.infer<typeof reviewPacketSchema>;
