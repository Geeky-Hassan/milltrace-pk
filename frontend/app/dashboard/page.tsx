"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Boxes, Database, Factory, Gauge, PackageCheck, RotateCcw, Scale, ScrollText, TrendingUp, Truck, Trash2 } from "lucide-react";
import { Badge } from "@/components/Badge";
import { ConfirmModal } from "@/components/ConfirmModal";
import { DashboardCard } from "@/components/DashboardCard";
import { PageHeader } from "@/components/PageHeader";
import { StatePanel } from "@/components/StatePanel";
import { Toast, type ToastState } from "@/components/Toast";
import { clearSeedData, getDashboardSummary, loadSeedData } from "@/lib/api";
import { canControlDemoData, stakeholderLenses } from "@/lib/roles";
import { useDemoRole } from "@/lib/use-demo-role";
import type { DashboardSummary } from "@/types";

const metricIcons = [Scale, Factory, PackageCheck, Gauge, ScrollText, Boxes, Truck, AlertTriangle];
const flowLabels: Record<string, string> = {
  cane_intake: "Cane intake",
  production: "Production",
  packaging: "Packaging",
  warehouse: "Warehouse",
  dispatch: "Dispatch",
};

export default function DashboardPage() {
  const role = useDemoRole();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const [demoAction, setDemoAction] = useState<"load" | "clear" | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getDashboardSummary(role)
      .then(setSummary)
      .catch((requestError) => setError(requestError instanceof Error ? requestError.message : "Dashboard could not load."));
  }, [role]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  async function refreshDashboard() {
    const updated = await getDashboardSummary(role);
    setSummary(updated);
  }

  async function handleDemoDataAction() {
    if (!demoAction) return;
    try {
      setBusy(true);
      const response = demoAction === "load" ? await loadSeedData() : await clearSeedData();
      await refreshDashboard();
      setToast({ tone: "success", message: response.message });
      setDemoAction(null);
    } catch (requestError) {
      setToast({ tone: "error", message: requestError instanceof Error ? requestError.message : "Demo data action failed." });
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return <StatePanel type="error" title="Dashboard unavailable" detail={error} />;
  }

  if (!summary) {
    return <StatePanel type="loading" title="Loading dashboard" detail="Preparing current traceability and compliance metrics." />;
  }

  const maxFlow = Math.max(...Object.values(summary.flow), 1);
  const lens = stakeholderLenses[role];
  const LensIcon = lens.icon;
  const intelligence = summary.compliance_intelligence;

  return (
    <>
      <PageHeader
        title="Traceability Dashboard"
        eyebrow={summary.mill.name}
        description="Daily production, serial custody, stock movement, and exception visibility for the demo sugar mill."
        icon={Gauge}
        action={<Badge tone="success">Seeded demo data</Badge>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summary.metrics.map((metric, index) => (
          <DashboardCard key={metric.label} {...metric} icon={metricIcons[index]} />
        ))}
      </div>

      <section className="mt-6 rounded-lg border border-ink-100 bg-white p-5 shadow-soft">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-emerald-50 text-compliance-green ring-1 ring-emerald-100">
              <Database aria-hidden="true" className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-bold text-ink-900">Demo Data Controls</h2>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-ink-500">
                Load a complete seeded demo or clear operational records to manually run the flow from cane intake to receipt.
              </p>
            </div>
          </div>
          {canControlDemoData(role) ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setDemoAction("load")}
                className="inline-flex h-10 items-center gap-2 rounded-md bg-ink-900 px-4 text-sm font-bold text-white transition hover:bg-compliance-green"
              >
                <RotateCcw aria-hidden="true" className="h-4 w-4" />
                Load Seed Data
              </button>
              <button
                type="button"
                onClick={() => setDemoAction("clear")}
                className="inline-flex h-10 items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 text-sm font-bold text-red-700 transition hover:bg-red-100"
              >
                <Trash2 aria-hidden="true" className="h-4 w-4" />
                Clear Demo Data
              </button>
            </div>
          ) : (
            <Badge tone="neutral" className="max-w-full whitespace-normal text-left">
              Switch to Mill Owner or Government Admin to reset demo data.
            </Badge>
          )}
        </div>
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <section className="rounded-lg border border-ink-100 bg-white p-5 shadow-soft">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-ink-900">Material Flow</h2>
              <p className="mt-1 text-sm text-ink-500">Cane to dispatch weight movement, shown in tons.</p>
            </div>
            <Badge tone="neutral">Today</Badge>
          </div>
          <div className="mt-6 space-y-5">
            {Object.entries(summary.flow).map(([key, value]) => (
              <div key={key}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-ink-700">{flowLabels[key]}</span>
                  <span className="font-bold text-ink-900">{value} tons</span>
                </div>
                <div className="mt-2 h-3 rounded-full bg-ink-100">
                  <div className="h-3 rounded-full bg-compliance-green" style={{ width: `${Math.max((value / maxFlow) * 100, 8)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-ink-100 bg-white p-5 shadow-soft">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-md bg-emerald-50 text-compliance-green">
              <LensIcon aria-hidden="true" className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-bold text-ink-900">{lens.title}</h2>
              <p className="mt-1 text-sm leading-6 text-ink-500">{lens.detail}</p>
            </div>
          </div>
          <div className="mt-6 rounded-lg bg-ink-50 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-ink-500">Exception severity</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {Object.entries(summary.exception_breakdown).map(([severity, count]) => (
                <div key={severity} className="rounded-md bg-white p-3 ring-1 ring-ink-100">
                  <p className="text-xs font-semibold text-ink-500">{severity}</p>
                  <p className="mt-1 text-2xl font-bold text-ink-900">{count}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {intelligence ? (
        <section className="mt-6 rounded-lg border border-ink-100 bg-white p-5 shadow-soft">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="grid h-9 w-9 place-items-center rounded-md bg-ink-900 text-white">
                  <TrendingUp aria-hidden="true" className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="text-base font-bold text-ink-900">Compliance Intelligence</h2>
                  <p className="mt-1 text-sm text-ink-500">Current risk score, root pressure points, and recommended actions.</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-md bg-ink-50 p-3 ring-1 ring-ink-100">
                <p className="text-xs font-bold uppercase text-ink-500">Risk score</p>
                <p className="mt-1 text-2xl font-bold text-ink-900">{intelligence.risk_score}</p>
              </div>
              <div className="rounded-md bg-ink-50 p-3 ring-1 ring-ink-100">
                <p className="text-xs font-bold uppercase text-ink-500">Level</p>
                <div className="mt-2">
                  <Badge>{intelligence.risk_level}</Badge>
                </div>
              </div>
              <div className="rounded-md bg-ink-50 p-3 ring-1 ring-ink-100">
                <p className="text-xs font-bold uppercase text-ink-500">Trend</p>
                <p className="mt-2 text-sm font-bold capitalize text-ink-900">{intelligence.risk_trend}</p>
              </div>
              <div className="rounded-md bg-ink-50 p-3 ring-1 ring-ink-100">
                <p className="text-xs font-bold uppercase text-ink-500">Risk stage</p>
                <p className="mt-2 text-sm font-bold text-ink-900">{intelligence.highest_risk_stage ?? "None"}</p>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
            <div className="rounded-lg border border-ink-100 p-4">
              <p className="text-xs font-bold uppercase text-ink-500">Most common exception</p>
              <p className="mt-2 text-lg font-bold text-ink-900">{intelligence.most_common_exception_type ?? "No open pattern"}</p>
              <p className="mt-3 text-sm leading-6 text-ink-500">
                Risk score weighs critical exceptions, serial gaps, receipt delays, dispatch mismatches, manual overrides, and open age.
              </p>
            </div>
            <div className="grid gap-3">
              {intelligence.top_risks.length === 0 ? (
                <StatePanel type="empty" title="No active risks" detail="The demo mill has no open compliance risks in the current filter." />
              ) : (
                intelligence.top_risks.slice(0, 5).map((risk) => (
                  <article key={`${risk.type}-${risk.stage}`} className="rounded-lg border border-ink-100 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge>{risk.severity}</Badge>
                        <Badge tone="neutral">{risk.stage}</Badge>
                      </div>
                      <span className="text-xs font-bold text-ink-500">+{risk.score_impact} risk</span>
                    </div>
                    <h3 className="mt-3 text-sm font-bold text-ink-900">{risk.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-ink-500">{risk.suggested_action}</p>
                  </article>
                ))
              )}
            </div>
          </div>
        </section>
      ) : null}

      <section className="mt-6 rounded-lg border border-ink-100 bg-white p-5 shadow-soft">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-ink-900">Recovery Trend</h2>
            <p className="mt-1 text-sm text-ink-500">Expected recovery compared with actual recovery by shift.</p>
          </div>
          <Badge tone="warning">Variance watched</Badge>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {summary.recovery_trend.map((item) => (
            <div key={item.shift} className="rounded-lg border border-ink-100 p-4">
              <div className="flex items-center justify-between">
                <p className="font-bold text-ink-900">{item.shift}</p>
                <Badge tone={item.actual < 10 ? "danger" : item.actual < item.expected ? "warning" : "success"}>{item.actual}%</Badge>
              </div>
              <div className="mt-4 space-y-3">
                <div>
                  <div className="flex justify-between text-xs font-semibold text-ink-500">
                    <span>Expected</span>
                    <span>{item.expected}%</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-ink-100">
                    <div className="h-2 rounded-full bg-sky-500" style={{ width: `${item.expected * 8}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs font-semibold text-ink-500">
                    <span>Actual</span>
                    <span>{item.actual}%</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-ink-100">
                    <div className="h-2 rounded-full bg-compliance-green" style={{ width: `${item.actual * 8}%` }} />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <ConfirmModal
        open={Boolean(demoAction)}
        title={demoAction === "clear" ? "Clear demo operational data?" : "Load seed data?"}
        description={
          demoAction === "clear"
            ? "This will clear demo operational data only. Roles and system settings will remain."
            : "This loads the stakeholder demo dataset. Existing seed data will not be duplicated."
        }
        confirmLabel={demoAction === "clear" ? "Clear Demo Data" : "Load Seed Data"}
        reasonLabel={demoAction === "clear" ? "Confirmation reason" : "Note"}
        requireReason={demoAction === "clear"}
        busy={busy}
        onCancel={() => setDemoAction(null)}
        onConfirm={() => void handleDemoDataAction()}
      />
      <Toast toast={toast} />
    </>
  );
}
