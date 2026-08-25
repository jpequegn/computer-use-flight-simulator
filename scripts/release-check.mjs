import { spawnSync } from "node:child_process";

const steps = [
  ["npm", ["run", "check"]],
  ["npm", ["run", "build"]],
  ["npm", ["run", "test:e2e"]],
  ["node", ["dist/src/cli/main.js", "demo", "--artifacts", "artifacts/release-check"]],
  ["npm", ["pack", "--dry-run"]]
];

for (const [command, args] of steps) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
