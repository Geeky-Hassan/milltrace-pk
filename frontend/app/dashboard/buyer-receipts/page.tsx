"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, ReceiptText } from "lucide-react";
import { Badge } from "@/components/Badge";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { PageHeader } from "@/components/PageHeader";
import { StatePanel } from "@/components/StatePanel";
import { TableFilters } from "@/components/TableFilters";
import { Toast, type ToastState } from "@/components/Toast";
import { createBuyerReceipt, getBuyerReceipts, getDispatches } from "@/lib/api";
import { formatBags, formatDateTime, formatTonsFromKg } from "@/lib/format";
import { canManageWarehouse } from "@/lib/roles";
import { matchesSearch, matchesValue, parseSerialList, uniqueOptions } from "@/lib/table";
import { useDemoRole } from "@/lib/use-demo-role";
import type { BuyerReceipt, DispatchRecord } from "@/types";

const columns: DataTableColumn<BuyerReceipt>[] = [
  { key: "dispatch", header: "Dispatch ID", cell: (row) => <span className="font-bold text-ink-900">{row.dispatch_id}</span> },
  { key: "buyer", header: "Buyer Name", cell: (row) => row.buyer_name },
  { key: "received", header: "Received Quantity", cell: (row) => formatBags(row.received_quantity) },
  { key: "mismatch", header: "Shortage / Mismatch", cell: (row) => row.shortage_mismatch },
  { key: "timestamp", header: "Receipt Timestamp", cell: (row) => formatDateTime(row.receipt_timestamp) },
  { key: "status", header: "Status", cell: (row) => <Badge>{row.status}</Badge> },
];

