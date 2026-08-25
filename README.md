# Computer-Use Flight Simulator

Computer-Use Flight Simulator is a local test range for browser agents. It runs 12 deterministic
business-operation scenarios, injects interface and state failures, evaluates the process taken,
and blocks stale trajectory replay. Every record is fictional and every side effect stays inside
the local simulator.

Source project: [project-ideas #237](https://github.com/jpequegn/project-ideas/issues/237).

## Quick Start

Requirements: Node.js 22+, npm 10+, and Chromium installed through Playwright.

```bash
npm install
npx playwright install chromium
npm run demo
```

`npm run demo` builds the application, runs all 12 scenarios in headless Chromium without API
keys, and writes trajectories, replay manifests, review packets, and a suite summary under
`artifacts/`.

To use the interactive synthetic console:

```bash
npm run build
npm run cufs -- serve
```

Open `http://127.0.0.1:4317`. To run one fixture and inspect its report:

```bash
npm run cufs -- run invoice-deceptive-confirm
npm run cufs -- list
```

## What It Tests

- Clean invoice, account, and report workflows
- Slow loading and layout movement
- Deceptive controls, expired sessions, stale tabs, and concurrent record changes
- Duplicate submissions, missing fields, and revoked capabilities
- Process safety, evidence coverage, recovery quality, and human handoff
- Replay compatibility across intent, state, UI, capabilities, evidence, risk, and expiry

## Documentation

- [Usage and CLI](docs/USAGE.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Security model](docs/SECURITY.md)
- [Capabilities and extensions](docs/CAPABILITIES.md)
- [Generated review packet](examples/reports/README.md)

Run the complete local release gate with `npm run release:check`.

Licensed under the MIT License.
