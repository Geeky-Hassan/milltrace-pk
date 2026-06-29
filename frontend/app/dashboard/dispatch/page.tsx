"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Truck } from "lucide-react";
import { Badge } from "@/components/Badge";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { PageHeader } from "@/components/PageHeader";
import { StatePanel } from "@/components/StatePanel";
import { TableFilters } from "@/components/TableFilters";
import { Toast, type ToastState } from "@/components/Toast";
import { createDispatchRecord, getDispatches } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { canManageWarehouse } from "@/lib/roles";
import { matchesSearch, matchesValue, parseSerialList, uniqueOptions } from "@/lib/table";
import { useDemoRole } from "@/lib/use-demo-role";
import type { DispatchRecord } from "@/types";

const columns: DataTableColumn<DispatchRecord>[] = [
  { key: "dispatch", header: "Dispatch ID", cell: (row) => <span className="font-bold text-ink-900">{row.dispatch_id}</span> },
  { key: "buyer", header: "Buyer", cell: (row) => row.buyer },
  { key: "vehicle", header: "Vehicle", cell: (row) => row.vehicle_number },
  { key: "driver", header: "Driver", cell: (row) => row.driver_name },
  { key: "invoice", header: "Invoice", cell: (row) => row.invoice_number ?? <Badge tone="danger">Missing</Badge> },
  { key: "serial", header: "Serial Range", cell: (row) => row.serial_range },
  { key: "quantity", header: "Quantity", cell: (row) => row.quantity.toLocaleString() },
  { key: "time", header: "Dispatched", cell: (row) => formatDateTime(row.dispatched_at) },
  { key: "status", header: "Status", cell: (row) => <Badge>{row.dispatch_status}</Badge> },
];

export default function DispatchPage() {
  const role = useDemoRole();
  const [rows, setRows] = useState<DispatchRecord[]>([]);
  const [form, setForm] = useState({ buyer: "", vehicle_number: "", driver_name: "", invoice_number: "", serial_numbers: "" });
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);

  useEffect(() => {
    getDispatches()
      .then(setRows)
      .catch((requestError) => setError(requestError instanceof Error ? requestError.message : "Dispatch records could not load."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timeout = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const statusOptions = useMemo(() => uniqueOptions(rows.map((row) => row.dispatch_status)), [rows]);
  const filteredRows = useMemo(
    () => rows.filter((row) => matchesSearch(row, search) && matchesValue(row.dispatch_status, status)),
    [rows, search, status],
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const serials = parseSerialList(form.serial_numbers);
      const created = await createDispatchRecord({
        buyer: form.buyer,
        vehicle_number: form.vehicle_number,
        driver_name: form.driver_name,
        invoice_number: form.invoice_number || null,
        serial_numbers: serials,
        quantity: serials.length,
      });
      setRows((current) => [created, ...current]);
      setForm({ buyer: "", vehicle_number: "", driver_name: "", invoice_number: "", serial_numbers: "" });
      setToast({ tone: "success", message: "Dispatch created and serials moved to dispatched state." });
    } catch (requestError) {
      setToast({ tone: "error", message: requestError instanceof Error ? requestError.message : "Dispatch was rejected." });
    }
  }

  return (
    <>
      <PageHeader
        title="Dispatch"
        eyebrow="Outbound movement"
        description="Dispatch records connect buyer invoices, vehicle details, and serialized bag ranges."
        icon={Truck}
        action={<Badge tone="warning">1 receipt pending</Badge>}
      />

      {canManageWarehouse(role) ? (
        <form onSubmit={handleSubmit} className="mb-6 rounded-lg border border-ink-100 bg-white p-5 shadow-soft">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-bold text-ink-900">Create Dispatch</h2>
            <button type="submit" className="inline-flex h-10 items-center gap-2 rounded-md bg-ink-900 px-4 text-sm font-bold text-white transition hover:bg-compliance-green">
              <Plus aria-hidden="true" className="h-4 w-4" />
              Dispatch
            </button>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <label className="grid gap-1.5 text-sm font-semibold text-ink-700">
              Buyer
              <input required value={form.buyer} onChange={(event) => setForm({ ...form, buyer: event.target.value })} className="h-10 rounded-md border border-ink-200 px-3 outline-none focus:border-compliance-green focus:ring-2 focus:ring-emerald-100" />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-ink-700">
              Vehicle number
              <input required value={form.vehicle_number} onChange={(event) => setForm({ ...form, vehicle_number: event.target.value })} className="h-10 rounded-md border border-ink-200 px-3 outline-none focus:border-compliance-green focus:ring-2 focus:ring-emerald-100" />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-ink-700">
              Driver name
              <input required value={form.driver_name} onChange={(event) => setForm({ ...form, driver_name: event.target.value })} className="h-10 rounded-md border border-ink-200 px-3 outline-none focus:border-compliance-green focus:ring-2 focus:ring-emerald-100" />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-ink-700">
              Invoice number
              <input value={form.invoice_number} onChange={(event) => setForm({ ...form, invoice_number: event.target.value })} className="h-10 rounded-md border border-ink-200 px-3 outline-none focus:border-compliance-green focus:ring-2 focus:ring-emerald-100" />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-ink-700 xl:col-span-1">
              Serials
              <textarea required rows={3} value={form.serial_numbers} onChange={(event) => setForm({ ...form, serial_numbers: event.target.value })} className="resize-none rounded-md border border-ink-200 px-3 py-2 outline-none focus:border-compliance-green focus:ring-2 focus:ring-emerald-100" />
            </label>
          </div>
        </form>
      ) : null}

      <TableFilters
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search buyer, vehicle, serial range"
        filters={[
          {
            label: "Status",
            value: status,
            onChange: setStatus,
            options: [{ label: "All statuses", value: "all" }, ...statusOptions.map((value) => ({ label: value, value }))],
          },
        ]}
      />

      {loading ? <StatePanel type="loading" title="Loading dispatches" /> : null}
      {error ? <StatePanel type="error" title="Dispatch unavailable" detail={error} /> : null}
      {!loading && !error ? (
        <DataTable columns={columns} rows={filteredRows} getRowKey={(row) => row.id} emptyText="No dispatch records match the current filters." />
      ) : null}
      <Toast toast={toast} />
    </>
  );
}
