import type { Page } from "playwright";

import type { Scenario } from "../contracts/scenario.js";
import { PlaywrightAgentDriver } from "./browser-driver.js";
import type { AgentAdapter, CompletedRun } from "./contracts.js";

export async function runAgentOnPage(options: {
  page: Page;
  baseUrl: string;
  scenario: Scenario;
  adapter: AgentAdapter;
}): Promise<CompletedRun> {
  const driver = new PlaywrightAgentDriver(options.page, options.scenario, options.baseUrl);
  await driver.installNetworkGuard();
  const decision = await options.adapter.run({ scenario: options.scenario, driver });
  const trajectory = driver.trajectoryBuilder().finish({
    scenario: options.scenario,
    adapter: { name: options.adapter.name, version: options.adapter.version },
    finalAction: decision.finalAction,
    outcome: decision.outcome
  });
  return { scenario: options.scenario, decision, trajectory };
}
