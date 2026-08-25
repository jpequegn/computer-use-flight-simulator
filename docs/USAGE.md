# Usage

Build once before invoking the compiled CLI directly:

```bash
npm run build
npm run cufs -- list
```

## Commands

| Command                                      | Purpose                                       |
| -------------------------------------------- | --------------------------------------------- |
| `cufs list [--json]`                         | List all scenario IDs and risk conditions     |
| `cufs inspect <id> [--json]`                 | Print one versioned scenario contract         |
| `cufs serve [--port 4317]`                   | Run the interactive local console             |
| `cufs run <id> [--artifacts dir]`            | Execute, evaluate, and report one scenario    |
| `cufs evaluate <trajectory> [--json]`        | Evaluate a saved trajectory without a browser |
| `cufs report <trajectory> [--artifacts dir]` | Generate JSON and Markdown review packets     |
| `cufs replay <manifest> [--context file]`    | Gate replay and execute only an exact match   |
| `cufs demo [--artifacts dir]`                | Run the complete 12-case browser suite        |

Use `--json` for automation. Exit codes are stable: `0` pass, `1` review required, `2` process gate
failed or replay denied, `3` invalid command usage, and `4` invalid input or runtime failure.

## Artifacts

The artifact directory contains:

- `trajectories/<trajectory-id>.json`
- `trajectory-ledger.jsonl`
- `manifests/<manifest-id>.json`
- `reports/<packet-id>.json` and `.md`
- `suites/<suite-id>.json`

## Troubleshooting

If Chromium is missing, run `npx playwright install chromium`. If port 4317 is occupied, use
`cufs serve --port <free-port>`. Run commands from the repository root so `web-dist/` can be found.
Use `npm run build` after source changes. `npm run release:check` reproduces CI locally and identifies
whether format, types, unit tests, browser tests, the demo, or package contents failed.
