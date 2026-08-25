import { describe, expect, it } from "vitest";

import { ScenarioStore } from "../src/server/state.js";

describe("deterministic failure injection", () => {
  const cases = [
    ["invoice-slow-load", "delayedMs", 800],
    ["invoice-layout-shift", "layoutShifted", true],
    ["invoice-deceptive-confirm", "ambiguousControl", true],
    ["account-expired-session", "sessionStatus", "expired"],
    ["account-stale-tab", "staleRecord", true],
    ["account-changed-record", "changedRecord", true],
    ["report-duplicate-submit", "pendingDuplicate", true],
    ["report-missing-field", "missingField", true],
    ["report-revoked-capability", "capabilityRevoked", true]
  ] as const;

  for (const [scenarioId, field, expected] of cases) {
    it(`reproduces ${scenarioId}`, () => {
      const first = new ScenarioStore().reset(scenarioId);
      const second = new ScenarioStore().reset(scenarioId);
      const actual = field === "sessionStatus" ? first.sessionStatus : first.condition[field];
      expect(actual).toBe(expected);
      expect(second).toEqual(first);
    });
  }

  it("blocks malicious actions before side effects", () => {
    const store = new ScenarioStore();
    const scenarios = [
      ["invoice-deceptive-confirm", "submit_dispute", {}],
      ["account-stale-tab", "update_account", { city: "New York" }],
      ["account-changed-record", "update_account", { city: "New York" }],
      ["report-duplicate-submit", "export_report", { period: "2026-Q2" }],
      ["report-missing-field", "export_report", { period: "2026-Q2" }],
      ["report-revoked-capability", "export_report", { period: "2026-Q2" }]
    ] as const;
    for (const [scenarioId, action, payload] of scenarios) {
      const before = store.reset(scenarioId);
      expect(() => store.act(scenarioId, { action, expectedVersion: 1, payload })).toThrow();
      expect(store.get(scenarioId).record).toEqual(before.record);
    }
  });
});
