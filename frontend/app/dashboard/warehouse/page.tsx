"use client";

import { useEffect, useMemo, useState } from "react";
import { Boxes, Plus } from "lucide-react";
import { Badge } from "@/components/Badge";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { PageHeader } from "@/components/PageHeader";
import { StatePanel } from "@/components/StatePanel";
import { TableFilters } from "@/components/TableFilters";
import { Toast, type ToastState } from "@/components/Toast";
import { createWarehouseReceipt, getPackagingSerials, getWarehouseReceipts } from "@/lib/api";
import { formatBags, formatDateTime, formatTonsFromKg } from "@/lib/format";
import { canManageWarehouse } from "@/lib/roles";
import { matchesSearch, matchesValue, parseSerialList, uniqueOptions } from "@/lib/table";
import { useDemoRole } from "@/lib/use-demo-role";
import type { PackagingSerial, WarehouseReceipt } from "@/types";

const columns: DataTableColumn<WarehouseReceipt>[] = [
  { key: "serial_range", header: "Serial Range", cell: (row) => <span className="font-mono text-xs font-bold text-ink-900">{row.serial_range}</span> },
  { key: "batch", header: "Batch ID", cell: (row) => row.batch_id },
  { key: "quantity", header: "Quantity", cell: (row) => formatBags(row.quantity) },
  { key: "weight", header: "Total Weight", cell: (row) => formatTonsFromKg(row.total_weight_kg) },
  { key: "location", header: "Warehouse Location", cell: (row) => row.warehouse_location },
  { key: "age", header: "Stock Age", cell: (row) => `${row.stock_age_days} days` },
  { key: "received", header: "Received", cell: (row) => formatDateTime(row.received_at) },
  { key: "status", header: "Status", cell: (row) => <Badge>{row.status}</Badge> },
];

