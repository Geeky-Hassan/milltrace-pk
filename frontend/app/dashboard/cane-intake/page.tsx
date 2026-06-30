"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Scale } from "lucide-react";
import { Badge } from "@/components/Badge";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { PageHeader } from "@/components/PageHeader";
import { StatePanel } from "@/components/StatePanel";
import { TableFilters } from "@/components/TableFilters";
import { Toast, type ToastState } from "@/components/Toast";
import { createCaneIntake, getCaneIntakes } from "@/lib/api";
import { formatDateTime, formatTonsFromKg, kgFromTons } from "@/lib/format";
import { canCreateCaneIntake } from "@/lib/roles";
import { matchesSearch, matchesValue, uniqueOptions } from "@/lib/table";
import { useDemoRole } from "@/lib/use-demo-role";
import type { CaneIntake } from "@/types";

const initialForm = {
  farmer_supplier_name: "",
  cane_ticket_id: "",
  vehicle_number: "",
  gross_weight_tons: "",
  tare_weight_tons: "",
  collection_point: "",
  operator_name: "",
  manual_weight_override: false,
  override_reason: "",
};

const columns: DataTableColumn<CaneIntake>[] = [
  { key: "delivery_id", header: "Delivery ID", cell: (row) => <span className="font-bold text-ink-900">{row.delivery_id}</span> },
  { key: "farmer", header: "Farmer / Supplier", cell: (row) => row.farmer_supplier_name },
  { key: "vehicle", header: "Vehicle", cell: (row) => row.vehicle_number },
  { key: "gross", header: "Gross Weight", cell: (row) => formatTonsFromKg(row.gross_weight_kg) },
  { key: "tare", header: "Tare Weight", cell: (row) => formatTonsFromKg(row.tare_weight_kg) },
  { key: "net", header: "Net Cane", cell: (row) => <span className="font-bold text-ink-900">{formatTonsFromKg(row.net_cane_weight_kg)}</span> },
  { key: "collection", header: "Collection Point", cell: (row) => row.collection_point },
  { key: "timestamp", header: "Mill Gate", cell: (row) => formatDateTime(row.mill_gate_timestamp) },
  { key: "status", header: "Status", cell: (row) => <Badge>{row.status}</Badge> },
];

