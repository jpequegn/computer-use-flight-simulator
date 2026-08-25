# Security Model

## Boundary

The simulator is deliberately not a production automation system. It accepts only the built-in
scenario corpus, uses generated records, binds to `127.0.0.1`, launches an isolated headless browser,
and blocks navigation to any other origin or port. It never requests credentials or API keys.

The server validates capabilities, expected state versions, failure conditions, and action shape
before changing state. A UI-disabled button is not considered a security boundary; server-side
checks independently fail closed.

## Replay

A prior success grants no authority. Replay is allowed only when scenario content, application
version, task intent, risk tier, state version, UI fingerprint, capability scope, evidence
requirements, session state, record state, control clarity, and expiry all pass. The browser runner
is not invoked for denied replay.

## Artifact Handling

Artifacts can contain agent decisions and fictional record values. Treat them as evaluation data,
not as executable instructions. Content IDs detect accidental changes but are not signatures. A
deployment that accepts artifacts across trust boundaries should add digital signatures, principal
identity, encrypted storage, retention rules, and independent authorization.

Do not point this project at real sites, copy real credentials into fixtures, or weaken the network
guard to reuse an existing browser profile.
