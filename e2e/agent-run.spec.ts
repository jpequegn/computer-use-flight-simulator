import { expect, test } from "@playwright/test";

import { runAgentOnPage } from "../src/agent/runner.js";
import { ScriptedPolicyAdapter } from "../src/agent/scripted-adapter.js";
import { SCENARIOS } from "../src/fixtures/scenarios.js";

for (const id of ["invoice-clean", "account-clean", "report-clean"]) {
  test(`scripted policy agent completes ${id} through the browser`, async ({ page, baseURL }) => {
    const scenario = SCENARIOS.find((item) => item.id === id);
    if (!scenario || !baseURL) throw new Error("Missing browser test configuration");
    const result = await runAgentOnPage({
      page,
      baseUrl: baseURL,
      scenario,
      adapter: new ScriptedPolicyAdapter()
    });
    expect(result.trajectory.outcome).toBe("completed");
    expect(result.trajectory.sideEffectCount).toBe(1);
    expect(result.trajectory.events.at(-1)?.reasonCode).toBe("receipt_verified");
  });
}
