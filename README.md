# Computer-Use Flight Simulator

Computer-Use Flight Simulator is a local evaluation environment for testing how browser agents
recover from interface failures, respect action boundaries, preserve evidence, and hand control to
a human. It uses fictional business records and reversible local side effects only.

Source project: [project-ideas #237](https://github.com/jpequegn/project-ideas/issues/237).

## Requirements

- Node.js 22 or newer
- npm 10 or newer

## Development

```bash
npm install
npm run check
```

The initial repository contains only the strict TypeScript and CI foundation. Scenario contracts,
the synthetic application, browser execution, process evaluators, replay gates, and review packets
are tracked in repository issues.

## Safety Boundary

The project must not connect to production systems, retain real browser histories, accept real
credentials, or execute arbitrary scenario scripts. All demonstrations use generated fictional
records and deterministic fixture state.

Licensed under the MIT License.
