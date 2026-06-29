"use client";

import { useEffect, useMemo, useState } from "react";
import { Factory, Plus } from "lucide-react";
import { Badge } from "@/components/Badge";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { PageHeader } from "@/components/PageHeader";
import { StatePanel } from "@/components/StatePanel";
import { TableFilters } from "@/components/TableFilters";
import { Toast, type ToastState } from "@/components/Toast";
import { createProductionBatch, getProductionBatches } from "@/lib/api";
import { formatKg } from "@/lib/format";
import { canCreateProduction } from "@/lib/roles";
import { matchesSearch, matchesValue, uniqueOptions } from "@/lib/table";
import { useDemoRole } from "@/lib/use-demo-role";
import type { ProductionBatch } from "@/types";

const initialForm = {
  shift: "Morning",
  cane_intake_ids: "",
  actual_sugar_output_kg: "",
  downtime_explanation: "",
};

const columns: DataTableColumn<ProductionBatch>[] = [
  { key: "batch_id", header: "Batch ID", cell: (row) => <span className="font-bold text-ink-900">{row.batch_id}</span> },
  { key: "shift", header: "Shift", cell: (row) => row.shift },
  { key: "cane", header: "Cane Input", cell: (row) => formatKg(row.cane_input_weight_kg) },
  { key: "expected", header: "Expected Output", cell: (row) => formatKg(row.expected_sugar_output_kg) },
  { key: "actual", header: "Actual Output", cell: (row) => <span className="font-bold text-ink-900">{formatKg(row.actual_sugar_output_kg)}</span> },
  { key: "recovery", header: "Recovery", cell: (row) => `${row.recovery_percentage}%` },
  { key: "variance", header: "Variance Status", cell: (row) => <Badge>{row.variance_status}</Badge> },
];

export default function ProductionPage() {
  const role = useDemoRole();
  const [rows, setRows] = useState<ProductionBatch[]>([]);
  const [form, setForm] = useState(initialForm);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const canCreate = canCreateProduction(role);

  useEffect(() => {
    getProductionBatches()
      .then(setRows)
      .catch((requestError) => setError(requestError instanceof Error ? requestError.message : "Production batches could not load."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timeout = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const statusOptions = useMemo(() => uniqueOptions(rows.map((row) => row.variance_status)), [rows]);
  const filteredRows = useMemo(
    () => rows.filter((row) => matchesSearch(row, search) && matchesValue(row.variance_status, status)),
    [rows, search, status],
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const caneIds = form.cane_intake_ids
        .split(",")
        .map((value) => Number(value.trim()))
        .filter((value) => Number.isFinite(value) && value > 0);
      const created = await createProductionBatch({
        shift: form.shift,
        cane_intake_ids: caneIds,
        actual_sugar_output_kg: Number(form.actual_sugar_output_kg),
        downtime_explanation: form.downtime_explanation || null,
      });
      setRows((current) => [created, ...current]);
      setForm(initialForm);
      setToast({ tone: "success", message: "Production batch posted with mass-balance checks." });
    } catch (requestError) {
      setToast({ tone: "error", message: requestError instanceof Error ? requestError.message : "Production batch was rejected." });
    }
  }

  return (
    <>
      <PageHeader
        title="Production Batches"
        eyebrow="Factory floor"
        description="Shift-level conversion of cane input into expected and actual sugar output with recovery variance."
        icon={Factory}
      />

      {canCreate ? (
        <form onSubmit={handleSubmit} className="mb-6 rounded-lg border border-ink-100 bg-white p-5 shadow-soft">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-bold text-ink-900">Create Production Batch</h2>
            <button
              type="submit"
              className="inline-flex h-10 items-center gap-2 rounded-md bg-ink-900 px-4 text-sm font-bold text-white transition hover:bg-compliance-green"
            >
              <Plus aria-hidden="true" className="h-4 w-4" />
              Create
            </button>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="grid gap-1.5 text-sm font-semibold text-ink-700">
              Shift
              <select value={form.shift} onChange={(event) => setForm({ ...form, shift: event.target.value })} className="h-10 rounded-md border border-ink-200 px-3 outline-none focus:border-compliance-green focus:ring-2 focus:ring-emerald-100">
                <option>Morning</option>
                <option>Evening</option>
                <option>Night</option>
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-ink-700">
              Cane intake IDs
              <input required placeholder="1, 2" value={form.cane_intake_ids} onChange={(event) => setForm({ ...form, cane_intake_ids: event.target.value })} className="h-10 rounded-md border border-ink-200 px-3 outline-none focus:border-compliance-green focus:ring-2 focus:ring-emerald-100" />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-ink-700">
              Actual sugar output
              <input required min="1" type="number" value={form.actual_sugar_output_kg} onChange={(event) => setForm({ ...form, actual_sugar_output_kg: event.target.value })} className="h-10 rounded-md border border-ink-200 px-3 outline-none focus:border-compliance-green focus:ring-2 focus:ring-emerald-100" />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-ink-700 xl:col-span-1">
              Downtime explanation
              <input value={form.downtime_explanation} onChange={(event) => setForm({ ...form, downtime_explanation: event.target.value })} className="h-10 rounded-md border border-ink-200 px-3 outline-none focus:border-compliance-green focus:ring-2 focus:ring-emerald-100" />
            </label>
          </div>
        </form>
      ) : null}

      <TableFilters
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search batch, shift, explanation"
        filters={[
          {
            label: "Variance",
            value: status,
            onChange: setStatus,
            options: [{ label: "All variance", value: "all" }, ...statusOptions.map((value) => ({ label: value, value }))],
          },
        ]}
      />

      {loading ? <StatePanel type="loading" title="Loading production batches" /> : null}
      {error ? <StatePanel type="error" title="Production unavailable" detail={error} /> : null}
      {!loading && !error ? (
        <DataTable columns={columns} rows={filteredRows} getRowKey={(row) => row.id} emptyText="No production batches match the current filters." />
      ) : null}
      <Toast toast={toast} />
    </>
  );
}
