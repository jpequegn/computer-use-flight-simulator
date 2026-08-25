import { contentId } from "../lib/canonical-json.js";
import { scenarioSchema, type Scenario } from "./scenario.js";

export interface IdentifiedScenario {
  scenario: Scenario;
  contentId: string;
}

export function validateScenarioCorpus(input: readonly unknown[]): IdentifiedScenario[] {
  const scenarios = input.map((item) => scenarioSchema.parse(item));
  const ids = new Set<string>();
  return scenarios.map((scenario) => {
    if (ids.has(scenario.id)) throw new Error(`Duplicate scenario id: ${scenario.id}`);
    ids.add(scenario.id);
    return { scenario, contentId: contentId(scenario) };
  });
}
