#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { Command, CommanderError } from "commander";

import { currentReplayContextSchema } from "../contracts/replay.js";
import { trajectoryManifestSchema, trajectorySchema } from "../contracts/trajectory.js";
import { evaluateProcess } from "../evaluation/process-evaluator.js";
import { SCENARIOS } from "../fixtures/scenarios.js";
import { currentReplayContext, evaluateReplay } from "../replay/policy.js";
import { createReviewPacket, writeReviewPacket } from "../report/review-packet.js";
import { withBrowserHarness } from "../runtime/browser-harness.js";
import { runDeterministicSuite } from "../runtime/suite.js";
import { createServer } from "../server/app.js";
import { createInitialSnapshot } from "../server/state.js";
import { resolveWebRoot } from "../server/web-root.js";
import { VERSION } from "../version.js";

export const EXIT = {
  ok: 0,
  review: 1,
  gateDenied: 2,
  usage: 3,
  runtime: 4
} as const;

interface CliIo {
  out: (value: string) => void;
  err: (value: string) => void;
}

interface JsonOption {
  json?: boolean;
}

interface ArtifactOption extends JsonOption {
  artifacts: string;
}

function scenarioById(id: string) {
  const scenario = SCENARIOS.find((item) => item.id === id);
  if (!scenario) throw new Error(`Unknown scenario: ${id}`);
  return scenario;
}

async function readJson(filePath: string): Promise<unknown> {
  return JSON.parse(await readFile(path.resolve(filePath), "utf8")) as unknown;
}

function emit(io: CliIo, json: boolean | undefined, value: unknown, status: string): void {
  io.out(json ? `${JSON.stringify(value)}\n` : `${status}\n`);
}

function exitForVerdict(verdict: "pass" | "review" | "fail"): number {
  if (verdict === "fail") return EXIT.gateDenied;
  if (verdict === "review") return EXIT.review;
  return EXIT.ok;
}

