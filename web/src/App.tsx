import {
  AlertTriangle,
  CheckCircle2,
  FileDown,
  FileWarning,
  RefreshCw,
  Save,
  ShieldCheck,
  UserRoundCog
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { StatusBadge } from "./components/StatusBadge.js";
import type { ScenarioSummary, SessionSnapshot } from "./types.js";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? `Request failed: ${String(response.status)}`);
  return body;
}

const flowLabels: Record<ScenarioSummary["flow"], string> = {
  invoice_dispute: "Invoice dispute",
  account_update: "Account update",
  report_export: "Report export"
};

export function App() {
  const [scenarios, setScenarios] = useState<ScenarioSummary[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [snapshot, setSnapshot] = useState<SessionSnapshot | null>(null);
  const [city, setCity] = useState("New York");
  const [period, setPeriod] = useState("2026-Q2");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void request<ScenarioSummary[]>("/api/scenarios").then((items) => {
      setScenarios(items);
      setSelectedId(items[0]?.id ?? "");
    });
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    setBusy(true);
    setError("");
    void request<SessionSnapshot>(`/api/sessions/${selectedId}/reset`, { method: "POST" })
      .then(setSnapshot)
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : "Load failed");
      })
      .finally(() => {
        setBusy(false);
      });
  }, [selectedId]);

  const selected = useMemo(
    () => scenarios.find((scenario) => scenario.id === selectedId),
    [scenarios, selectedId]
  );

  async function act(action: string, payload: Record<string, string> = {}) {
    if (!snapshot) return;
    setBusy(true);
    setError("");
    try {
      setSnapshot(
        await request<SessionSnapshot>(`/api/sessions/${snapshot.scenarioId}/actions`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action, expectedVersion: snapshot.stateVersion, payload })
        })
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  async function resetScenario() {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      setSnapshot(
        await request<SessionSnapshot>(`/api/sessions/${selected.id}/reset`, { method: "POST" })
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Reset failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-mark" aria-hidden="true">
          <ShieldCheck size={22} />
        </div>
        <div>
          <h1>Computer-Use Flight Simulator</h1>
          <p>Synthetic operations console</p>
        </div>
        <StatusBadge tone="safe">local only</StatusBadge>
      </header>

      <aside className="scenario-nav" aria-label="Scenario fixtures">
        <div className="nav-heading">
          <span>Scenarios</span>
          <span className="count">{scenarios.length}</span>
        </div>
        <div className="scenario-list">
          {scenarios.map((scenario) => (
            <button
              className={
                scenario.id === selectedId ? "scenario-button selected" : "scenario-button"
              }
              key={scenario.id}
              onClick={() => {
                setSelectedId(scenario.id);
              }}
              type="button"
            >
              <span>{scenario.title}</span>
              <small>{flowLabels[scenario.flow]}</small>
            </button>
          ))}
        </div>
      </aside>

      <main className="workspace">
        {selected && snapshot ? (
          <>
            <section className="workspace-heading">
              <div>
                <div className="badges">
                  <StatusBadge tone={selected.riskTier === "irreversible" ? "danger" : "neutral"}>
                    {selected.riskTier}
                  </StatusBadge>
                  <StatusBadge tone={selected.failureKind === "none" ? "safe" : "warning"}>
                    {selected.failureKind}
                  </StatusBadge>
                </div>
                <h2>{selected.title}</h2>
                <p>{selected.description}</p>
              </div>
              <button
                className="icon-button"
                title="Reset scenario"
                aria-label="Reset scenario"
                type="button"
                onClick={() => {
                  void resetScenario();
                }}
              >
                <RefreshCw size={18} />
              </button>
            </section>

            <section className="task-band" aria-label="Active task">
              <div>
                <span>Task intent</span>
                <strong>{snapshot.taskIntent}</strong>
              </div>
              <div>
                <span>Evidence ID</span>
                <strong>{snapshot.recordId}</strong>
              </div>
              <div>
                <span>State version</span>
                <strong>{snapshot.stateVersion}</strong>
              </div>
            </section>

            {error ? (
              <div className="notice error" role="alert">
                <AlertTriangle size={18} /> {error}
              </div>
            ) : null}
            {snapshot.receipt ? (
              <div className="notice success" role="status">
                <CheckCircle2 size={18} /> Action recorded: {snapshot.receipt}
              </div>
            ) : null}

            <section className="operation-surface">
              {snapshot.flow === "invoice_dispute" ? (
                <InvoicePanel
                  snapshot={snapshot}
                  busy={busy}
                  onSubmit={() => {
                    void act("submit_dispute");
                  }}
                />
              ) : null}
              {snapshot.flow === "account_update" ? (
                <AccountPanel
                  snapshot={snapshot}
                  busy={busy}
                  city={city}
                  onCityChange={setCity}
                  onSubmit={() => {
                    void act("update_account", { city });
                  }}
                />
              ) : null}
              {snapshot.flow === "report_export" ? (
                <ReportPanel
                  snapshot={snapshot}
                  busy={busy}
                  period={period}
                  onPeriodChange={setPeriod}
                  onSubmit={() => {
                    void act("export_report", { period });
                  }}
                />
              ) : null}
            </section>
          </>
        ) : (
          <div className="loading">{busy ? "Loading synthetic state..." : "Select a scenario"}</div>
        )}
      </main>
    </div>
  );
}

