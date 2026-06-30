"use client";

import { useEffect, useMemo, useState } from "react";
import { Eye, ScrollText, X } from "lucide-react";
import { Badge } from "@/components/Badge";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { PageHeader } from "@/components/PageHeader";
import { StatePanel } from "@/components/StatePanel";
import { TableFilters } from "@/components/TableFilters";
import { getAuditLogs } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { matchesSearch, matchesValue, uniqueOptions } from "@/lib/table";
import type { AuditLog } from "@/types";

function shortHash(value?: string | null) {
  return value ? `${value.slice(0, 10)}...` : "Pending";
}

export default function AuditLogsPage() {
  const [rows, setRows] = useState<AuditLog[]>([]);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("all");
  const [action, setAction] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAuditLogs()
      .then(setRows)
      .catch((requestError) => setError(requestError instanceof Error ? requestError.message : "Audit logs could not load."))
      .finally(() => setLoading(false));
  }, []);

  const roleOptions = useMemo(() => uniqueOptions(rows.map((row) => row.actor_role)), [rows]);
  const actionOptions = useMemo(() => uniqueOptions(rows.map((row) => row.action)), [rows]);
  const filteredRows = useMemo(
    () => rows.filter((row) => matchesSearch(row, search) && matchesValue(row.actor_role, role) && matchesValue(row.action, action)),
    [rows, search, role, action],
  );
  const columns = useMemo<DataTableColumn<AuditLog>[]>(
    () => [
      { key: "time", header: "Time", cell: (row) => formatDateTime(row.created_at), className: "w-28" },
      {
        key: "actor",
        header: "Actor",
        cell: (row) => (
          <div className="min-w-0">
            <p className="font-semibold text-ink-900">{row.actor_name ?? "System"}</p>
            <div className="mt-1">
              <Badge tone="neutral">{row.actor_role ?? "system"}</Badge>
            </div>
          </div>
        ),
        className: "w-44",
      },
      { key: "action", header: "Action", cell: (row) => <Badge tone="blue">{row.action}</Badge>, className: "w-48" },
      {
        key: "entity",
        header: "Entity",
        cell: (row) => (
          <div className="min-w-0">
            <p className="font-semibold text-ink-900">{row.entity_type ?? row.entity}</p>
            <p className="mt-1 break-words font-mono text-xs text-ink-500">{row.entity_id}</p>
          </div>
        ),
      },
      {
        key: "summary",
        header: "Summary",
        cell: (row) => <span className="line-clamp-2 text-sm leading-6 text-ink-600">{row.detail}</span>,
        className: "min-w-[18rem]",
      },
      {
        key: "evidence",
        header: "Evidence",
        cell: (row) => (
          <button
            type="button"
            onClick={() => setSelectedLog(row)}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-ink-200 bg-white px-3 text-xs font-bold text-ink-700 transition hover:bg-ink-50"
          >
            <Eye aria-hidden="true" className="h-4 w-4" />
            View
          </button>
        ),
        className: "w-28",
      },
    ],
    [],
  );

  return (
    <>
      <PageHeader
        title="Audit Logs"
        eyebrow="Evidence trail"
        description="Sensitive actions are recorded with linked event hashes. Open a row for full detail and hash-chain evidence."
        icon={ScrollText}
        action={<Badge tone="neutral">Read only</Badge>}
      />

      <TableFilters
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search actor, entity, detail"
        filters={[
          {
            label: "Role",
            value: role,
            onChange: setRole,
            options: [{ label: "All roles", value: "all" }, ...roleOptions.map((value) => ({ label: value, value }))],
          },
          {
            label: "Action",
            value: action,
            onChange: setAction,
            options: [{ label: "All actions", value: "all" }, ...actionOptions.map((value) => ({ label: value, value }))],
          },
        ]}
      />

      {loading ? <StatePanel type="loading" title="Loading audit trail" /> : null}
      {error ? <StatePanel type="error" title="Audit logs unavailable" detail={error} /> : null}
      {!loading && !error ? (
        <DataTable columns={columns} rows={filteredRows} getRowKey={(row) => row.id} emptyText="No audit events match the current filters." />
      ) : null}

      <AuditDetailModal log={selectedLog} onClose={() => setSelectedLog(null)} />
    </>
  );
}

function AuditDetailModal({ log, onClose }: { log: AuditLog | null; onClose: () => void }) {
  if (!log) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/45 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg border border-ink-100 bg-white p-5 shadow-soft">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase text-compliance-green">Audit evidence</p>
            <h2 className="mt-1 break-words text-lg font-bold text-ink-900">{log.action}</h2>
            <p className="mt-1 text-sm text-ink-500">{formatDateTime(log.created_at)} / {log.actor_name ?? "System"} / {log.actor_role ?? "system"}</p>
          </div>
          <button type="button" onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-ink-200 text-ink-500 transition hover:bg-ink-50">
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <EvidenceBlock label="Entity" value={`${log.entity_type ?? log.entity} / ${log.entity_id}`} />
          <EvidenceBlock label="Event hash" value={shortHash(log.event_hash)} mono />
          <EvidenceBlock label="Previous hash" value={shortHash(log.previous_event_hash)} mono />
          <EvidenceBlock label="Blockchain anchor" value={log.blockchain_anchor_hash ?? "Future anchor not set"} mono />
        </div>

        <div className="mt-4 rounded-lg bg-ink-50 p-4 ring-1 ring-ink-100">
          <p className="text-xs font-bold uppercase text-ink-500">Detail</p>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-ink-700">{log.detail}</p>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <EvidenceBlock label="Old value" value={log.old_value ?? "No previous value captured"} mono />
          <EvidenceBlock label="New value" value={log.new_value ?? "No new value captured"} mono />
        </div>
      </div>
    </div>
  );
}

function EvidenceBlock({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0 rounded-lg bg-ink-50 p-4 ring-1 ring-ink-100">
      <p className="text-xs font-bold uppercase text-ink-500">{label}</p>
      <p className={`mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-ink-800 ${mono ? "font-mono text-xs" : ""}`}>{value}</p>
    </div>
  );
}
