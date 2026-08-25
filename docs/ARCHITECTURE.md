# Architecture

## Execution Path

1. A versioned `Scenario` fixture defines intent, risk, failures, capabilities, evidence, and retry
   policy.
2. Fastify serves deterministic synthetic state and React renders the operation console.
3. A Playwright driver exposes bounded browser actions to an adapter and records each action in a
   `Trajectory`.
4. The process evaluator scores completion, policy compliance, recovery, evidence, and handoff as
   separate components.
5. The artifact layer stores content-addressed trajectories, replay manifests, and JSON/Markdown
   review packets.
6. Replay compares all current preconditions before the browser adapter can run.

## Module Boundaries

| Module           | Responsibility                                                            |
| ---------------- | ------------------------------------------------------------------------- |
| `src/contracts`  | Zod schemas for scenarios, trajectories, evaluations, replay, and reports |
| `src/server`     | Synthetic state machine and local-only HTTP application                   |
| `web`            | Operator-facing React console                                             |
| `src/agent`      | Driver boundary, adapters, trajectory builder, and append-only ledger     |
| `src/evaluation` | Reason-coded process evaluation and approval boundaries                   |
| `src/replay`     | Manifest creation, precondition policy, and browser execution gate        |
| `src/report`     | Content-addressed review packet generation                                |
| `src/runtime`    | Isolated server/browser harness and deterministic corpus runner           |
| `src/cli`        | Human and machine-readable command interface                              |

Content hashes make equivalent logical artifacts stable. The ledger chains trajectory entries so a
reviewer can detect reordering or replacement. Browser navigation and network requests are limited
to the simulator's `127.0.0.1` origin and selected ephemeral port.
