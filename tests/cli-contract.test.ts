import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { TrajectoryBuilder } from "../src/agent/trajectory.js";
import { EXIT, runCli } from "../src/cli/main.js";
import type { Scenario } from "../src/contracts/scenario.js";
import { evaluateProcess } from "../src/evaluation/process-evaluator.js";
import { SCENARIOS } from "../src/fixtures/scenarios.js";
import { contentId } from "../src/lib/canonical-json.js";
import {
  createReplayManifest,
  currentReplayContext,
  uiFingerprintFor
} from "../src/replay/policy.js";
import { createReviewPacket } from "../src/report/review-packet.js";
import { createInitialSnapshot } from "../src/server/state.js";

function cliIo() {
  const output: string[] = [];
  const errors: string[] = [];
  return {
    output,
    errors,
    io: {
      out: (value: string) => output.push(value),
      err: (value: string) => errors.push(value)
    }
  };
}

function completedTrajectory(scenario: Scenario, duplicate = false) {
  const builder = new TrajectoryBuilder();
  builder.record({
    action: "observe",
    target: "record-state",
    result: "succeeded",
    reasonCode: "record_verified",
    evidence: [
      {
        evidenceId: contentId("record"),
        kind: "observation",
        label: "record-state",
        path: "evidence/record.json"
      }
    ]
  });
  const write = {
    action: "click" as const,
    target: "Submit dispute",
    capability: "submit_dispute" as const,
    result: "succeeded" as const,
    reasonCode: "permitted_action",
    evidence: []
  };
  builder.record(write, true);
  if (duplicate) builder.record(write, true);
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
  return builder.finish({
    scenario,
    adapter: { name: "cli-test", version: "1" },
    finalAction: "complete",
    outcome: "completed"
  });
}

describe("CLI contracts", () => {
  it("lists and inspects the fixed corpus as JSON", async () => {
    const list = cliIo();
    expect(await runCli(["list", "--json"], list.io)).toBe(EXIT.ok);
    expect(JSON.parse(list.output.join(""))).toHaveLength(12);

    const inspect = cliIo();
    expect(await runCli(["inspect", "invoice-clean", "--json"], inspect.io)).toBe(EXIT.ok);
    expect(JSON.parse(inspect.output.join(""))).toMatchObject({ id: "invoice-clean" });
  });

  it("returns a stable usage exit for an unknown command", async () => {
    const captured = cliIo();
    expect(await runCli(["not-a-command"], captured.io)).toBe(EXIT.usage);
    expect(captured.errors.join(""), "Commander should explain the usage failure").toContain(
      "unknown command"
    );
  });

  it("fails the process gate for an unsafe successful trajectory", async () => {
    const scenario = SCENARIOS[0];
    if (!scenario) throw new Error("Missing fixture");
    const root = await mkdtemp(path.join(os.tmpdir(), "cufs-cli-"));
    const trajectoryPath = path.join(root, "unsafe.json");
    await writeFile(trajectoryPath, JSON.stringify(completedTrajectory(scenario, true)));
    const captured = cliIo();
    expect(await runCli(["evaluate", trajectoryPath, "--json"], captured.io)).toBe(EXIT.gateDenied);
    const evaluation = JSON.parse(captured.output.join("")) as { verdict: string };
    expect(evaluation.verdict).toBe("fail");
  });

  it("writes content-addressed JSON and Markdown review packets", async () => {
    const scenario = SCENARIOS[0];
    if (!scenario) throw new Error("Missing fixture");
    const root = await mkdtemp(path.join(os.tmpdir(), "cufs-report-"));
    const trajectory = completedTrajectory(scenario);
    const trajectoryPath = path.join(root, "trajectory.json");
    await writeFile(trajectoryPath, JSON.stringify(trajectory));
    const captured = cliIo();
    expect(
      await runCli(["report", trajectoryPath, "--artifacts", root, "--json"], captured.io)
    ).toBe(EXIT.ok);
    const result = JSON.parse(captured.output.join("")) as {
      packetId: string;
      jsonPath: string;
      markdownPath: string;
    };
    const expected = createReviewPacket(
      scenario,
      trajectory,
      evaluateProcess(scenario, trajectory)
    );
    expect(result.packetId).toBe(expected.packetId);
    expect(JSON.parse(await readFile(result.jsonPath, "utf8"))).toMatchObject({
      packetId: expected.packetId,
      evaluation: { verdict: "pass" }
    });
    expect(await readFile(result.markdownPath, "utf8")).toContain("## Remediation");
  });

  it("denies a stale replay before starting a browser", async () => {
    const scenario = SCENARIOS[0];
    if (!scenario) throw new Error("Missing fixture");
    const root = await mkdtemp(path.join(os.tmpdir(), "cufs-replay-"));
    const snapshot = createInitialSnapshot(scenario);
    const manifest = createReplayManifest({
      scenario,
      trajectory: completedTrajectory(scenario),
      stateVersion: snapshot.stateVersion,
      uiFingerprint: uiFingerprintFor(snapshot),
      expiresAt: "2030-01-01T00:00:00.000Z"
    });
    const context = {
      ...currentReplayContext(scenario, snapshot),
      stateVersion: snapshot.stateVersion + 1,
      recordChanged: true
    };
    const manifestPath = path.join(root, "manifest.json");
    const contextPath = path.join(root, "context.json");
    await Promise.all([
      writeFile(manifestPath, JSON.stringify(manifest)),
      writeFile(contextPath, JSON.stringify(context))
    ]);
    const captured = cliIo();
    expect(
      await runCli(
        [
          "replay",
          manifestPath,
          "--context",
          contextPath,
          "--now",
          "2026-08-25T00:00:00.000Z",
          "--json"
        ],
        captured.io
      )
    ).toBe(EXIT.gateDenied);
    expect(JSON.parse(captured.output.join(""))).toMatchObject({
      decision: "human_handoff",
      sideEffectsPermitted: false
    });
  });
});
