"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, FlaskConical, RotateCcw, ShieldAlert, Sparkles } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/Badge";
import { PageHeader } from "@/components/PageHeader";
import { StatePanel } from "@/components/StatePanel";
import { Toast, type ToastState } from "@/components/Toast";
import { getDemoScenarios, getGapMap, resetDemoData, runDemoScenario } from "@/lib/api";
import { demoScenarios } from "@/lib/demo-scenarios";
import { useDemoRole } from "@/lib/use-demo-role";
import type { DemoScenario, DemoScenarioRun, GapMapItem } from "@/types";

const storyCards = [
  { title: "Clean Batch", scenario: "best-compliant-flow", description: "Everything matched. No exception. Low risk.", batch: "PB-MBR-MRN-26A01" },
  { title: "Suspicious Batch", scenario: "serial-gap-detected", description: "Recovery variance and serial gap detected. Needs review.", batch: "PB-MBR-NGT-26C14" },
  { title: "Fraud Chain", scenario: "complete-fraud-chain", description: "Multiple red flags across production, packaging, dispatch, and receipt.", batch: "PB-MBR-NGT-26C14" },
];

function difficultyTone(value: string) {
  if (value === "Best Case" || value === "Normal Case") return "success";
  if (value === "Edge Case") return "warning";
  if (value === "High Risk" || value === "Worst Case") return "danger";
  return "neutral";
}

