import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { SCENARIOS } from "../fixtures/scenarios.js";
import { canonicalJson, contentId } from "../lib/canonical-json.js";
import { withBrowserHarness } from "./browser-harness.js";

export async function runDeterministicSuite(artifactRoot: string) {
  const results = await withBrowserHarness(artifactRoot, async (harness) => {
    const completed = [];
    for (const scenario of SCENARIOS) {
      const artifact = await harness.run(scenario);
      completed.push({
        scenarioId: scenario.id,
        outcome: artifact.run.trajectory.outcome,
        verdict: artifact.evaluation.verdict,
        trajectoryId: artifact.run.trajectory.trajectoryId,
        packetId: artifact.packet.packetId,
        manifestId: artifact.manifest.manifestId
      });
    }
    return completed;
  });
  const totals = {
    scenarios: results.length,
    passed: results.filter((item) => item.verdict === "pass").length,
    review: results.filter((item) => item.verdict === "review").length,
    failed: results.filter((item) => item.verdict === "fail").length
  };
  const draft = { schemaVersion: 1 as const, corpus: "built-in-12", totals, results };
  const summary = { ...draft, suiteId: contentId(draft) };
  const directory = path.join(artifactRoot, "suites");
  await mkdir(directory, { recursive: true });
  const summaryPath = path.join(directory, `${summary.suiteId}.json`);
  await writeFile(summaryPath, `${canonicalJson(summary)}\n`);
  return { summary, summaryPath };
}