function DefinitionList({ record }: { record: SessionSnapshot["record"] }) {
  return (
    <dl className="record-grid">
      {Object.entries(record).map(([key, value]) => (
        <div key={key}>
          <dt>{key.replaceAll(/([A-Z])/g, " $1").replaceAll("_", " ")}</dt>
          <dd>{String(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

function InvoicePanel({
  snapshot,
  busy,
  onSubmit
}: {
  snapshot: SessionSnapshot;
  busy: boolean;
  onSubmit: () => void;
}) {
  return (
    <div className="panel-layout">
      <div>
        <div className="panel-title">
          <FileWarning size={20} />
          <h3>Invoice review</h3>
        </div>
        <DefinitionList record={snapshot.record} />
      </div>
      <div className="action-panel">
        <span>Proposed action</span>
        <strong>Submit one duplicate-charge dispute</strong>
        <button
          disabled={busy || snapshot.record.disputeSubmitted === true}
          onClick={onSubmit}
          type="button"
        >
          <ShieldCheck size={18} /> Submit dispute
        </button>
      </div>
    </div>
  );
}

function AccountPanel({
  snapshot,
  busy,
  city,
  onCityChange,
  onSubmit
}: {
  snapshot: SessionSnapshot;
  busy: boolean;
  city: string;
  onCityChange: (city: string) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="panel-layout">
      <div>
        <div className="panel-title">
          <UserRoundCog size={20} />
          <h3>Employee account</h3>
        </div>
        <DefinitionList record={snapshot.record} />
      </div>
      <form
        className="action-panel"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <label htmlFor="city">Mailing city</label>
        <input
          id="city"
          value={city}
          onChange={(event) => {
            onCityChange(event.target.value);
          }}
        />
        <button disabled={busy || city.trim().length === 0} type="submit">
          <Save size={18} /> Save city
        </button>
      </form>
    </div>
  );
}

function ReportPanel({
  snapshot,
  busy,
  period,
  onPeriodChange,
  onSubmit
}: {
  snapshot: SessionSnapshot;
  busy: boolean;
  period: string;
  onPeriodChange: (period: string) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="panel-layout">
      <div>
        <div className="panel-title">
          <FileDown size={20} />
          <h3>Report export</h3>
        </div>
        <DefinitionList record={snapshot.record} />
      </div>
      <form
        className="action-panel"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <label htmlFor="period">Reporting period</label>
        <select
          id="period"
          value={period}
          onChange={(event) => {
            onPeriodChange(event.target.value);
          }}
        >
          <option value="2026-Q2">2026 Q2</option>
          <option value="2026-Q1">2026 Q1</option>
        </select>
        <button disabled={busy} type="submit">
          <FileDown size={18} /> Export CSV
        </button>
      </form>
    </div>
  );
}
