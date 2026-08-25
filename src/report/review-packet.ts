import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { Scenario } from "../contracts/scenario.js";
import type { ProcessEvaluation } from "../contracts/evaluation.js";
import { reviewPacketSchema, type ReviewPacket } from "../contracts/review.js";
import type { Trajectory } from "../contracts/trajectory.js";
import { canonicalJson, contentId } from "../lib/canonical-json.js";

const remediationByCode: Record<string, string> = {
  risky_click: "Require semantic control verification before any click.",
  missing_confirmation: "Route the action through an explicit human approval boundary.",
  duplicate_write: "Check durable receipts before retrying a write.",
  unsupported_completion: "Require receipt evidence before claiming completion.",
  repeated_failure: "Stop after the bounded recovery budget is exhausted.",
  unsafe_retry: "Re-observe state and apply the scenario retry policy before retrying.",
  missing_evidence: "Capture every required evidence class before the terminal decision.",
  incorrect_handoff: "Align handoff behavior with the scenario risk and failure policy.",
  capability_violation: "Restrict the adapter to the manifest capability scope.",
  unexpected_terminal_action: "Choose a terminal action listed in the scenario safety contract."
};

export function createReviewPacket(
  scenario: Scenario,
  trajectory: Trajectory,
  evaluation: ProcessEvaluation
): ReviewPacket {
  const evidence = [
    ...new Map(
      trajectory.events
        .flatMap((event) => event.evidence)
        .map((item) => [item.evidenceId, item] as const)
    ).values()
  ];
  const handoffEvent = trajectory.events.findLast((event) => event.action === "human_handoff");
  const remediation = [
    ...new Set(
      evaluation.findings
        .filter((finding) => finding.severity !== "info")
        .map((finding) => remediationByCode[finding.code])
        .filter((item): item is string => Boolean(item))
    )
  ];
  if (remediation.length === 0)
    remediation.push("Preserve this trajectory as a regression baseline.");
  const draft = {
    schemaVersion: 1 as const,
    scenario: {
      id: scenario.id,
      title: scenario.title,
      riskTier: scenario.riskTier,
      failureKind: scenario.failure.kind,
      taskIntent: scenario.task.intent
    },
    trajectory,
    evaluation,
    evidence,
    handoff: {
      required: evaluation.metrics.handoffCorrectness.required,
      performed: evaluation.metrics.handoffCorrectness.performed,
      reasonCode: handoffEvent?.reasonCode ?? null
    },
    remediation
  };
  return reviewPacketSchema.parse({ ...draft, packetId: contentId(draft) });
}

export function reviewPacketMarkdown(packet: ReviewPacket): string {
  const metrics = Object.entries(packet.evaluation.metrics)
    .map(([name, value]) => `| ${name} | ${value.score.toFixed(2)} |`)
    .join("\n");
  const findings = packet.evaluation.findings.length
    ? packet.evaluation.findings
        .map(
          (finding) =>
            `- **${finding.severity} / ${finding.code}:** ${finding.message} (actions: ${finding.actionSequences.join(", ") || "none"})`
        )
        .join("\n")
    : "- None.";
  const evidence = packet.evidence.length
    ? packet.evidence
        .map((item) => `- \`${item.label}\` (${item.kind}): \`${item.evidenceId}\``)
        .join("\n")
    : "- None.";
  const events = packet.trajectory.events
    .map(
      (event) =>
        `| ${String(event.sequence)} | ${event.action} | ${event.target} | ${event.result} | ${event.reasonCode} |`
    )
    .join("\n");
  return `# Review Packet: ${packet.scenario.title}

- Packet: \`${packet.packetId}\`
- Trajectory: \`${packet.trajectory.trajectoryId}\`
- Verdict: **${packet.evaluation.verdict.toUpperCase()}**
- Terminal decision: \`${packet.evaluation.decision.action}\`

## Metrics

| Component | Score |
| --- | ---: |
${metrics}

## Trajectory

| # | Action | Target | Result | Reason |
| ---: | --- | --- | --- | --- |
${events}

## Evidence

${evidence}

## Findings

${findings}

## Human Handoff

- Required: ${String(packet.handoff.required)}
- Performed: ${String(packet.handoff.performed)}
- Reason: ${packet.handoff.reasonCode ?? "not applicable"}

## Remediation

${packet.remediation.map((item) => `- ${item}`).join("\n")}
`;
}

export async function writeReviewPacket(packet: ReviewPacket, artifactRoot: string) {
  const directory = path.join(artifactRoot, "reports");
  await mkdir(directory, { recursive: true });
  const jsonPath = path.join(directory, `${packet.packetId}.json`);
  const markdownPath = path.join(directory, `${packet.packetId}.md`);
  await Promise.all([
    writeFile(jsonPath, `${canonicalJson(packet)}\n`),
    writeFile(markdownPath, reviewPacketMarkdown(packet))
  ]);
  return { jsonPath, markdownPath };
}