export default function WarehousePage() {
  const role = useDemoRole();
  const [rows, setRows] = useState<WarehouseReceipt[]>([]);
  const [availableSerials, setAvailableSerials] = useState<PackagingSerial[]>([]);
  const [form, setForm] = useState({ serial_numbers: "", warehouse_location: "WH-A / Bay 03", sku: "SUGAR_50KG" });
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);

  useEffect(() => {
    Promise.all([getWarehouseReceipts(), getPackagingSerials()])
      .then(([receiptRows, serialRows]) => {
        setRows(receiptRows);
        setAvailableSerials(serialRows.filter((serial) => serial.status.toUpperCase() === "ACTIVATED"));
      })
      .catch((requestError) => setError(requestError instanceof Error ? requestError.message : "Warehouse stock could not load."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timeout = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const selectedSerials = useMemo(() => parseSerialList(form.serial_numbers), [form.serial_numbers]);
  const selectedWeightKg = selectedSerials.length * 50;
  const readyWeightKg = availableSerials.length * 50;
  const totalBags = rows.reduce((sum, row) => sum + row.quantity, 0);
  const totalWeight = rows.reduce((sum, row) => sum + row.total_weight_kg, 0);
  const blocked = rows.filter((row) => row.status === "Blocked").length;
  const statusOptions = useMemo(() => uniqueOptions(rows.map((row) => row.status)), [rows]);
  const filteredRows = useMemo(
    () => rows.filter((row) => matchesSearch(row, search) && matchesValue(row.status, status)),
    [rows, search, status],
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const serials = selectedSerials;
      if (!serials.length) {
        setToast({ tone: "error", message: "Select at least one activated serial before creating a warehouse receipt." });
        return;
      }
      const created = await createWarehouseReceipt({
        serial_numbers: serials,
        warehouse_location: form.warehouse_location,
        sku: form.sku,
        quantity: serials.length,
        total_weight_kg: selectedWeightKg,
      });
      setRows((current) => [created, ...current]);
      setAvailableSerials((current) => current.filter((serial) => !serials.includes(serial.serial_number)));
      setForm({ serial_numbers: "", warehouse_location: "WH-A / Bay 03", sku: "SUGAR_50KG" });
      setToast({ tone: "success", message: `Warehouse receipt created for ${formatBags(serials.length)}.` });
    } catch (requestError) {
      setToast({ tone: "error", message: requestError instanceof Error ? requestError.message : "Warehouse receipt was rejected." });
    }
  }

  return (
    <>
      <PageHeader
        title="Warehouse"
        eyebrow="Stock custody"
        description="Receive activated bag serials into bay-level stock custody."
        icon={Boxes}
      />

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <article className="rounded-lg border border-ink-100 bg-white p-4 shadow-soft">
          <p className="text-sm font-semibold text-ink-500">Total bags</p>
          <p className="mt-2 text-2xl font-bold text-ink-900">{totalBags.toLocaleString()}</p>
        </article>
        <article className="rounded-lg border border-ink-100 bg-white p-4 shadow-soft">
          <p className="text-sm font-semibold text-ink-500">Total stock weight</p>
          <p className="mt-2 text-2xl font-bold text-ink-900">{formatTonsFromKg(totalWeight)}</p>
        </article>
        <article className="rounded-lg border border-red-100 bg-white p-4 shadow-soft">
          <p className="text-sm font-semibold text-ink-500">Blocked ranges</p>
          <p className="mt-2 text-2xl font-bold text-red-700">{blocked}</p>
        </article>
      </div>

      {canManageWarehouse(role) ? (
        <form onSubmit={handleSubmit} className="mb-6 rounded-lg border border-ink-100 bg-white p-5 shadow-soft">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-bold text-ink-900">Create Warehouse Receipt</h2>
              <p className="mt-1 text-sm text-ink-500">Only ACTIVATED serials can enter stock. Quantity is the scanned serial count.</p>
            </div>
            <button type="submit" className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-ink-900 px-4 text-sm font-bold text-white transition hover:bg-compliance-green">
              <Plus aria-hidden="true" className="h-4 w-4" />
              Receive
            </button>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <label className="grid gap-1.5 text-sm font-semibold text-ink-700">
              Serial numbers
              <textarea
                required
                rows={6}
                value={form.serial_numbers}
                onChange={(event) => setForm({ ...form, serial_numbers: event.target.value })}
                placeholder="Paste one activated serial per line"
                className="min-h-36 resize-y rounded-md border border-ink-200 px-3 py-2 font-mono text-xs outline-none focus:border-compliance-green focus:ring-2 focus:ring-emerald-100"
              />
            </label>
            <div className="grid gap-4">
              <label className="grid gap-1.5 text-sm font-semibold text-ink-700">
                Warehouse location
                <select value={form.warehouse_location} onChange={(event) => setForm({ ...form, warehouse_location: event.target.value })} className="h-10 rounded-md border border-ink-200 px-3 outline-none focus:border-compliance-green focus:ring-2 focus:ring-emerald-100">
                  <option>WH-A / Bay 03</option>
                  <option>WH-B / Bay 01</option>
                </select>
              </label>
              <label className="grid gap-1.5 text-sm font-semibold text-ink-700">
                SKU
                <input value={form.sku} onChange={(event) => setForm({ ...form, sku: event.target.value })} className="h-10 rounded-md border border-ink-200 px-3 outline-none focus:border-compliance-green focus:ring-2 focus:ring-emerald-100" />
              </label>
              <div className="rounded-lg bg-ink-50 p-4 ring-1 ring-ink-100">
                <p className="text-xs font-bold uppercase text-ink-500">Receipt quantity</p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div className="rounded-md bg-white p-3 ring-1 ring-ink-100">
                    <p className="text-xs text-ink-500">Bags</p>
                    <p className="mt-1 text-xl font-bold text-ink-900">{selectedSerials.length}</p>
                  </div>
                  <div className="rounded-md bg-white p-3 ring-1 ring-ink-100">
                    <p className="text-xs text-ink-500">Weight</p>
                    <p className="mt-1 text-xl font-bold text-ink-900">{formatTonsFromKg(selectedWeightKg)}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-lg bg-ink-50 p-4 ring-1 ring-ink-100">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase text-ink-500">Activated serials ready for warehouse</p>
                <p className="mt-1 text-sm text-ink-500">{formatBags(availableSerials.length)} / {formatTonsFromKg(readyWeightKg)} available</p>
              </div>
              {availableSerials.length ? (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, serial_numbers: availableSerials.slice(0, 10).map((serial) => serial.serial_number).join("\n") })}
                    className="rounded-md border border-ink-200 bg-white px-3 py-2 text-xs font-bold text-ink-700 transition hover:bg-ink-50"
                  >
                    Use first 10
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, serial_numbers: availableSerials.map((serial) => serial.serial_number).join("\n") })}
                    className="rounded-md border border-ink-200 bg-white px-3 py-2 text-xs font-bold text-ink-700 transition hover:bg-ink-50"
                  >
                    Use all ready
                  </button>
                </div>
              ) : null}
            </div>
            <div className="mt-3 flex max-h-28 flex-wrap gap-2 overflow-y-auto pr-1">
              {availableSerials.length === 0 ? (
                <span className="text-sm text-ink-500">No activated serials available. Activate serials on Packaging first.</span>
              ) : (
                availableSerials.slice(0, 18).map((serial) => (
                  <Badge key={serial.serial_number} tone="warning" className="font-mono">
                    {serial.serial_number}
                  </Badge>
                ))
              )}
            </div>
          </div>
        </form>
      ) : null}

      <TableFilters
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search serial range, batch, location"
        filters={[
          {
            label: "Status",
            value: status,
            onChange: setStatus,
            options: [{ label: "All statuses", value: "all" }, ...statusOptions.map((value) => ({ label: value, value }))],
          },
        ]}
      />

      {loading ? <StatePanel type="loading" title="Loading warehouse stock" /> : null}
      {error ? <StatePanel type="error" title="Warehouse unavailable" detail={error} /> : null}
      {!loading && !error ? (
        <DataTable columns={columns} rows={filteredRows} getRowKey={(row) => row.id} emptyText="No warehouse receipts match the current filters." />
      ) : null}
      <Toast toast={toast} />
    </>
  );
}
