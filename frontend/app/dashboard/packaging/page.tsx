"use client";

import { useEffect, useMemo, useState } from "react";
import { PackageCheck, Plus, ShieldAlert, Zap } from "lucide-react";
import { Badge } from "@/components/Badge";
import { ConfirmModal } from "@/components/ConfirmModal";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { PageHeader } from "@/components/PageHeader";
import { SerialLifecycle } from "@/components/SerialLifecycle";
import { StatePanel } from "@/components/StatePanel";
import { TableFilters } from "@/components/TableFilters";
import { Toast, type ToastState } from "@/components/Toast";
import { generatePackagingSerials, getPackagingSerials, getProductionBatches, transitionSerial } from "@/lib/api";
import { formatDateTime, formatKg } from "@/lib/format";
import { canVoidSerial } from "@/lib/roles";
import { matchesSearch, matchesValue, uniqueOptions } from "@/lib/table";
import { useDemoRole } from "@/lib/use-demo-role";
import type { PackagingSerial, ProductionBatch } from "@/types";

const columns: DataTableColumn<PackagingSerial>[] = [
  { key: "serial", header: "Serial Number", cell: (row) => <span className="font-bold text-ink-900">{row.serial_number}</span> },
  { key: "batch", header: "Batch ID", cell: (row) => row.batch_id },
  { key: "weight", header: "Bag Weight", cell: (row) => formatKg(row.bag_weight_kg) },
  { key: "line", header: "Packaging Line", cell: (row) => row.packaging_line },
  { key: "status", header: "Status", cell: (row) => <Badge>{row.status}</Badge> },
  { key: "timestamp", header: "Timestamp", cell: (row) => formatDateTime(row.timestamp) },
];

