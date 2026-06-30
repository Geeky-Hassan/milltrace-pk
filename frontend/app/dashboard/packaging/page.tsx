"use client";

import { useEffect, useMemo, useState } from "react";
import { Eye, PackageCheck, Plus, ShieldAlert, X, Zap } from "lucide-react";
import { Badge } from "@/components/Badge";
import { ConfirmModal } from "@/components/ConfirmModal";
import { PageHeader } from "@/components/PageHeader";
import { SerialLifecycle } from "@/components/SerialLifecycle";
import { StatePanel } from "@/components/StatePanel";
import { TableFilters } from "@/components/TableFilters";
import { Toast, type ToastState } from "@/components/Toast";
import { generatePackagingSerials, getPackagingSerials, getProductionBatches, transitionSerial } from "@/lib/api";
import { bagsFromKg, formatBagWeight, formatBags, formatDateTime, formatTonsFromKg } from "@/lib/format";
import { canVoidSerial } from "@/lib/roles";
import { matchesSearch, matchesValue, uniqueOptions } from "@/lib/table";
import { useDemoRole } from "@/lib/use-demo-role";
import type { PackagingSerial, ProductionBatch, RoleCode } from "@/types";

type BatchGroup = {
  batchId: string;
  batch?: ProductionBatch;
  serials: PackagingSerial[];
};