export default function CaneIntakePage() {
  const role = useDemoRole();
  const [rows, setRows] = useState<CaneIntake[]>([]);
  const [form, setForm] = useState(initialForm);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const canCreate = canCreateCaneIntake(role);

  useEffect(() => {
    getCaneIntakes()
      .then(setRows)
      .catch((requestError) => setError(requestError instanceof Error ? requestError.message : "Cane intake could not load."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timeout = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const statusOptions = useMemo(() => uniqueOptions(rows.map((row) => row.status)), [rows]);
  const filteredRows = useMemo(
    () => rows.filter((row) => matchesSearch(row, search) && matchesValue(row.status, status)),
    [rows, search, status],
  );
  const netPreviewKg = Math.max(kgFromTons(form.gross_weight_tons || 0) - kgFromTons(form.tare_weight_tons || 0), 0);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const created = await createCaneIntake({
        farmer_supplier_name: form.farmer_supplier_name,
        cane_ticket_id: form.cane_ticket_id || null,
        vehicle_number: form.vehicle_number,
        gross_weight_kg: kgFromTons(form.gross_weight_tons),
        tare_weight_kg: kgFromTons(form.tare_weight_tons),
        collection_point: form.collection_point,
        operator_name: form.operator_name,
        manual_weight_override: form.manual_weight_override,
        override_reason: form.override_reason || null,
        status: "ACCEPTED",
      });
      setRows((current) => [created, ...current]);
      setForm(initialForm);
      setToast({ tone: "success", message: "Cane intake accepted and audit logged." });
    } catch (requestError) {
      setToast({ tone: "error", message: requestError instanceof Error ? requestError.message : "Cane intake was rejected." });
    }
  }

  return (
    <>
      <PageHeader
        title="Cane Intake"
        eyebrow="Mill gate operations"
        description="Daily cane deliveries with weighbridge values, supplier identity, collection point, and gate timestamp."
        icon={Scale}
      />

      {canCreate ? (
        <form onSubmit={handleSubmit} className="mb-6 rounded-lg border border-ink-100 bg-white p-5 shadow-soft">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-bold text-ink-900">Create Cane Intake</h2>
            <button
              type="submit"
              className="inline-flex h-10 items-center gap-2 rounded-md bg-ink-900 px-4 text-sm font-bold text-white transition hover:bg-compliance-green"
            >
              <Plus aria-hidden="true" className="h-4 w-4" />
              Create
            </button>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <label className="grid gap-1.5 text-sm font-semibold text-ink-700">
              Farmer / supplier
              <input required value={form.farmer_supplier_name} onChange={(event) => setForm({ ...form, farmer_supplier_name: event.target.value })} className="h-10 rounded-md border border-ink-200 px-3 outline-none focus:border-compliance-green focus:ring-2 focus:ring-emerald-100" />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-ink-700">
              Cane ticket ID
              <input value={form.cane_ticket_id} onChange={(event) => setForm({ ...form, cane_ticket_id: event.target.value })} className="h-10 rounded-md border border-ink-200 px-3 outline-none focus:border-compliance-green focus:ring-2 focus:ring-emerald-100" />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-ink-700">
              Vehicle number
              <input required value={form.vehicle_number} onChange={(event) => setForm({ ...form, vehicle_number: event.target.value })} className="h-10 rounded-md border border-ink-200 px-3 outline-none focus:border-compliance-green focus:ring-2 focus:ring-emerald-100" />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-ink-700">
              Gross weight (tons)
              <input required min="0.01" step="0.01" type="number" value={form.gross_weight_tons} onChange={(event) => setForm({ ...form, gross_weight_tons: event.target.value })} className="h-10 rounded-md border border-ink-200 px-3 outline-none focus:border-compliance-green focus:ring-2 focus:ring-emerald-100" />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-ink-700">
              Tare weight (tons)
              <input required min="0.01" step="0.01" type="number" value={form.tare_weight_tons} onChange={(event) => setForm({ ...form, tare_weight_tons: event.target.value })} className="h-10 rounded-md border border-ink-200 px-3 outline-none focus:border-compliance-green focus:ring-2 focus:ring-emerald-100" />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-ink-700">
              Collection point
              <input required value={form.collection_point} onChange={(event) => setForm({ ...form, collection_point: event.target.value })} className="h-10 rounded-md border border-ink-200 px-3 outline-none focus:border-compliance-green focus:ring-2 focus:ring-emerald-100" />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-ink-700">
              Operator name
              <input required value={form.operator_name} onChange={(event) => setForm({ ...form, operator_name: event.target.value })} className="h-10 rounded-md border border-ink-200 px-3 outline-none focus:border-compliance-green focus:ring-2 focus:ring-emerald-100" />
            </label>
            <label className="flex items-center gap-3 rounded-md border border-ink-100 bg-ink-50 px-3 py-2 text-sm font-semibold text-ink-700">
              <input type="checkbox" checked={form.manual_weight_override} onChange={(event) => setForm({ ...form, manual_weight_override: event.target.checked })} className="h-4 w-4 accent-compliance-green" />
              Manual weight override
            </label>
            {form.manual_weight_override ? (
              <label className="grid gap-1.5 text-sm font-semibold text-ink-700 xl:col-span-2">
                Override reason
                <input required value={form.override_reason} onChange={(event) => setForm({ ...form, override_reason: event.target.value })} className="h-10 rounded-md border border-ink-200 px-3 outline-none focus:border-compliance-green focus:ring-2 focus:ring-emerald-100" />
              </label>
            ) : null}
            <div className="rounded-md border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm font-semibold text-compliance-green">
              Net cane preview: {formatTonsFromKg(netPreviewKg)}
            </div>
          </div>
        </form>
      ) : null}

      <TableFilters
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search ticket, supplier, vehicle"
        filters={[
          {
            label: "Status",
            value: status,
            onChange: setStatus,
            options: [{ label: "All statuses", value: "all" }, ...statusOptions.map((value) => ({ label: value, value }))],
          },
        ]}
      />

      {loading ? <StatePanel type="loading" title="Loading cane intakes" /> : null}
      {error ? <StatePanel type="error" title="Cane intake unavailable" detail={error} /> : null}
      {!loading && !error ? (
        <DataTable columns={columns} rows={filteredRows} getRowKey={(row) => row.id} emptyText="No cane deliveries match the current filters." />
      ) : null}
      <Toast toast={toast} />
    </>
  );
}
