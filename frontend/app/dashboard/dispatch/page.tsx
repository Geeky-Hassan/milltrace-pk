"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, ReceiptText, Truck } from "lucide-react";
import { Badge } from "@/components/Badge";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { PageHeader } from "@/components/PageHeader";
import { StatePanel } from "@/components/StatePanel";
import { TableFilters } from "@/components/TableFilters";
import { Toast, type ToastState } from "@/components/Toast";
import { createDispatchRecord, getDemoInvoiceNumber, getDispatches, getPackagingSerials } from "@/lib/api";
import { formatBags, formatDateTime, formatTonsFromKg } from "@/lib/format";
import { canManageWarehouse } from "@/lib/roles";
import { matchesSearch, matchesValue, parseSerialList, uniqueOptions } from "@/lib/table";
import { useDemoRole } from "@/lib/use-demo-role";
import type { DispatchRecord, PackagingSerial } from "@/types";

const columns: DataTableColumn<DispatchRecord>[] = [
  { key: "dispatch", header: "Dispatch ID", cell: (row) => <span className="font-bold text-ink-900">{row.dispatch_id}</span> },
  { key: "buyer", header: "Buyer", cell: (row) => row.buyer },
  { key: "vehicle", header: "Vehicle", cell: (row) => row.vehicle_number },
  { key: "driver", header: "Driver", cell: (row) => row.driver_name },
  { key: "invoice", header: "Invoice", cell: (row) => row.invoice_number ? <span className="font-mono text-xs font-bold">{row.invoice_number}</span> : <Badge tone="danger">Missing</Badge> },
  { key: "serial", header: "Serial Range", cell: (row) => <span className="font-mono text-xs">{row.serial_range}</span> },
  { key: "quantity", header: "Quantity", cell: (row) => formatBags(row.quantity) },
  { key: "time", header: "Dispatched", cell: (row) => formatDateTime(row.dispatched_at) },
  { key: "status", header: "Status", cell: (row) => <Badge>{row.dispatch_status}</Badge> },
];