export default function ScenarioLabPage() {
  const role = useDemoRole();
  const [scenarios, setScenarios] = useState<DemoScenario[]>(demoScenarios);
  const [gaps, setGaps] = useState<GapMapItem[]>([]);
  const [selectedId, setSelectedId] = useState(demoScenarios[0].id);
  const [result, setResult] = useState<DemoScenarioRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);

  useEffect(() => {
    Promise.all([getDemoScenarios(), getGapMap()])
      .then(([scenarioData, gapData]) => {
        setScenarios(scenarioData);
        setGaps(gapData);
        setSelectedId(scenarioData[0]?.id ?? demoScenarios[0].id);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const selected = useMemo(
    () => scenarios.find((scenario) => scenario.id === selectedId) ?? scenarios[0],
    [scenarios, selectedId],
  );

  async function handleRun(scenarioId = selectedId) {
    try {
      setRunning(true);
      const run = await runDemoScenario(scenarioId);
      setResult(run);
      setSelectedId(scenarioId);
      setToast({ tone: run.status === "PASSED" ? "success" : "error", message: `${run.scenario_name} executed: ${run.status}` });
    } catch (error) {
      setToast({ tone: "error", message: error instanceof Error ? error.message : "Scenario could not run." });
    } finally {
      setRunning(false);
    }
  }

  async function handleReset() {
    try {
      setRunning(true);
      const response = await resetDemoData();
      setResult(null);
      setToast({ tone: "success", message: response.message });
    } catch (error) {
      setToast({ tone: "error", message: error instanceof Error ? error.message : "Reset failed." });
    } finally {
      setRunning(false);
    }
  }

  return (
    <AppShell>
      <PageHeader
        title="Scenario Lab"
        eyebrow="Best-to-worst testing"
        description="Run controlled demo cases that prove how MillTrace PK detects loopholes across the sugar supply chain."
        icon={FlaskConical}
        action={<Badge tone="blue">{role.replaceAll("_", " ")}</Badge>}
      />

      {loading ? <StatePanel type="loading" title="Loading scenarios" /> : null}

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="grid gap-3">
          {scenarios.map((scenario) => (
            <button
              key={scenario.id}
              type="button"
              onClick={() => setSelectedId(scenario.id)}
              className={`rounded-lg border p-4 text-left shadow-soft transition hover:border-emerald-200 hover:bg-emerald-50/30 ${selectedId === scenario.id ? "border-emerald-300 bg-emerald-50/60" : "border-ink-100 bg-white"}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-bold text-ink-900">{scenario.name}</h2>
                <Badge tone={difficultyTone(scenario.difficulty)}>{scenario.difficulty}</Badge>
              </div>
              <p className="mt-2 text-sm leading-6 text-ink-500">{scenario.description}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge tone="neutral">{scenario.gap_tested}</Badge>
                {scenario.expected_exceptions.slice(0, 2).map((item) => <Badge key={item} tone="warning">{item}</Badge>)}
              </div>
            </button>
          ))}
        </div>

        <div className="space-y-6">
          {selected ? (
            <section className="rounded-lg border border-ink-100 bg-white p-5 shadow-soft">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Badge tone={difficultyTone(selected.difficulty)}>{selected.difficulty}</Badge>
                  <h2 className="mt-3 text-xl font-bold text-ink-900">{selected.name}</h2>
                  <p className="mt-2 text-sm leading-6 text-ink-500">{selected.description}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => void handleRun()} disabled={running} className="inline-flex h-10 items-center gap-2 rounded-md bg-ink-900 px-4 text-sm font-bold text-white transition hover:bg-compliance-green disabled:bg-ink-300">
                    <Sparkles className="h-4 w-4" aria-hidden="true" />
                    Run Scenario
                  </button>
                  <button onClick={() => void handleReset()} disabled={running} className="inline-flex h-10 items-center gap-2 rounded-md border border-ink-200 bg-white px-4 text-sm font-bold text-ink-600 transition hover:bg-ink-50 disabled:text-ink-300">
                    <RotateCcw className="h-4 w-4" aria-hidden="true" />
                    Reset Demo Data
                  </button>
                </div>
              </div>
              <div className="mt-5 grid gap-4 md:grid-cols-3">
                <div className="rounded-lg bg-ink-50 p-4 ring-1 ring-ink-100">
                  <p className="text-xs font-bold uppercase text-ink-500">Gap tested</p>
                  <p className="mt-2 text-sm font-bold text-ink-900">{selected.gap_tested}</p>
                </div>
                <div className="rounded-lg bg-ink-50 p-4 ring-1 ring-ink-100">
                  <p className="text-xs font-bold uppercase text-ink-500">Expected detection</p>
                  <p className="mt-2 text-sm font-bold text-ink-900">{selected.expected_detection}</p>
                </div>
                <div className="rounded-lg bg-ink-50 p-4 ring-1 ring-ink-100">
                  <p className="text-xs font-bold uppercase text-ink-500">Expected exceptions</p>
                  <p className="mt-2 text-sm font-bold text-ink-900">{selected.expected_exceptions.length ? selected.expected_exceptions.join(", ") : "None"}</p>
                </div>
              </div>
            </section>
          ) : null}

          <section className="rounded-lg border border-ink-100 bg-white p-5 shadow-soft">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-compliance-green" aria-hidden="true" />
              <h2 className="text-base font-bold text-ink-900">Result Panel</h2>
            </div>
            {result ? (
              <div className="mt-5 grid gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={result.status === "PASSED" ? "success" : "warning"}>{result.status}</Badge>
                  <Badge tone="neutral">{result.scenario_type}</Badge>
                  <Badge tone={result.risk_score_after > result.risk_score_before ? "danger" : "success"}>Risk {result.risk_score_before} to {result.risk_score_after}</Badge>
                </div>
                <p className="text-sm leading-6 text-ink-600">{result.what_happened}</p>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-lg bg-ink-50 p-4 ring-1 ring-ink-100">
                    <p className="text-xs font-bold uppercase text-ink-500">Actual detection</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {result.actual_exceptions.length ? result.actual_exceptions.map((item) => <Badge key={item}>{item}</Badge>) : <Badge tone="success">No red flags</Badge>}
                    </div>
                  </div>
                  <div className="rounded-lg bg-ink-50 p-4 ring-1 ring-ink-100">
                    <p className="text-xs font-bold uppercase text-ink-500">Audit logs created</p>
                    <p className="mt-2 text-2xl font-bold text-ink-900">{result.audit_logs_created}</p>
                  </div>
                </div>
              </div>
            ) : (
              <StatePanel type="empty" title="No scenario run yet" detail="Select a scenario and run it to see detection, audit, and risk impact." />
            )}
          </section>
        </div>
      </section>

      <section className="mt-6 rounded-lg border border-ink-100 bg-white p-5 shadow-soft">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-compliance-green" aria-hidden="true" />
          <h2 className="text-base font-bold text-ink-900">Demo Story</h2>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {storyCards.map((story) => (
            <article key={story.title} className="rounded-lg border border-ink-100 p-4">
              <h3 className="font-bold text-ink-900">{story.title}</h3>
              <p className="mt-2 text-sm leading-6 text-ink-500">{story.description}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href={`/trace-batch?batch=${story.batch}`} className="rounded-md border border-ink-200 px-3 py-2 text-xs font-bold text-ink-700 hover:bg-ink-50">View flow</Link>
                <button type="button" onClick={() => void handleRun(story.scenario)} className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-compliance-green hover:bg-emerald-100">Run scenario</button>
                <Link href="/dashboard/exceptions" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-100">View exceptions</Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-6 rounded-lg border border-ink-100 bg-white p-5 shadow-soft">
        <h2 className="text-base font-bold text-ink-900">Gap Resolution Map</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {gaps.slice(0, 9).map((gap) => (
            <article key={gap.gap_name} className="rounded-lg border border-ink-100 p-4">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-bold text-ink-900">{gap.gap_name}</h3>
                <Badge tone={gap.mvp_status.includes("Simulated") ? "warning" : "success"}>{gap.mvp_status}</Badge>
              </div>
              <p className="mt-2 text-sm leading-6 text-ink-500">{gap.system_control}</p>
              <p className="mt-3 text-xs font-bold uppercase text-ink-500">Scenario</p>
              <p className="mt-1 text-sm font-bold text-ink-900">{gap.demo_scenario}</p>
            </article>
          ))}
        </div>
      </section>
      <Toast toast={toast} />
    </AppShell>
  );
}
