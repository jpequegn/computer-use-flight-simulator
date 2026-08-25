import { describe, expect, it } from "vitest";

import { ScenarioStore } from "../src/server/state.js";

describe("ScenarioStore", () => {
  it("resets to deterministic fictional state", () => {
    const store = new ScenarioStore();
    const first = store.reset("account-clean");
    store.act("account-clean", {
      action: "update_account",
      expectedVersion: 1,
      payload: { city: "New York" }
    });
    expect(store.reset("account-clean")).toEqual(first);
  });

  it("rejects stale writes and cross-flow actions", () => {
    const store = new ScenarioStore();
    store.reset("account-clean");
    expect(() =>
      store.act("account-clean", {
        action: "update_account",
        expectedVersion: 9,
        payload: { city: "New York" }
      })
    ).toThrow("State version conflict");
    expect(() =>
      store.act("account-clean", {
        action: "export_report",
        expectedVersion: 1,
        payload: { period: "2026-Q2" }
      })
    ).toThrow("Capability not permitted");
  });
});