export default function BuyerReceiptsPage() {
  const role = useDemoRole();
  const [rows, setRows] = useState<BuyerReceipt[]>([]);
  const [dispatchRows, setDispatchRows] = useState<DispatchRecord[]>([]);
  const [form, setForm] = useState({ dispatch_id: "", buyer_name: "", receipt_location: "", serial_numbers: "" });
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);

  useEffect(() => {
    Promise.all([getBuyerReceipts(), getDispatches()])
      .then(([receiptRows, dispatchData]) => {
        setRows(receiptRows);
        setDispatchRows(dispatchData);
      })
      .catch((requestError) => setError(requestError instanceof Error ? requestError.message : "Buyer receipts could not load."))
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
  const selectedDispatch = useMemo(
    () => dispatchRows.find((dispatch) => dispatch.dispatch_id === form.dispatch_id),
    [dispatchRows, form.dispatch_id],
  );
  const receivedSerials = useMemo(() => parseSerialList(form.serial_numbers), [form.serial_numbers]);
  const dispatchedCount = selectedDispatch?.quantity ?? 0;
  const receivedWeightKg = receivedSerials.length * 50;
  const shortageCount = Math.max(dispatchedCount - receivedSerials.length, 0);
  const extraCount = Math.max(receivedSerials.length - dispatchedCount, 0);

  function selectDispatch(dispatch: DispatchRecord) {
    setForm({
      ...form,
      dispatch_id: dispatch.dispatch_id,
      buyer_name: dispatch.buyer,
      receipt_location: dispatch.buyer_order_id ?? "",
      serial_numbers: dispatch.serial_numbers?.join("\n") ?? "",
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const serials = receivedSerials;
      if (!serials.length) {
        setToast({ tone: "error", message: "Add at least one received serial before confirming receipt." });
        return;
      }
      const created = await createBuyerReceipt({
        dispatch_id: form.dispatch_id,
        buyer_name: form.buyer_name,
        receipt_location: form.receipt_location || null,
        serial_numbers: serials,
        received_quantity: serials.length,
      });
      setRows((current) => [created, ...current]);
      setForm({ dispatch_id: "", buyer_name: "", receipt_location: "", serial_numbers: "" });
      setToast({ tone: "success", message: `Buyer receipt confirmed for ${formatBags(serials.length)}.` });
    } catch (requestError) {
      setToast({ tone: "error", message: requestError instanceof Error ? requestError.message : "Buyer receipt was rejected." });
    }
  }

  return (
    <>
      <PageHeader
        title="Buyer Receipt"
        eyebrow="Delivery confirmation"
        description="Match received serials against the dispatched buyer and invoice record."
        icon={ReceiptText}
      />

      {canManageWarehouse(role) ? (
        <form onSubmit={handleSubmit} className="mb-6 rounded-lg border border-ink-100 bg-white p-5 shadow-soft">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-bold text-ink-900">Confirm Buyer Receipt</h2>
              <p className="mt-1 text-sm text-ink-500">The receipt closes only the serials that match the dispatch.</p>
            </div>
            <button type="submit" className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-ink-900 px-4 text-sm font-bold text-white transition hover:bg-compliance-green">
              <Plus aria-hidden="true" className="h-4 w-4" />
              Confirm
            </button>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            <label className="grid gap-1.5 text-sm font-semibold text-ink-700">
              Dispatch ID
              <select required value={form.dispatch_id} onChange={(event) => {
                const dispatch = dispatchRows.find((row) => row.dispatch_id === event.target.value);
                if (dispatch) selectDispatch(dispatch);
                else setForm({ ...form, dispatch_id: event.target.value });
              }} className="h-10 rounded-md border border-ink-200 px-3 outline-none focus:border-compliance-green focus:ring-2 focus:ring-emerald-100">
                <option value="">Select dispatch</option>
                {dispatchRows.map((dispatch) => (
                  <option key={dispatch.dispatch_id} value={dispatch.dispatch_id}>
                    {dispatch.dispatch_id} - {dispatch.buyer}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-ink-700">
              Buyer name
              <input required value={form.buyer_name} onChange={(event) => setForm({ ...form, buyer_name: event.target.value })} className="h-10 rounded-md border border-ink-200 px-3 outline-none focus:border-compliance-green focus:ring-2 focus:ring-emerald-100" />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-ink-700">
              Receipt location
              <input value={form.receipt_location} onChange={(event) => setForm({ ...form, receipt_location: event.target.value })} placeholder="Optional buyer site or order reference" className="h-10 rounded-md border border-ink-200 px-3 outline-none focus:border-compliance-green focus:ring-2 focus:ring-emerald-100" />
            </label>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <label className="grid gap-1.5 text-sm font-semibold text-ink-700">
              Received serials
              <textarea
                required
                rows={6}
                value={form.serial_numbers}
                onChange={(event) => setForm({ ...form, serial_numbers: event.target.value })}
                placeholder="Paste received serials, one per line"
                className="min-h-36 resize-y rounded-md border border-ink-200 px-3 py-2 font-mono text-xs outline-none focus:border-compliance-green focus:ring-2 focus:ring-emerald-100"
              />
            </label>

            <div className="rounded-lg bg-ink-50 p-4 ring-1 ring-ink-100">
              <p className="text-xs font-bold uppercase text-ink-500">Receipt reconciliation</p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="rounded-md bg-white p-3 ring-1 ring-ink-100">
                  <p className="text-xs text-ink-500">Dispatched</p>
                  <p className="mt-1 text-xl font-bold text-ink-900">{dispatchedCount}</p>
                </div>
                <div className="rounded-md bg-white p-3 ring-1 ring-ink-100">
                  <p className="text-xs text-ink-500">Received</p>
                  <p className="mt-1 text-xl font-bold text-ink-900">{receivedSerials.length}</p>
                </div>
              </div>
              <div className="mt-3 rounded-md bg-white p-3 text-sm ring-1 ring-ink-100">
                <p className="font-semibold text-ink-700">Received weight: {formatTonsFromKg(receivedWeightKg)}</p>
                <p className="mt-1 text-ink-500">
                  {shortageCount ? `${shortageCount} bag shortage will be flagged.` : extraCount ? `${extraCount} extra bag(s) will be flagged.` : "Serial count matches the dispatch."}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-lg bg-ink-50 p-4 ring-1 ring-ink-100">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase text-ink-500">Dispatched serials for selected receipt</p>
                {selectedDispatch ? (
                  <p className="mt-1 text-sm text-ink-500">
                    {selectedDispatch.invoice_number ?? "No invoice"} / {formatBags(selectedDispatch.quantity)}
                  </p>
                ) : null}
              </div>
              {selectedDispatch?.serial_numbers?.length ? (
                <button
                  type="button"
                  onClick={() => setForm({ ...form, serial_numbers: selectedDispatch.serial_numbers?.join("\n") ?? "" })}
                  className="rounded-md border border-ink-200 bg-white px-3 py-2 text-xs font-bold text-ink-700 transition hover:bg-ink-50"
                >
                  Use all dispatched
                </button>
              ) : null}
            </div>
            <div className="mt-3 flex max-h-28 flex-wrap gap-2 overflow-y-auto pr-1">
              {selectedDispatch?.serial_numbers?.length ? (
                selectedDispatch.serial_numbers.slice(0, 18).map((serial) => (
                  <Badge key={serial} tone="blue" className="font-mono">
                    {serial}
                  </Badge>
                ))
              ) : (
                <span className="text-sm text-ink-500">Create a dispatch first, then select it here.</span>
              )}
            </div>
          </div>
        </form>
      ) : null}

      <TableFilters
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search dispatch, buyer, mismatch"
        filters={[
          {
            label: "Status",
            value: status,
            onChange: setStatus,
            options: [{ label: "All statuses", value: "all" }, ...statusOptions.map((value) => ({ label: value, value }))],
          },
        ]}
      />

      {loading ? <StatePanel type="loading" title="Loading buyer receipts" /> : null}
      {error ? <StatePanel type="error" title="Buyer receipts unavailable" detail={error} /> : null}
      {!loading && !error ? (
        <DataTable columns={columns} rows={filteredRows} getRowKey={(row) => row.id} emptyText="No buyer receipts match the current filters." />
      ) : null}
      <Toast toast={toast} />
    </>
  );
}
