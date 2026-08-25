import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { TrajectoryLedger } from "../src/agent/ledger.js";
import { TrajectoryBuilder } from "../src/agent/trajectory.js";
import { SCENARIOS } from "../src/fixtures/scenarios.js";

function build() {
  const scenario = SCENARIOS[0];
  if (!scenario) throw new Error("Missing fixture");
  const builder = new TrajectoryBuilder();
  builder.record({
    action: "observe",
    target: "record",
    result: "succeeded",
    reasonCode: "fixture",
    evidence: []
  });
  return builder.finish({
    scenario,
    adapter: { name: "test", version: "1" },
    finalAction: "complete",
    outcome: "completed"
  });
}

describe("trajectory artifacts", () => {
  it("creates stable identities for equivalent logical runs", () => {
    expect(build().trajectoryId).toBe(build().trajectoryId);
  });

  it("writes immutable artifacts and a chained append-only ledger", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "cufs-ledger-"));
    const ledger = new TrajectoryLedger(root);
    const first = await ledger.append(build());
    const second = await ledger.append(build());
    expect(second.entry.previousHash).toBe(first.entry.entryHash);
    expect(JSON.parse(await readFile(first.path, "utf8"))).toMatchObject({
      trajectoryId: build().trajectoryId
    });
  });
});