export default function DispatchPage() {
  const role = useDemoRole();
  const [rows, setRows] = useState<DispatchRecord[]>([]);
  const [availableSerials, setAvailableSerials] = useState<PackagingSerial[]>([]);
  const [form, setForm] = useState({ buyer: "", vehicle_number: "", driver_name: "", invoice_number: "", serial_numbers: "" });
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const [invoiceBusy, setInvoiceBusy] = useState(false);

  useEffect(() => {
    Promise.all([getDispatches(), getPackagingSerials()])
      .then(([dispatchRows, serialRows]) => {
        setRows(dispatchRows);
        setAvailableSerials(serialRows.filter((serial) => serial.status.toUpperCase() === "WAREHOUSED"));
      })
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

  const selectedSerials = useMemo(() => parseSerialList(form.serial_numbers), [form.serial_numbers]);
  const selectedWeightKg = selectedSerials.length * 50;
  const readyWeightKg = availableSerials.length * 50;
  const statusOptions = useMemo(() => uniqueOptions(rows.map((row) => row.dispatch_status)), [rows]);
  const filteredRows = useMemo(
    () => rows.filter((row) => matchesSearch(row, search) && matchesValue(row.dispatch_status, status)),
    [rows, search, status],
  );

  async function handleGenerateInvoice() {
    try {
      setInvoiceBusy(true);
      const result = await getDemoInvoiceNumber();
      setForm((current) => ({ ...current, invoice_number: result.invoice_number }));
      setToast({ tone: "success", message: `Demo invoice generated: ${result.invoice_number}` });
    } catch (requestError) {
      setToast({ tone: "error", message: requestError instanceof Error ? requestError.message : "Invoice number could not be generated." });
    } finally {
      setInvoiceBusy(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const serials = selectedSerials;
      const invoiceNumber = form.invoice_number.trim();
      if (!invoiceNumber) {
        setToast({ tone: "error", message: "Generate a demo invoice or enter an invoice number before dispatch." });
        return;
      }
      if (!serials.length) {
        setToast({ tone: "error", message: "Select at least one warehoused serial before dispatch." });
        return;
      }
      const created = await createDispatchRecord({
        buyer: form.buyer,
        vehicle_number: form.vehicle_number,
        driver_name: form.driver_name,
        invoice_number: invoiceNumber,
        serial_numbers: serials,
        quantity: serials.length,
      });
      setRows((current) => [created, ...current]);
      setAvailableSerials((current) => current.filter((serial) => !serials.includes(serial.serial_number)));
      setForm({ buyer: "", vehicle_number: "", driver_name: "", invoice_number: "", serial_numbers: "" });
      setToast({ tone: "success", message: `Dispatch created for ${formatBags(serials.length)} with invoice ${created.invoice_number}.` });
    } catch (requestError) {
      setToast({ tone: "error", message: requestError instanceof Error ? requestError.message : "Dispatch was rejected." });
    }
  }

  return (
    <>
      <PageHeader
        title="Dispatch"
        eyebrow="Outbound movement"
        description="Release only warehoused serials with buyer, vehicle, driver, and invoice evidence."
        icon={Truck}
        action={<Badge tone="neutral">Invoice required</Badge>}
      />

      {canManageWarehouse(role) ? (
        <form onSubmit={handleSubmit} className="mb-6 rounded-lg border border-ink-100 bg-white p-5 shadow-soft">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-bold text-ink-900">Create Dispatch</h2>
              <p className="mt-1 text-sm text-ink-500">Quantity is calculated from scanned 50 kg bag serials.</p>
            </div>
            <button type="submit" className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-ink-900 px-4 text-sm font-bold text-white transition hover:bg-compliance-green">
              <Plus aria-hidden="true" className="h-4 w-4" />
              Dispatch
            </button>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-3">
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
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-compliance-green">Invoice evidence</p>
                  <p className="mt-1 text-xs leading-5 text-emerald-700">
                    Generate a demo invoice here, or type a manual invoice from another platform.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleGenerateInvoice()}
                  disabled={invoiceBusy}
                  className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md bg-white px-3 text-xs font-bold text-ink-800 ring-1 ring-emerald-200 transition hover:bg-emerald-100 disabled:opacity-60"
                >
                  <ReceiptText aria-hidden="true" className="h-4 w-4" />
                  Generate Demo Invoice
                </button>
              </div>
              <label className="mt-3 grid gap-1.5 text-sm font-semibold text-ink-700">
                Invoice number
                <input
                  required
                  value={form.invoice_number}
                  onChange={(event) => setForm({ ...form, invoice_number: event.target.value })}
                  placeholder="Generate or enter invoice number"
                  className="h-10 rounded-md border border-emerald-200 bg-white px-3 font-mono text-sm outline-none focus:border-compliance-green focus:ring-2 focus:ring-emerald-100"
                />
              </label>
              <p className="mt-2 text-xs leading-5 text-ink-500">
                Future integration: this button can call a digital invoicing platform and write back the official invoice number.
              </p>
            </div>

            <label className="grid gap-1.5 text-sm font-semibold text-ink-700">
              Serials to dispatch
              <textarea
                required
                rows={6}
                value={form.serial_numbers}
                onChange={(event) => setForm({ ...form, serial_numbers: event.target.value })}
                placeholder="Paste one warehoused serial per line"
                className="min-h-36 resize-y rounded-md border border-ink-200 px-3 py-2 font-mono text-xs outline-none focus:border-compliance-green focus:ring-2 focus:ring-emerald-100"
              />
            </label>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[0.75fr_1.25fr]">
            <div className="rounded-lg bg-ink-50 p-4 ring-1 ring-ink-100">
              <p className="text-xs font-bold uppercase text-ink-500">Selected dispatch quantity</p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="rounded-md bg-white p-3 ring-1 ring-ink-100">
                  <p className="text-xs font-semibold text-ink-500">Bags</p>
                  <p className="mt-1 text-xl font-bold text-ink-900">{selectedSerials.length.toLocaleString()}</p>
                </div>
                <div className="rounded-md bg-white p-3 ring-1 ring-ink-100">
                  <p className="text-xs font-semibold text-ink-500">Weight</p>
                  <p className="mt-1 text-xl font-bold text-ink-900">{formatTonsFromKg(selectedWeightKg)}</p>
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-ink-50 p-4 ring-1 ring-ink-100">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase text-ink-500">Warehoused serials ready for dispatch</p>
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
                  <span className="text-sm text-ink-500">No warehoused serials available. Receive activated serials into warehouse first.</span>
                ) : (
                  availableSerials.slice(0, 18).map((serial) => (
                    <Badge key={serial.serial_number} tone="success" className="font-mono">
                      {serial.serial_number}
                    </Badge>
                  ))
                )}
              </div>
            </div>
          </div>
        </form>
      ) : null}

      <TableFilters
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search buyer, invoice, vehicle, serial range"
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
