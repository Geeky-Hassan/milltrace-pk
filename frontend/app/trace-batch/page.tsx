"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock, GitBranch, Hash, ShieldAlert } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/Badge";
import { PageHeader } from "@/components/PageHeader";
import { StatePanel } from "@/components/StatePanel";
import { getBatchTrace, getProductionBatches } from "@/lib/api";
import { bagsFromKg, formatBags, formatDateTime, formatTonsFromKg } from "@/lib/format";
import type { BatchTrace, ProductionBatch } from "@/types";

function shortHash(value?: string | null) {
  return value ? `${value.slice(0, 12)}...` : "No hash";
}

export default function TraceBatchPage() {
  const [batches, setBatches] = useState<ProductionBatch[]>([]);
  const [selectedBatch, setSelectedBatch] = useState("");
  const [trace, setTrace] = useState<BatchTrace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const requestedBatch = new URLSearchParams(window.location.search).get("batch");
    getProductionBatches()
      .then((data) => {
        setBatches(data);
        setSelectedBatch((current) => current || requestedBatch || data[0]?.batch_id || "");
      })
      .catch((requestError) => setError(requestError instanceof Error ? requestError.message : "Batches could not load."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedBatch) return;
    getBatchTrace(selectedBatch)
      .then(setTrace)
      .catch((requestError) => setError(requestError instanceof Error ? requestError.message : "Batch trace could not load."));
  }, [selectedBatch]);

  const selected = useMemo(() => batches.find((batch) => batch.batch_id === selectedBatch), [batches, selectedBatch]);
  const expectedBags = selected ? bagsFromKg(selected.actual_sugar_output_kg) : 0;

  return (
    <AppShell>
      <PageHeader
        title="Trace One Batch"
        eyebrow="End-to-end accountability"
        description="Follow one production batch from cane intake through serials, warehouse custody, dispatch, receipt, exceptions, and audit hashes."
        icon={GitBranch}
        action={<Badge tone={selected?.variance_status === "CRITICAL" ? "danger" : selected?.variance_status === "WARNING" ? "warning" : "success"}>{selected?.variance_status ?? "Trace"}</Badge>}
      />

      <section className="mb-6 rounded-lg border border-ink-100 bg-white p-5 shadow-soft">
        <div className="grid gap-4 lg:grid-cols-[0.9fr_1.4fr] lg:items-end">
          <label className="grid gap-1.5 text-sm font-semibold text-ink-700">
            Batch
            <select value={selectedBatch} onChange={(event) => setSelectedBatch(event.target.value)} className="h-10 rounded-md border border-ink-200 px-3 outline-none focus:border-compliance-green focus:ring-2 focus:ring-emerald-100">
              {batches.map((batch) => (
                <option key={batch.batch_id} value={batch.batch_id}>{batch.batch_id}</option>
              ))}
            </select>
          </label>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricTile label="Cane input" value={selected ? formatTonsFromKg(selected.cane_input_weight_kg) : "..."} />
            <MetricTile label="Actual sugar" value={selected ? formatTonsFromKg(selected.actual_sugar_output_kg) : "..."} />
            <MetricTile label="Expected bags" value={selected ? formatBags(expectedBags) : "..."} />
            <MetricTile label="Recovery" value={selected ? `${selected.recovery_percentage}%` : "..."} />
          </div>
        </div>
        <div className="mt-4 rounded-lg bg-ink-50 p-4 ring-1 ring-ink-100">
          <p className="text-xs font-bold uppercase text-ink-500">Trace summary</p>
          <p className="mt-2 text-sm font-semibold leading-6 text-ink-800">{trace?.summary ?? "Select a batch to load its trace evidence."}</p>
        </div>
      </section>

      {loading ? <StatePanel type="loading" title="Loading trace evidence" /> : null}
      {error ? <StatePanel type="error" title="Trace unavailable" detail={error} /> : null}

      {trace ? (
        <section className="rounded-lg border border-ink-100 bg-white p-5 shadow-soft">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-compliance-green" aria-hidden="true" />
            <h2 className="text-base font-bold text-ink-900">Lifecycle Timeline</h2>
          </div>
          <div className="mt-6 space-y-4">
            {trace.steps.map((step, index) => (
              <article key={`${step.stage}-${index}`} className="grid min-w-0 gap-4 rounded-lg border border-ink-100 p-4 md:grid-cols-[9rem_minmax(0,1fr)]">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-emerald-50 text-sm font-bold text-compliance-green ring-1 ring-emerald-100">{index + 1}</span>
                    <Badge>{step.status}</Badge>
                  </div>
                  <p className="mt-3 text-xs font-semibold leading-5 text-ink-500">{step.timestamp ? formatDateTime(step.timestamp) : "No timestamp"}</p>
                </div>
                <div className="min-w-0">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <h3 className="font-bold text-ink-900">{step.stage}</h3>
                      <p className="mt-1 text-sm leading-6 text-ink-600 [overflow-wrap:anywhere]">{step.evidence}</p>
                    </div>
                    <Badge tone="neutral">{step.actor}</Badge>
                  </div>
                  {step.reason ? (
                    <div className="mt-3 rounded-md bg-ink-50 px-3 py-2 text-xs leading-5 text-ink-600 ring-1 ring-ink-100">
                      <span className="font-bold text-ink-800">Reason: </span>{step.reason}
                    </div>
                  ) : null}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="inline-flex max-w-full items-center gap-2 rounded-full bg-ink-50 px-3 py-1 text-xs font-semibold text-ink-600 ring-1 ring-ink-100 [overflow-wrap:anywhere]">
                      <Hash className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span className="font-mono">{shortHash(step.audit_hash)}</span>
                    </span>
                    {step.related_exceptions.length ? step.related_exceptions.map((item) => (
                      <Badge key={item} tone="danger">{item}</Badge>
                    )) : <Badge tone="success">No related exception</Badge>}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : !loading && !error ? (
        <StatePanel type="empty" title="No trace selected" detail="Select a production batch to build the accountability timeline." />
      ) : null}

      <section className="mt-6 rounded-lg border border-ink-100 bg-white p-5 shadow-soft">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-red-50 text-red-700"><ShieldAlert className="h-5 w-5" aria-hidden="true" /></span>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-ink-900">What This Proves</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-500">
              The batch is a chain of evidence, not a static production row. Each movement is tied to role, timestamp, serial custody, exception reason, and audit hash.
            </p>
          </div>
        </div>
      </section>
    </AppShell>
  );
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md bg-ink-50 p-3 ring-1 ring-ink-100">
      <p className="text-xs font-bold uppercase text-ink-500">{label}</p>
      <p className="mt-1 text-lg font-bold text-ink-900 [overflow-wrap:anywhere]">{value}</p>
    </div>
  );
}
