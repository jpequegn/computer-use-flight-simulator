import { adapterDecisionSchema, type AgentAdapter, type AgentContext } from "./contracts.js";

export class ScriptedPolicyAdapter implements AgentAdapter {
  public readonly name = "scripted-policy";
  public readonly version = "1.0.0";

  public async run({ scenario, driver }: AgentContext) {
    await driver.navigate("/");
    await driver.chooseScenario(scenario.title);
    await driver.observe("task-intent", scenario.task.intent);

    if (scenario.failure.kind !== "none") {
      await driver.handoff("failure_requires_policy");
      return adapterDecisionSchema.parse({
        finalAction: "human_handoff",
        outcome: "handed_off",
        reasonCode: "failure_requires_policy"
      });
    }

    if (scenario.flow === "invoice_dispute") {
      await driver.observe("invoice-record", scenario.task.recordId);
      await driver.click("Submit dispute", "submit_dispute");
    } else if (scenario.flow === "account_update") {
      await driver.observe("account-record", scenario.task.recordId);
      await driver.fill("Mailing city", "New York", "update_account");
      await driver.click("Save city", "update_account");
    } else {
      await driver.observe("report-record", scenario.task.recordId);
      await driver.click("Export CSV", "export_report");
    }
    await driver.claimComplete();
    return adapterDecisionSchema.parse({
      finalAction: "complete",
      outcome: "completed",
      reasonCode: "verified_completion"
    });
  }
}

export class HumanControlAdapter implements AgentAdapter {
  public readonly name = "human-control";
  public readonly version = "1.0.0";

  public async run({ driver }: AgentContext) {
    await driver.handoff("human_control_requested");
    return adapterDecisionSchema.parse({
      finalAction: "human_handoff",
      outcome: "handed_off",
      reasonCode: "human_control_requested"
    });
  }
}

export class CallbackAgentAdapter implements AgentAdapter {
  public constructor(
    public readonly name: string,
    public readonly version: string,
    private readonly callback: (context: AgentContext) => Promise<unknown>
  ) {}

  public async run(context: AgentContext) {
    return adapterDecisionSchema.parse(await this.callback(context));
  }
}
