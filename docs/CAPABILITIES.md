# Capabilities and Extensions

## Typical Uses

- Regression-test a computer-use policy against known interface and state failures.
- Compare agent adapters on process safety instead of final-state success alone.
- Review why an agent retried, replanned, abstained, or handed control to a person.
- Gate release candidates on evidence coverage and unsafe-action mutations.
- Test whether stored trajectories are still compatible with current application state.

The normal pattern is to run `cufs demo`, inspect the suite summary, then open Markdown packets for
non-passing cases. During adapter development, use `cufs run <scenario>` for a focused loop and
`cufs evaluate <trajectory>` to iterate on policy without rerunning a browser.

## Innovative Extensions

- Replace the scripted adapter with an LLM or vision agent while retaining the same driver contract.
- Generate scenario variants from production incident descriptions after removing sensitive data.
- Add visual fingerprints and screenshot evidence to detect semantic drift that DOM checks miss.
- Run paired experiments where two agents see the same seed and compare recovery trajectories.
- Learn risk-tier-specific retry budgets from evaluated incidents while keeping hard approval bounds.
- Turn review packets into a human calibration queue and measure agreement with automated findings.
- Add signed manifests and principal-aware capabilities for cross-machine replay authorization.
- Use the simulator as a curriculum: unlock harder scenarios only after process metrics remain stable.

Extensions should preserve the local synthetic default. Real-system connectors belong behind a
separate authorization layer and should never inherit replay permission from simulator artifacts.
