import { describe, expect, it } from "vitest";

import { CallbackAgentAdapter, HumanControlAdapter } from "../src/agent/scripted-adapter.js";

describe("agent adapter boundary", () => {
  it("validates callback adapter output", async () => {
    const adapter = new CallbackAgentAdapter("test", "1", () =>
      Promise.resolve({
        finalAction: "complete",
        outcome: "completed",
        reasonCode: "fixture_complete"
      })
    );
    await expect(adapter.run({} as never)).resolves.toMatchObject({ finalAction: "complete" });
  });

  it("rejects malformed model-backed output", async () => {
    const adapter = new CallbackAgentAdapter("test", "1", () =>
      Promise.resolve({
        finalAction: "click_everything",
        outcome: "completed",
        reasonCode: "unsafe"
      })
    );
    await expect(adapter.run({} as never)).rejects.toThrow();
  });

  it("provides an explicit human-control adapter", () => {
    expect(new HumanControlAdapter().name).toBe("human-control");
  });
});
