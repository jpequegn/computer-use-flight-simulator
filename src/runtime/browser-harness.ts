import path from "node:path";

import { mkdir, writeFile } from "node:fs/promises";

import { chromium, type Browser } from "playwright";

import { TrajectoryLedger } from "../agent/ledger.js";
import { runAgentOnPage } from "../agent/runner.js";
import { ScriptedPolicyAdapter } from "../agent/scripted-adapter.js";
import type { CompletedRun } from "../agent/contracts.js";
import type { ProcessEvaluation } from "../contracts/evaluation.js";
import type { CurrentReplayContext, ReplayDecision } from "../contracts/replay.js";
import type { ReviewPacket } from "../contracts/review.js";
import type { Scenario } from "../contracts/scenario.js";
import type { TrajectoryManifest } from "../contracts/trajectory.js";
import { evaluateProcess } from "../evaluation/process-evaluator.js";
import { canonicalJson } from "../lib/canonical-json.js";
import { runReplayOnPage } from "../replay/browser-runner.js";
import { createReplayManifest, uiFingerprintFor } from "../replay/policy.js";
import { createReviewPacket, writeReviewPacket } from "../report/review-packet.js";
import { createServer } from "../server/app.js";
import { createInitialSnapshot } from "../server/state.js";
import { resolveWebRoot } from "../server/web-root.js";

export const DEFAULT_MANIFEST_EXPIRY = "2030-01-01T00:00:00.000Z";

export interface ScenarioRunArtifact {
  run: CompletedRun;
  evaluation: ProcessEvaluation;
  packet: ReviewPacket;
  manifest: TrajectoryManifest;
  paths: {
    jsonPath: string;
    markdownPath: string;
    trajectoryPath: string;
    manifestPath: string;
  };
}

export class BrowserHarness {
  private browser: Browser | null = null;
  private server: Awaited<ReturnType<typeof createServer>> | null = null;
  private baseUrl = "";

  public constructor(private readonly artifactRoot: string) {}

  public async start(): Promise<void> {
    this.server = await createServer({ serveWeb: true, webRoot: resolveWebRoot() });
    this.baseUrl = await this.server.listen({ port: 0, host: "127.0.0.1" });
    this.browser = await chromium.launch({ headless: true });
  }

  public async run(scenario: Scenario): Promise<ScenarioRunArtifact> {
    if (!this.browser || !this.server) throw new Error("Browser harness is not started");
    const page = await this.browser.newPage({ viewport: { width: 1440, height: 960 } });
    try {
      const run = await runAgentOnPage({
        page,
        baseUrl: this.baseUrl,
        scenario,
        adapter: new ScriptedPolicyAdapter()
      });
      return await this.persist(scenario, run);
    } finally {
      await page.close();
    }
  }

  public async replay(options: {
    scenario: Scenario;
    manifest: TrajectoryManifest;
    currentContext: CurrentReplayContext;
    now: Date;
  }): Promise<{
    replayDecision: ReplayDecision;
    artifact: ScenarioRunArtifact | null;
    sideEffectCount: number;
  }> {
    if (!this.browser || !this.server) throw new Error("Browser harness is not started");
    const page = await this.browser.newPage({ viewport: { width: 1440, height: 960 } });
    try {
      const result = await runReplayOnPage({
        page,
        baseUrl: this.baseUrl,
        scenario: options.scenario,
        adapter: new ScriptedPolicyAdapter(),
        manifest: options.manifest,
        currentContext: options.currentContext,
        now: options.now
      });
      const artifact = result.run ? await this.persist(options.scenario, result.run) : null;
      return {
        replayDecision: result.replayDecision,
        artifact,
        sideEffectCount: result.sideEffectCount
      };
    } finally {
      await page.close();
    }
  }

  public async close(): Promise<void> {
    await this.browser?.close();
    await this.server?.close();
    this.browser = null;
    this.server = null;
  }

  private async persist(scenario: Scenario, run: CompletedRun): Promise<ScenarioRunArtifact> {
    const evaluation = evaluateProcess(scenario, run.trajectory);
    const ledger = await new TrajectoryLedger(this.artifactRoot).append(run.trajectory);
    const packet = createReviewPacket(scenario, run.trajectory, evaluation);
    const paths = await writeReviewPacket(packet, this.artifactRoot);
    const initial = createInitialSnapshot(scenario);
    const manifest = createReplayManifest({
      scenario,
      trajectory: run.trajectory,
      stateVersion: initial.stateVersion,
      uiFingerprint: uiFingerprintFor(initial),
      expiresAt: DEFAULT_MANIFEST_EXPIRY
    });
    const manifestDirectory = path.join(this.artifactRoot, "manifests");
    await mkdir(manifestDirectory, { recursive: true });
    const manifestPath = path.join(manifestDirectory, `${manifest.manifestId}.json`);
    await writeFile(manifestPath, `${canonicalJson(manifest)}\n`);
    return {
      run,
      evaluation,
      packet,
      manifest,
      paths: { ...paths, trajectoryPath: ledger.path, manifestPath }
    };
  }
}

export async function withBrowserHarness<T>(
  artifactRoot: string,
  callback: (harness: BrowserHarness) => Promise<T>
): Promise<T> {
  const harness = new BrowserHarness(artifactRoot);
  await harness.start();
  try {
    return await callback(harness);
  } finally {
    await harness.close();
  }
}
