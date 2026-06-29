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
import { formatDateTime } from "@/lib/format";
import { canManageWarehouse } from "@/lib/roles";
import { matchesSearch, matchesValue, parseSerialList, uniqueOptions } from "@/lib/table";
import { useDemoRole } from "@/lib/use-demo-role";
import type { BuyerReceipt, DispatchRecord } from "@/types";

const columns: DataTableColumn<BuyerReceipt>[] = [
  { key: "dispatch", header: "Dispatch ID", cell: (row) => <span className="font-bold text-ink-900">{row.dispatch_id}</span> },
  { key: "buyer", header: "Buyer Name", cell: (row) => row.buyer_name },
  { key: "received", header: "Received Quantity", cell: (row) => row.received_quantity.toLocaleString() },
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
      const serials = parseSerialList(form.serial_numbers);
      const created = await createBuyerReceipt({
        dispatch_id: form.dispatch_id,
        buyer_name: form.buyer_name,
        receipt_location: form.receipt_location || null,
        serial_numbers: serials,
        received_quantity: serials.length,
      });
      setRows((current) => [created, ...current]);
      setForm({ dispatch_id: "", buyer_name: "", receipt_location: "", serial_numbers: "" });
      setToast({ tone: "success", message: "Buyer receipt confirmed and serials reconciled." });
    } catch (requestError) {
      setToast({ tone: "error", message: requestError instanceof Error ? requestError.message : "Buyer receipt was rejected." });
    }
  }

  return (
    <>
      <PageHeader
        title="Buyer Receipt"
        eyebrow="Delivery confirmation"
        description="Buyer acknowledgements confirm received quantity and flag shortage or mismatch claims."
        icon={ReceiptText}
      />

      {canManageWarehouse(role) ? (
        <form onSubmit={handleSubmit} className="mb-6 rounded-lg border border-ink-100 bg-white p-5 shadow-soft">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-bold text-ink-900">Confirm Buyer Receipt</h2>
            <button type="submit" className="inline-flex h-10 items-center gap-2 rounded-md bg-ink-900 px-4 text-sm font-bold text-white transition hover:bg-compliance-green">
              <Plus aria-hidden="true" className="h-4 w-4" />
              Confirm
            </button>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
              <input value={form.receipt_location} onChange={(event) => setForm({ ...form, receipt_location: event.target.value })} className="h-10 rounded-md border border-ink-200 px-3 outline-none focus:border-compliance-green focus:ring-2 focus:ring-emerald-100" />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-ink-700">
              Received serials
              <textarea required rows={3} value={form.serial_numbers} onChange={(event) => setForm({ ...form, serial_numbers: event.target.value })} className="resize-none rounded-md border border-ink-200 px-3 py-2 outline-none focus:border-compliance-green focus:ring-2 focus:ring-emerald-100" />
            </label>
          </div>
          <div className="mt-4 rounded-lg bg-ink-50 p-4 ring-1 ring-ink-100">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs font-bold uppercase text-ink-500">Dispatched serials for selected receipt</p>
              {selectedDispatch ? <Badge tone="neutral">{selectedDispatch.quantity} dispatched</Badge> : null}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {selectedDispatch?.serial_numbers?.length ? (
                selectedDispatch.serial_numbers.slice(0, 8).map((serial) => (
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