export default function PackagingPage() {
  const role = useDemoRole();
  const [rows, setRows] = useState<PackagingSerial[]>([]);
  const [batches, setBatches] = useState<ProductionBatch[]>([]);
  const [selectedSerial, setSelectedSerial] = useState<string>("");
  const [generateForm, setGenerateForm] = useState({ batch_id: "", quantity: "5", bag_weight_kg: "50", packaging_line: "Line Demo" });
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const [voidOpen, setVoidOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([getPackagingSerials(), getProductionBatches()])
      .then(([serialData, batchData]) => {
        setRows(serialData);
        setBatches(batchData);
        setSelectedSerial(serialData[0]?.serial_number ?? "");
        setGenerateForm((current) => ({ ...current, batch_id: current.batch_id || batchData[0]?.batch_id || "" }));
      })
      .catch((requestError) => setError(requestError instanceof Error ? requestError.message : "Packaging serials could not load."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timeout = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const selected = useMemo(
    () => rows.find((row) => row.serial_number === selectedSerial) ?? rows[0],
    [rows, selectedSerial],
  );
  const statusOptions = useMemo(() => uniqueOptions(rows.map((row) => row.status)), [rows]);
  const filteredRows = useMemo(
    () => rows.filter((row) => matchesSearch(row, search) && matchesValue(row.status, status)),
    [rows, search, status],
  );

  async function handleVoid(reason: string) {
    if (!selected) {
      return;
    }
    try {
      setBusy(true);
      const updated = await transitionSerial(selected.serial_number, {
        target_status: "VOIDED",
        reason,
        supervisor_user_id: 1,
      });
      setRows((current) => current.map((row) => (row.id === updated.id ? updated : row)));
      setToast({ tone: "success", message: "Serial voided and audit evidence recorded." });
      setVoidOpen(false);
    } catch (requestError) {
      setToast({ tone: "error", message: requestError instanceof Error ? requestError.message : "Serial void was rejected." });
    } finally {
      setBusy(false);
    }
  }

  async function handleGenerate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      setBusy(true);
      const created = await generatePackagingSerials({
        batch_id: generateForm.batch_id,
        quantity: Number(generateForm.quantity),
        bag_weight_kg: Number(generateForm.bag_weight_kg),
        packaging_line: generateForm.packaging_line,
        sku: "SUGAR_50KG",
      });
      setRows((current) => [...created, ...current]);
      setSelectedSerial(created[0]?.serial_number ?? selectedSerial);
      setToast({ tone: "success", message: `${created.length} serials issued for ${generateForm.batch_id}.` });
    } catch (requestError) {
      setToast({ tone: "error", message: requestError instanceof Error ? requestError.message : "Serial generation was rejected." });
    } finally {
      setBusy(false);
    }
  }

  async function handleActivateSelected() {
    if (!selected) return;
    try {
      setBusy(true);
      const updated = await transitionSerial(selected.serial_number, { target_status: "ACTIVATED" });
      setRows((current) => current.map((row) => (row.id === updated.id ? updated : row)));
      setToast({ tone: "success", message: "Serial activated and audit logged." });
    } catch (requestError) {
      setToast({ tone: "error", message: requestError instanceof Error ? requestError.message : "Serial activation was rejected." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Packaging & Serial"
        eyebrow="Serial custody"
        description="Bag-level serials connect production batches to warehouse and dispatch events."
        icon={PackageCheck}
        action={<Badge tone="blue">Serial-level trail</Badge>}
      />

      {role === "mill_operator" ? (
        <form onSubmit={handleGenerate} className="mb-6 rounded-lg border border-ink-100 bg-white p-5 shadow-soft">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-bold text-ink-900">Generate Serials</h2>
            <button
              type="submit"
              disabled={busy || !generateForm.batch_id}
              className="inline-flex h-10 items-center gap-2 rounded-md bg-ink-900 px-4 text-sm font-bold text-white transition hover:bg-compliance-green disabled:bg-ink-300"
            >
              <Plus aria-hidden="true" className="h-4 w-4" />
              Generate
            </button>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="grid gap-1.5 text-sm font-semibold text-ink-700">
              Batch
              <select value={generateForm.batch_id} onChange={(event) => setGenerateForm({ ...generateForm, batch_id: event.target.value })} className="h-10 rounded-md border border-ink-200 px-3 outline-none focus:border-compliance-green focus:ring-2 focus:ring-emerald-100">
                {batches.map((batch) => (
                  <option key={batch.batch_id} value={batch.batch_id}>
                    {batch.batch_id}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-ink-700">
              Quantity
              <input min="1" required type="number" value={generateForm.quantity} onChange={(event) => setGenerateForm({ ...generateForm, quantity: event.target.value })} className="h-10 rounded-md border border-ink-200 px-3 outline-none focus:border-compliance-green focus:ring-2 focus:ring-emerald-100" />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-ink-700">
              Bag weight
              <input min="1" required type="number" value={generateForm.bag_weight_kg} onChange={(event) => setGenerateForm({ ...generateForm, bag_weight_kg: event.target.value })} className="h-10 rounded-md border border-ink-200 px-3 outline-none focus:border-compliance-green focus:ring-2 focus:ring-emerald-100" />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-ink-700">
              Packaging line
              <input required value={generateForm.packaging_line} onChange={(event) => setGenerateForm({ ...generateForm, packaging_line: event.target.value })} className="h-10 rounded-md border border-ink-200 px-3 outline-none focus:border-compliance-green focus:ring-2 focus:ring-emerald-100" />
            </label>
          </div>
        </form>
      ) : null}

      <div className="mb-6 grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <section className="rounded-lg border border-ink-100 bg-white p-5 shadow-soft">
          <h2 className="text-base font-bold text-ink-900">Lifecycle Visual</h2>
          <label className="mt-4 grid gap-1.5 text-sm font-semibold text-ink-700">
            Serial number
            <select
              value={selectedSerial}
              onChange={(event) => setSelectedSerial(event.target.value)}
              className="h-10 rounded-md border border-ink-200 px-3 outline-none focus:border-compliance-green focus:ring-2 focus:ring-emerald-100"
            >
              {rows.map((row) => (
                <option key={row.serial_number} value={row.serial_number}>
                  {row.serial_number}
                </option>
              ))}
            </select>
          </label>
          {selected ? (
            <div className="mt-4 grid gap-3 rounded-lg bg-ink-50 p-4 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-ink-500">Batch</span>
                <span className="font-bold text-ink-900">{selected.batch_id}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-ink-500">Line</span>
                <span className="font-bold text-ink-900">{selected.packaging_line}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-ink-500">Current status</span>
                <Badge>{selected.status}</Badge>
              </div>
            </div>
          ) : null}
          {selected && canVoidSerial(role) && selected.status.toUpperCase() !== "VOIDED" ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {selected.status.toUpperCase() === "ISSUED" ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleActivateSelected()}
                  className="inline-flex h-10 items-center gap-2 rounded-md bg-ink-900 px-4 text-sm font-bold text-white transition hover:bg-compliance-green disabled:bg-ink-300"
                >
                  <Zap aria-hidden="true" className="h-4 w-4" />
                  Activate serial
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setVoidOpen(true)}
                className="inline-flex h-10 items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 text-sm font-bold text-red-700 transition hover:bg-red-100"
              >
                <ShieldAlert aria-hidden="true" className="h-4 w-4" />
                Void serial
              </button>
            </div>
          ) : null}
        </section>

        <SerialLifecycle status={selected?.status ?? "Issued"} />
      </div>

      <TableFilters
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search serial, batch, line"
        filters={[
          {
            label: "Status",
            value: status,
            onChange: setStatus,
            options: [{ label: "All statuses", value: "all" }, ...statusOptions.map((value) => ({ label: value, value }))],
          },
        ]}
      />

      {loading ? <StatePanel type="loading" title="Loading serials" /> : null}
      {error ? <StatePanel type="error" title="Serials unavailable" detail={error} /> : null}
      {!loading && !error ? (
        <DataTable columns={columns} rows={filteredRows} getRowKey={(row) => row.id} emptyText="No serials match the current filters." />
      ) : null}
      <ConfirmModal
        open={voidOpen}
        title="Void this serial?"
        description="Voiding removes the serial from normal stock movement and requires a supervisor-approved reason."
        confirmLabel="Void serial"
        requireReason
        busy={busy}
        onCancel={() => setVoidOpen(false)}
        onConfirm={handleVoid}
      />
      <Toast toast={toast} />
    </>
  );
}