export async function runCli(
  argv: readonly string[] = process.argv.slice(2),
  io: CliIo = {
    out: (value) => process.stdout.write(value),
    err: (value) => process.stderr.write(value)
  }
): Promise<number> {
  let exitCode: number = EXIT.ok;
  const program = new Command()
    .name("cufs")
    .description("Local computer-use scenario simulator and process evaluator")
    .version(VERSION)
    .exitOverride()
    .configureOutput({ writeOut: io.out, writeErr: io.err });

  program
    .command("list")
    .description("List the built-in scenario corpus")
    .option("--json", "emit machine-readable JSON")
    .action((options: JsonOption) => {
      const items = SCENARIOS.map((scenario) => ({
        id: scenario.id,
        flow: scenario.flow,
        failure: scenario.failure.kind,
        risk: scenario.riskTier
      }));
      emit(
        io,
        options.json,
        items,
        items.map((item) => `${item.id}\t${item.flow}\t${item.failure}\t${item.risk}`).join("\n")
      );
    });

  program
    .command("inspect")
    .description("Inspect one scenario contract")
    .argument("<scenario>")
    .option("--json", "emit machine-readable JSON")
    .action((id: string, options: JsonOption) => {
      const scenario = scenarioById(id);
      emit(
        io,
        options.json,
        scenario,
        `${scenario.id}: ${scenario.title}\n${scenario.description}`
      );
    });

  program
    .command("serve")
    .description("Serve the local synthetic application")
    .option("--port <port>", "local port", "4317")
    .action(async (options: { port: string }) => {
      const server = await createServer({ serveWeb: true, webRoot: resolveWebRoot() });
      const address = await server.listen({ port: Number(options.port), host: "127.0.0.1" });
      io.out(`READY ${address}\n`);
    });

  program
    .command("run")
    .description("Run and evaluate one scenario in Chromium")
    .argument("<scenario>")
    .option("--artifacts <directory>", "artifact directory", "artifacts")
    .option("--json", "emit machine-readable JSON")
    .action(async (id: string, options: ArtifactOption) => {
      const scenario = scenarioById(id);
      const artifact = await withBrowserHarness(options.artifacts, (harness) =>
        harness.run(scenario)
      );
      const result = {
        scenarioId: id,
        verdict: artifact.evaluation.verdict,
        outcome: artifact.run.trajectory.outcome,
        trajectoryId: artifact.run.trajectory.trajectoryId,
        packetId: artifact.packet.packetId,
        manifestPath: artifact.paths.manifestPath
      };
      emit(io, options.json, result, `${result.verdict.toUpperCase()} ${id} -> ${result.outcome}`);
      exitCode = exitForVerdict(artifact.evaluation.verdict);
    });

  program
    .command("evaluate")
    .description("Evaluate a saved trajectory")
    .argument("<trajectory>")
    .option("--json", "emit machine-readable JSON")
    .action(async (trajectoryPath: string, options: JsonOption) => {
      const trajectory = trajectorySchema.parse(await readJson(trajectoryPath));
      const evaluation = evaluateProcess(scenarioById(trajectory.scenarioId), trajectory);
      emit(
        io,
        options.json,
        evaluation,
        `${evaluation.verdict.toUpperCase()} ${evaluation.scenarioId} (${String(evaluation.metrics.policyCompliance.violations)} policy violations)`
      );
      exitCode = exitForVerdict(evaluation.verdict);
    });

  program
    .command("report")
    .description("Generate JSON and Markdown review packets")
    .argument("<trajectory>")
    .option("--artifacts <directory>", "artifact directory", "artifacts")
    .option("--json", "emit machine-readable JSON")
    .action(async (trajectoryPath: string, options: ArtifactOption) => {
      const trajectory = trajectorySchema.parse(await readJson(trajectoryPath));
      const scenario = scenarioById(trajectory.scenarioId);
      const evaluation = evaluateProcess(scenario, trajectory);
      const packet = createReviewPacket(scenario, trajectory, evaluation);
      const paths = await writeReviewPacket(packet, options.artifacts);
      emit(
        io,
        options.json,
        { packetId: packet.packetId, verdict: evaluation.verdict, ...paths },
        `WROTE ${paths.markdownPath}`
      );
      exitCode = exitForVerdict(evaluation.verdict);
    });

  program
    .command("replay")
    .description("Gate and replay a saved trajectory manifest")
    .argument("<manifest>")
    .option("--context <file>", "current replay context JSON")
    .option("--now <iso-date>", "policy evaluation time", new Date().toISOString())
    .option("--artifacts <directory>", "artifact directory", "artifacts")
    .option("--json", "emit machine-readable JSON")
    .action(
      async (manifestPath: string, options: ArtifactOption & { context?: string; now: string }) => {
        const manifest = trajectoryManifestSchema.parse(await readJson(manifestPath));
        const scenario = scenarioById(manifest.scenarioId);
        const context = options.context
          ? currentReplayContextSchema.parse(await readJson(options.context))
          : currentReplayContext(scenario, createInitialSnapshot(scenario));
        const now = new Date(options.now);
        if (Number.isNaN(now.valueOf())) throw new Error(`Invalid --now value: ${options.now}`);
        const policy = evaluateReplay(manifest, context, now);
        if (!policy.sideEffectsPermitted) {
          emit(
            io,
            options.json,
            policy,
            `${policy.decision.toUpperCase()} ${policy.reasonCodes.join(",")}`
          );
          exitCode = EXIT.gateDenied;
          return;
        }
        const result = await withBrowserHarness(options.artifacts, (harness) =>
          harness.replay({ scenario, manifest, currentContext: context, now })
        );
        emit(
          io,
          options.json,
          result,
          `${result.replayDecision.decision.toUpperCase()} side_effects=${String(result.sideEffectCount)}`
        );
        exitCode = result.artifact
          ? exitForVerdict(result.artifact.evaluation.verdict)
          : EXIT.gateDenied;
      }
    );

  program
    .command("demo")
    .description("Run the deterministic twelve-scenario browser suite")
    .option("--artifacts <directory>", "artifact directory", "artifacts")
    .option("--json", "emit machine-readable JSON")
    .action(async (options: ArtifactOption) => {
      const result = await runDeterministicSuite(options.artifacts);
      emit(
        io,
        options.json,
        result,
        `PASS ${String(result.summary.totals.passed)}/${String(result.summary.totals.scenarios)} scenarios; ${result.summaryPath}`
      );
      exitCode = result.summary.totals.failed > 0 ? EXIT.gateDenied : EXIT.ok;
    });

  try {
    await program.parseAsync(["node", "cufs", ...argv]);
  } catch (error) {
    if (error instanceof CommanderError) {
      if (error.code === "commander.helpDisplayed" || error.code === "commander.version") {
        return EXIT.ok;
      }
      return EXIT.usage;
    }
    io.err(`ERROR ${error instanceof Error ? error.message : String(error)}\n`);
    return EXIT.runtime;
  }
  return exitCode;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await runCli();
}
