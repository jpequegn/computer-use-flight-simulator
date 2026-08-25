import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { Trajectory } from "../contracts/trajectory.js";
import { canonicalJson, contentId } from "../lib/canonical-json.js";

interface LedgerEntry {
  trajectoryId: string;
  scenarioId: string;
  previousHash: string | null;
  entryHash: string;
}

export class TrajectoryLedger {
  public constructor(private readonly artifactRoot: string) {}

  public async append(trajectory: Trajectory): Promise<{ path: string; entry: LedgerEntry }> {
    const trajectoryPath = path.join(
      this.artifactRoot,
      "trajectories",
      `${trajectory.trajectoryId}.json`
    );
    const ledgerPath = path.join(this.artifactRoot, "trajectory-ledger.jsonl");
    await mkdir(path.dirname(trajectoryPath), { recursive: true });
    await writeFile(trajectoryPath, `${canonicalJson(trajectory)}\n`, { flag: "wx" }).catch(
      async (error: unknown) => {
        if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) throw error;
        const existing = JSON.parse(await readFile(trajectoryPath, "utf8")) as unknown;
        if (canonicalJson(existing) !== canonicalJson(trajectory)) {
          throw new Error(`Immutable trajectory conflict: ${trajectory.trajectoryId}`);
        }
      }
    );
    const previous = (await this.read()).at(-1)?.entryHash ?? null;
    const entryDraft = {
      trajectoryId: trajectory.trajectoryId,
      scenarioId: trajectory.scenarioId,
      previousHash: previous
    };
    const entry = { ...entryDraft, entryHash: contentId(entryDraft) };
    await appendFile(ledgerPath, `${canonicalJson(entry)}\n`);
    return { path: trajectoryPath, entry };
  }

  public async read(): Promise<LedgerEntry[]> {
    try {
      const content = await readFile(
        path.join(this.artifactRoot, "trajectory-ledger.jsonl"),
        "utf8"
      );
      return content
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line) as LedgerEntry);
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") return [];
      throw error;
    }
  }
}
