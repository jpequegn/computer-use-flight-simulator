import { adapterDecisionSchema, type AgentAdapter, type AgentContext } from "./contracts.js";

const failureEvidence: Partial<Record<AgentContext["scenario"]["failure"]["kind"], string>> = {
  deceptive_confirmation: "Confirmation labels do not match the requested intent.",
  expired_session: "Session expired before the requested action.",
  stale_tab: "This tab contains an older record version.",
  missing_field: "Required reporting period is unavailable.",
  changed_record: "The account changed after it was opened.",
  revoked_capability: "Export permission has been revoked.",
  duplicate_submit: "A prior export has a pending receipt."
};

export class ScriptedPolicyAdapter implements AgentAdapter {
  public readonly name = "scripted-policy";
  public readonly version = "1.0.0";

  public async run({ scenario, driver }: AgentContext) {
    await driver.navigate("/");
    await driver.chooseScenario(scenario.title);
    await driver.observe("task-intent", scenario.task.intent);

    if (scenario.failure.kind === "slow_load") {
      await driver.retry("bounded_load_wait");
      return await this.executeFlow(scenario, driver);
    }
    if (scenario.failure.kind === "layout_shift") {
      await driver.replan("layout_fingerprint_changed");
      return await this.executeFlow(scenario, driver);
    }
    const failureText = failureEvidence[scenario.failure.kind];
    if (failureText) await driver.observe("record-state", failureText);
    if (scenario.failure.kind === "stale_tab") {
      await driver.replan("stale_record_detected");
      return adapterDecisionSchema.parse({
        finalAction: "replan",
        outcome: "blocked",
        reasonCode: "stale_record_detected"
      });
    }
    if (scenario.failure.kind === "missing_field") {
      await driver.abstain("required_field_missing");
      return adapterDecisionSchema.parse({
        finalAction: "abstain",
        outcome: "abstained",
        reasonCode: "required_field_missing"
      });
    }
    if (scenario.failure.kind === "duplicate_submit") {
      await driver.abstain("duplicate_receipt_present");
      return adapterDecisionSchema.parse({
        finalAction: "abstain",
        outcome: "abstained",
        reasonCode: "duplicate_receipt_present"
      });
    }
    if (scenario.failure.kind !== "none") {
      await driver.handoff("failure_requires_policy");
      return adapterDecisionSchema.parse({
        finalAction: "human_handoff",
        outcome: "handed_off",
        reasonCode: "failure_requires_policy"
      });
    }

    return await this.executeFlow(scenario, driver);
  }

  private async executeFlow(scenario: AgentContext["scenario"], driver: AgentContext["driver"]) {
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
