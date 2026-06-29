"use client";

import { useEffect, useMemo, useState } from "react";
import { ScrollText } from "lucide-react";
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

const columns: DataTableColumn<AuditLog>[] = [
  { key: "time", header: "Time", cell: (row) => formatDateTime(row.created_at) },
  { key: "actor", header: "Actor", cell: (row) => row.actor_name ?? "System" },
  { key: "role", header: "Role", cell: (row) => <Badge tone="neutral">{row.actor_role ?? "system"}</Badge> },
  { key: "action", header: "Action", cell: (row) => <Badge tone="blue">{row.action}</Badge> },
  { key: "entity", header: "Entity", cell: (row) => `${row.entity_type ?? row.entity} / ${row.entity_id}` },
  { key: "detail", header: "Detail", cell: (row) => <span className="whitespace-normal">{row.detail}</span>, className: "min-w-[20rem]" },
  { key: "hash", header: "Event Hash", cell: (row) => <span className="font-mono text-xs">{shortHash(row.event_hash)}</span> },
  { key: "previous", header: "Previous", cell: (row) => <span className="font-mono text-xs">{shortHash(row.previous_event_hash)}</span> },
];

export default function AuditLogsPage() {
  const [rows, setRows] = useState<AuditLog[]>([]);
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

  return (
    <>
      <PageHeader
        title="Audit Logs"
        eyebrow="Evidence trail"
        description="Sensitive actions are recorded with old/new values and linked event hashes for tamper-evident review."
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
    </>
  );
}