export default function PackagingPage() {
  const role = useDemoRole();
  const [rows, setRows] = useState<PackagingSerial[]>([]);
  const [batches, setBatches] = useState<ProductionBatch[]>([]);
  const [selectedSerial, setSelectedSerial] = useState<string>("");
  const [openBatchId, setOpenBatchId] = useState<string | null>(null);
  const [auditSerial, setAuditSerial] = useState<PackagingSerial | null>(null);
  const [generateForm, setGenerateForm] = useState({ batch_id: "", packaging_line: "Line A" });
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
  const selectedBatch = useMemo(
    () => batches.find((batch) => batch.batch_id === generateForm.batch_id),
    [batches, generateForm.batch_id],
  );
  const issuedForBatch = useMemo(
    () => rows.filter((row) => row.batch_id === generateForm.batch_id).length,
    [rows, generateForm.batch_id],
  );
  const totalBagsForBatch = selectedBatch ? bagsFromKg(selectedBatch.actual_sugar_output_kg) : 0;
  const remainingBags = Math.max(totalBagsForBatch - issuedForBatch, 0);

  const allBatchGroups = useMemo(() => buildBatchGroups(rows, batches), [rows, batches]);
  const visibleBatchGroups = useMemo(
    () => allBatchGroups.filter((group) => groupMatches(group, search, status)),
    [allBatchGroups, search, status],
  );
  const openBatch = useMemo(
    () => allBatchGroups.find((group) => group.batchId === openBatchId) ?? null,
    [allBatchGroups, openBatchId],
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
      setAuditSerial((current) => (current?.id === updated.id ? updated : current));
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
        packaging_line: generateForm.packaging_line,
        sku: "SUGAR_50KG",
      });
      setRows((current) => [...created, ...current]);
      setSelectedSerial(created[0]?.serial_number ?? selectedSerial);
      setOpenBatchId(generateForm.batch_id);
      setToast({ tone: "success", message: `${formatBags(created.length)} issued for ${generateForm.batch_id}.` });
    } catch (requestError) {
      setToast({ tone: "error", message: requestError instanceof Error ? requestError.message : "Serial generation was rejected." });
    } finally {
      setBusy(false);
    }
  }

  async function handleActivateSerial(serialNumber: string) {
    try {
      setBusy(true);
      const updated = await transitionSerial(serialNumber, { target_status: "ACTIVATED" });
      setRows((current) => current.map((row) => (row.id === updated.id ? updated : row)));
      setAuditSerial((current) => (current?.id === updated.id ? updated : current));
      setSelectedSerial(updated.serial_number);
      setToast({ tone: "success", message: "Serial activated and audit logged." });
    } catch (requestError) {
      setToast({ tone: "error", message: requestError instanceof Error ? requestError.message : "Serial activation was rejected." });
    } finally {
      setBusy(false);
    }
  }

  function openAudit(serial: PackagingSerial) {
    setSelectedSerial(serial.serial_number);
    setAuditSerial(serial);
  }

  function requestVoid(serial: PackagingSerial) {
    setSelectedSerial(serial.serial_number);
    setVoidOpen(true);
  }

  return (
    <>
      <PageHeader
        title="Packaging & Serial"
        eyebrow="Serial custody"
        description="Batches show issued 50 kg bag quantities. Open a batch to inspect serials, QR labels, and lifecycle evidence."
        icon={PackageCheck}
        action={<Badge tone="blue">Batch-level view</Badge>}
      />

      {role === "mill_operator" ? (
        <form onSubmit={handleGenerate} className="mb-6 rounded-lg border border-ink-100 bg-white p-5 shadow-soft">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-bold text-ink-900">Generate Serials</h2>
              <p className="mt-1 text-sm text-ink-500">Bag count is calculated from actual production output.</p>
            </div>
            <button
              type="submit"
              disabled={busy || !generateForm.batch_id || remainingBags <= 0}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-ink-900 px-4 text-sm font-bold text-white transition hover:bg-compliance-green disabled:bg-ink-300"
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
              Packaging line
              <input required value={generateForm.packaging_line} onChange={(event) => setGenerateForm({ ...generateForm, packaging_line: event.target.value })} className="h-10 rounded-md border border-ink-200 px-3 outline-none focus:border-compliance-green focus:ring-2 focus:ring-emerald-100" />
            </label>
            <div className="rounded-md border border-ink-100 bg-ink-50 px-3 py-2 text-sm">
              <p className="font-bold text-ink-900">50 kg bag rule</p>
              <p className="mt-1 text-ink-500">
                {selectedBatch ? `${formatTonsFromKg(selectedBatch.actual_sugar_output_kg)} output = ${formatBags(totalBagsForBatch)}` : "Select a batch"}
              </p>
            </div>
            <div className="rounded-md border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm">
              <p className="font-bold text-compliance-green">{formatBags(remainingBags)} to issue</p>
              <p className="mt-1 text-emerald-700">Already issued: {formatBags(issuedForBatch)}</p>
            </div>
          </div>
        </form>
      ) : null}

      <TableFilters
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search batch, serial, line"
        filters={[
          {
            label: "Status",
            value: status,
            onChange: setStatus,
            options: [{ label: "All statuses", value: "all" }, ...statusOptions.map((value) => ({ label: value, value }))],
          },
        ]}
      />

      {loading ? <StatePanel type="loading" title="Loading packaging batches" /> : null}
      {error ? <StatePanel type="error" title="Serials unavailable" detail={error} /> : null}
      {!loading && !error ? (
        visibleBatchGroups.length ? (
          <div className="grid gap-4 xl:grid-cols-2">
            {visibleBatchGroups.map((group) => (
              <BatchCard key={group.batchId} group={group} onOpen={() => setOpenBatchId(group.batchId)} />
            ))}
          </div>
        ) : (
          <StatePanel type="empty" title="No packaging batches match" detail="Adjust search or status filters, or generate serials for a production batch." />
        )
      ) : null}

      <BatchSerialModal
        group={openBatch}
        role={role}
        busy={busy}
        onClose={() => setOpenBatchId(null)}
        onOpenAudit={openAudit}
        onActivate={(serial) => void handleActivateSerial(serial.serial_number)}
        onVoid={requestVoid}
      />

      <SerialAuditModal
        serial={auditSerial}
        role={role}
        busy={busy}
        onClose={() => setAuditSerial(null)}
        onActivate={(serial) => void handleActivateSerial(serial.serial_number)}
        onVoid={requestVoid}
      />

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

function buildBatchGroups(rows: PackagingSerial[], batches: ProductionBatch[]): BatchGroup[] {
  const byBatch = new Map<string, BatchGroup>();
  for (const batch of batches) {
    byBatch.set(batch.batch_id, { batchId: batch.batch_id, batch, serials: [] });
  }
  for (const serial of rows) {
    const group = byBatch.get(serial.batch_id) ?? { batchId: serial.batch_id, serials: [] };
    group.serials.push(serial);
    byBatch.set(serial.batch_id, group);
  }
  return Array.from(byBatch.values()).sort((a, b) => b.batchId.localeCompare(a.batchId));
}

function groupMatches(group: BatchGroup, search: string, status: string) {
  const serialMatch = group.serials.some((serial) => matchesSearch(serial, search) && matchesValue(serial.status, status));
  if (serialMatch) {
    return true;
  }
  const groupHaystack = `${group.batchId} ${group.batch?.shift ?? ""}`.toLowerCase();
  const searchMatchesGroup = !search.trim() || groupHaystack.includes(search.trim().toLowerCase());
  const statusMatchesGroup = status === "all" || group.serials.some((serial) => matchesValue(serial.status, status));
  return searchMatchesGroup && statusMatchesGroup;
}

function statusCounts(serials: PackagingSerial[]) {
  return serials.reduce<Record<string, number>>((counts, serial) => {
    counts[serial.status] = (counts[serial.status] ?? 0) + 1;
    return counts;
  }, {});
}

function BatchCard({ group, onOpen }: { group: BatchGroup; onOpen: () => void }) {
  const expectedBags = group.batch ? bagsFromKg(group.batch.actual_sugar_output_kg) : group.serials.length;
  const totalWeightKg = group.serials.reduce((sum, serial) => sum + serial.bag_weight_kg, 0);
  const counts = statusCounts(group.serials);
  const lines = Array.from(new Set(group.serials.map((serial) => serial.packaging_line))).join(", ") || "No line";
  const latest = group.serials[0]?.timestamp;
  return (
    <article className="rounded-lg border border-ink-100 bg-white p-5 shadow-soft">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase text-ink-500">Production batch</p>
          <h2 className="mt-1 break-words text-lg font-bold text-ink-900">{group.batchId}</h2>
          <p className="mt-1 text-sm text-ink-500">{group.batch?.shift ?? "Batch record"} / {lines}</p>
        </div>
        <button
          type="button"
          onClick={onOpen}
          className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md bg-ink-900 px-4 text-sm font-bold text-white transition hover:bg-compliance-green"
        >
          <Eye aria-hidden="true" className="h-4 w-4" />
          View Bags
        </button>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Issued bags" value={group.serials.length.toLocaleString()} />
        <Metric label="Expected bags" value={expectedBags.toLocaleString()} />
        <Metric label="Weight" value={formatTonsFromKg(totalWeightKg)} />
        <Metric label="Latest" value={latest ? formatDateTime(latest) : "No serials"} />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {Object.entries(counts).length ? (
          Object.entries(counts).map(([label, count]) => (
            <Badge key={label}>{label}: {count}</Badge>
          ))
        ) : (
          <Badge tone="neutral">No issued bags yet</Badge>
        )}
      </div>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-ink-50 p-3 ring-1 ring-ink-100">
      <p className="text-xs font-semibold text-ink-500">{label}</p>
      <p className="mt-1 break-words text-sm font-bold text-ink-900">{value}</p>
    </div>
  );
}

function BatchSerialModal({
  group,
  role,
  busy,
  onClose,
  onOpenAudit,
  onActivate,
  onVoid,
}: {
  group: BatchGroup | null;
  role: RoleCode;
  busy: boolean;
  onClose: () => void;
  onOpenAudit: (serial: PackagingSerial) => void;
  onActivate: (serial: PackagingSerial) => void;
  onVoid: (serial: PackagingSerial) => void;
}) {
  if (!group) {
    return null;
  }
  const expectedBags = group.batch ? bagsFromKg(group.batch.actual_sugar_output_kg) : group.serials.length;
  const totalWeightKg = group.serials.reduce((sum, serial) => sum + serial.bag_weight_kg, 0);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/45 p-4">
      <div className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-lg border border-ink-100 bg-white shadow-soft">
        <div className="flex flex-col gap-3 border-b border-ink-100 p-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase text-compliance-green">Issued bag list</p>
            <h2 className="mt-1 break-words text-lg font-bold text-ink-900">{group.batchId}</h2>
            <p className="mt-1 text-sm text-ink-500">
              {formatBags(group.serials.length)} issued / {formatBags(expectedBags)} expected / {formatTonsFromKg(totalWeightKg)}
            </p>
          </div>
          <button type="button" onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-ink-200 text-ink-500 transition hover:bg-ink-50">
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto p-5">
          {group.serials.length ? (
            <div className="grid gap-3">
              {group.serials.map((serial) => (
                <article key={serial.serial_number} className="grid gap-4 rounded-lg border border-ink-100 p-3 md:grid-cols-[4.75rem_minmax(0,1fr)_auto] md:items-center">
                  <DemoQr value={serial.serial_number} size="sm" />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge>{serial.status}</Badge>
                      <Badge tone="neutral">{formatBagWeight(serial.bag_weight_kg)}</Badge>
                      <Badge tone="neutral">{serial.packaging_line}</Badge>
                    </div>
                    <p className="mt-2 break-words font-mono text-sm font-bold text-ink-900">{serial.serial_number}</p>
                    <p className="mt-1 text-xs text-ink-500">Issued {formatDateTime(serial.timestamp)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 md:justify-end">
                    <button type="button" onClick={() => onOpenAudit(serial)} className="h-9 rounded-md border border-ink-200 bg-white px-3 text-xs font-bold text-ink-700 transition hover:bg-ink-50">
                      Trail
                    </button>
                    {role === "mill_operator" && serial.status.toUpperCase() === "ISSUED" ? (
                      <button type="button" disabled={busy} onClick={() => onActivate(serial)} className="h-9 rounded-md bg-ink-900 px-3 text-xs font-bold text-white transition hover:bg-compliance-green disabled:bg-ink-300">
                        Activate
                      </button>
                    ) : null}
                    {canVoidSerial(role) && serial.status.toUpperCase() !== "VOIDED" ? (
                      <button type="button" onClick={() => onVoid(serial)} className="h-9 rounded-md border border-red-200 bg-red-50 px-3 text-xs font-bold text-red-700 transition hover:bg-red-100">
                        Void
                      </button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <StatePanel type="empty" title="No issued bags" detail="Generate serials for this production batch to print QR labels." />
          )}
        </div>
      </div>
    </div>
  );
}

function SerialAuditModal({
  serial,
  role,
  busy,
  onClose,
  onActivate,
  onVoid,
}: {
  serial: PackagingSerial | null;
  role: RoleCode;
  busy: boolean;
  onClose: () => void;
  onActivate: (serial: PackagingSerial) => void;
  onVoid: (serial: PackagingSerial) => void;
}) {
  if (!serial) {
    return null;
  }
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-ink-900/45 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg border border-ink-100 bg-white p-5 shadow-soft">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase text-compliance-green">Serial audit trail</p>
            <h2 className="mt-1 break-words font-mono text-base font-bold text-ink-900">{serial.serial_number}</h2>
          </div>
          <button type="button" onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-ink-200 text-ink-500 transition hover:bg-ink-50">
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[9rem_minmax(0,1fr)]">
          <DemoQr value={serial.serial_number} />
          <div className="min-w-0 rounded-lg bg-ink-50 p-4 ring-1 ring-ink-100">
            <div className="grid gap-3 sm:grid-cols-2">
              <Metric label="Batch" value={serial.batch_id} />
              <Metric label="Status" value={serial.status} />
              <Metric label="Bag weight" value={formatBagWeight(serial.bag_weight_kg)} />
              <Metric label="Packaging line" value={serial.packaging_line} />
            </div>
            <p className="mt-3 text-xs leading-5 text-ink-500">
              QR payload is the unique serial number printed on the bag. Future scanner integrations can read this code at activation, warehouse, dispatch, and receipt.
            </p>
          </div>
        </div>

        <div className="mt-5">
          <SerialLifecycle status={serial.status} />
        </div>

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          {role === "mill_operator" && serial.status.toUpperCase() === "ISSUED" ? (
            <button type="button" disabled={busy} onClick={() => onActivate(serial)} className="inline-flex h-10 items-center gap-2 rounded-md bg-ink-900 px-4 text-sm font-bold text-white transition hover:bg-compliance-green disabled:bg-ink-300">
              <Zap aria-hidden="true" className="h-4 w-4" />
              Activate serial
            </button>
          ) : null}
          {canVoidSerial(role) && serial.status.toUpperCase() !== "VOIDED" ? (
            <button type="button" onClick={() => onVoid(serial)} className="inline-flex h-10 items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 text-sm font-bold text-red-700 transition hover:bg-red-100">
              <ShieldAlert aria-hidden="true" className="h-4 w-4" />
              Void serial
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function DemoQr({ value, size = "lg" }: { value: string; size?: "sm" | "lg" }) {
  const bits = useMemo(() => {
    let seedBase = 0;
    for (const char of value) {
      seedBase = (seedBase * 31 + char.charCodeAt(0)) >>> 0;
    }
    return Array.from({ length: 121 }, (_, index) => {
      const finder =
        (index < 33 && index % 11 < 3) ||
        (index > 87 && index % 11 < 3) ||
        (index < 33 && index % 11 > 7);
      const cellHash = (seedBase + index * 2654435761 + (index % 11) * 1013904223) >>> 0;
      return finder || cellHash % 5 < 2;
    });
  }, [value]);

  return (
    <div className={`${size === "sm" ? "h-16 w-16" : "h-32 w-32"} grid shrink-0 grid-cols-11 gap-0.5 rounded-md border border-ink-200 bg-white p-2`}>
      {bits.map((filled, index) => (
        <span key={index} className={filled ? "rounded-[1px] bg-ink-900" : "rounded-[1px] bg-white"} />
      ))}
    </div>
  );
}
