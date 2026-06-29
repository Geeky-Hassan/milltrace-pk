"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock, GitBranch, Hash, ShieldAlert } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/Badge";
import { PageHeader } from "@/components/PageHeader";
import { StatePanel } from "@/components/StatePanel";
import { getBatchTrace, getProductionBatches } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
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
        setSelectedBatch((current) => current || requestedBatch || data[0]?.batch_id || "BATCH-2026-A01");
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

  return (
    <AppShell>
      <PageHeader
        title="Trace One Batch"
        eyebrow="End-to-end accountability"
        description="Select a batch and follow its evidence from cane intake through serials, custody, exceptions, and audit hash."
        icon={GitBranch}
        action={<Badge tone={selected?.variance_status === "CRITICAL" ? "danger" : selected?.variance_status === "WARNING" ? "warning" : "success"}>{selected?.variance_status ?? "Trace"}</Badge>}
      />

      <section className="mb-6 rounded-lg border border-ink-100 bg-white p-5 shadow-soft">
        <div className="grid gap-4 md:grid-cols-[0.8fr_1.2fr] md:items-end">
          <label className="grid gap-1.5 text-sm font-semibold text-ink-700">
            Batch
            <select value={selectedBatch} onChange={(event) => setSelectedBatch(event.target.value)} className="h-10 rounded-md border border-ink-200 px-3 outline-none focus:border-compliance-green focus:ring-2 focus:ring-emerald-100">
              {batches.map((batch) => (
                <option key={batch.batch_id} value={batch.batch_id}>{batch.batch_id}</option>
              ))}
            </select>
          </label>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-md bg-ink-50 p-3 ring-1 ring-ink-100">
              <p className="text-xs font-bold uppercase text-ink-500">Cane input</p>
              <p className="mt-1 text-lg font-bold text-ink-900">{selected ? `${selected.cane_input_weight_kg.toLocaleString()} kg` : "..."}</p>
            </div>
            <div className="rounded-md bg-ink-50 p-3 ring-1 ring-ink-100">
              <p className="text-xs font-bold uppercase text-ink-500">Recovery</p>
              <p className="mt-1 text-lg font-bold text-ink-900">{selected ? `${selected.recovery_percentage}%` : "..."}</p>
            </div>
            <div className="rounded-md bg-ink-50 p-3 ring-1 ring-ink-100">
              <p className="text-xs font-bold uppercase text-ink-500">Trace summary</p>
              <p className="mt-1 text-sm font-bold text-ink-900">{trace?.summary ?? "Loading trace"}</p>
            </div>
          </div>
        </div>
      </section>

      {loading ? <StatePanel type="loading" title="Loading batches" /> : null}
      {error ? <StatePanel type="error" title="Trace unavailable" detail={error} /> : null}

      {trace ? (
        <section className="rounded-lg border border-ink-100 bg-white p-5 shadow-soft">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-compliance-green" aria-hidden="true" />
            <h2 className="text-base font-bold text-ink-900">Lifecycle Timeline</h2>
          </div>
          <div className="mt-6 space-y-4">
            {trace.steps.map((step, index) => (
              <article key={`${step.stage}-${index}`} className="grid gap-4 rounded-lg border border-ink-100 p-4 md:grid-cols-[11rem_1fr]">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-emerald-50 text-sm font-bold text-compliance-green ring-1 ring-emerald-100">{index + 1}</span>
                    <Badge>{step.status}</Badge>
                  </div>
                  <p className="mt-3 text-xs font-semibold text-ink-500">{step.timestamp ? formatDateTime(step.timestamp) : "No timestamp"}</p>
                </div>
                <div>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-ink-900">{step.stage}</h3>
                      <p className="mt-1 text-sm leading-6 text-ink-500">{step.evidence}</p>
                    </div>
                    <Badge tone="neutral">{step.actor}</Badge>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-2 rounded-full bg-ink-50 px-3 py-1 text-xs font-semibold text-ink-600 ring-1 ring-ink-100">
                      <Hash className="h-3.5 w-3.5" aria-hidden="true" />
                      {shortHash(step.audit_hash)}
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
          <span className="grid h-10 w-10 place-items-center rounded-md bg-red-50 text-red-700"><ShieldAlert className="h-5 w-5" aria-hidden="true" /></span>
          <div>
            <h2 className="text-base font-bold text-ink-900">What This Proves</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-500">A batch is not just a row in production. It is a chain of linked evidence: intake, output, serials, custody, dispatch, receipt, exceptions, and audit hashes.</p>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
