"use client";

import { useEffect, useMemo, useState } from "react";
import { Factory, Plus } from "lucide-react";
import { Badge } from "@/components/Badge";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { PageHeader } from "@/components/PageHeader";
import { StatePanel } from "@/components/StatePanel";
import { TableFilters } from "@/components/TableFilters";
import { Toast, type ToastState } from "@/components/Toast";
import { createProductionBatch, getCaneIntakes, getProductionBatches } from "@/lib/api";
import { formatTonsFromKg, kgFromTons } from "@/lib/format";
import { canCreateProduction } from "@/lib/roles";
import { matchesSearch, matchesValue, uniqueOptions } from "@/lib/table";
import { useDemoRole } from "@/lib/use-demo-role";
import type { CaneIntake, ProductionBatch } from "@/types";

const initialForm = {
  shift: "Morning",
  cane_intake_ids: "",
  actual_sugar_output_tons: "",
  downtime_explanation: "",
};

const columns: DataTableColumn<ProductionBatch>[] = [
  { key: "batch_id", header: "Batch ID", cell: (row) => <span className="font-bold text-ink-900">{row.batch_id}</span> },
  { key: "shift", header: "Shift", cell: (row) => row.shift },
  { key: "cane", header: "Cane Input", cell: (row) => formatTonsFromKg(row.cane_input_weight_kg) },
  { key: "expected", header: "Expected Output", cell: (row) => formatTonsFromKg(row.expected_sugar_output_kg) },
  { key: "actual", header: "Actual Output", cell: (row) => <span className="font-bold text-ink-900">{formatTonsFromKg(row.actual_sugar_output_kg)}</span> },
  { key: "recovery", header: "Recovery", cell: (row) => `${row.recovery_percentage}%` },
  { key: "variance", header: "Variance Status", cell: (row) => <Badge>{row.variance_status}</Badge> },
];

export default function ProductionPage() {
  const role = useDemoRole();
  const [rows, setRows] = useState<ProductionBatch[]>([]);
  const [intakes, setIntakes] = useState<CaneIntake[]>([]);
  const [form, setForm] = useState(initialForm);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const canCreate = canCreateProduction(role);

  useEffect(() => {
    Promise.all([getProductionBatches(), getCaneIntakes()])
      .then(([batchRows, intakeRows]) => {
        setRows(batchRows);
        setIntakes(intakeRows);
      })
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
  const selectedIntakeIds = useMemo(
    () => form.cane_intake_ids.split(",").map((value) => value.trim()).filter(Boolean),
    [form.cane_intake_ids],
  );

  function toggleIntake(id: number) {
    const value = String(id);
    const next = selectedIntakeIds.includes(value)
      ? selectedIntakeIds.filter((item) => item !== value)
      : [...selectedIntakeIds, value];
    setForm({ ...form, cane_intake_ids: next.join(", ") });
  }

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
        actual_sugar_output_kg: kgFromTons(form.actual_sugar_output_tons),
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
              Actual sugar output (tons)
              <input required min="0.01" step="0.01" type="number" value={form.actual_sugar_output_tons} onChange={(event) => setForm({ ...form, actual_sugar_output_tons: event.target.value })} className="h-10 rounded-md border border-ink-200 px-3 outline-none focus:border-compliance-green focus:ring-2 focus:ring-emerald-100" />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-ink-700 xl:col-span-1">
              Downtime explanation
              <input value={form.downtime_explanation} onChange={(event) => setForm({ ...form, downtime_explanation: event.target.value })} className="h-10 rounded-md border border-ink-200 px-3 outline-none focus:border-compliance-green focus:ring-2 focus:ring-emerald-100" />
            </label>
          </div>
          <div className="mt-4 rounded-lg bg-ink-50 p-4 ring-1 ring-ink-100">
            <p className="text-xs font-bold uppercase text-ink-500">Available cane intakes</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {intakes.length === 0 ? (
                <span className="text-sm text-ink-500">No cane intakes yet. Create one first.</span>
              ) : (
                intakes.slice(0, 8).map((intake) => {
                  const selected = selectedIntakeIds.includes(String(intake.id));
                  return (
                    <button
                      key={intake.id}
                      type="button"
                      onClick={() => toggleIntake(intake.id)}
                      className={`rounded-md border px-3 py-2 text-xs font-bold transition ${selected ? "border-emerald-300 bg-emerald-50 text-compliance-green" : "border-ink-200 bg-white text-ink-700 hover:bg-ink-50"}`}
                    >
                      {intake.id} - {intake.delivery_id} ({formatTonsFromKg(intake.net_cane_weight_kg)})
                    </button>
                  );
                })
              )}
            </div>
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
