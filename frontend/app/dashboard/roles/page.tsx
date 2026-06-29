"use client";

import { useEffect, useMemo, useState } from "react";
import { UserCog, Users } from "lucide-react";
import { Badge } from "@/components/Badge";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { PageHeader } from "@/components/PageHeader";
import { StatePanel } from "@/components/StatePanel";
import { TableFilters } from "@/components/TableFilters";
import { getUsers } from "@/lib/api";
import { roleCapabilities, roleIcons, roleLabels } from "@/lib/roles";
import { matchesSearch, matchesValue, uniqueOptions } from "@/lib/table";
import type { DemoUser, RoleCode } from "@/types";

const roleCodes = Object.keys(roleLabels) as RoleCode[];

const columns: DataTableColumn<DemoUser>[] = [
  { key: "name", header: "User", cell: (row) => <span className="font-bold text-ink-900">{row.name}</span> },
  { key: "email", header: "Email", cell: (row) => row.email },
  { key: "role", header: "Role", cell: (row) => <Badge tone="blue">{row.role.name}</Badge> },
  { key: "mill", header: "Mill", cell: (row) => row.mill?.name ?? "Government network" },
  { key: "status", header: "Status", cell: (row) => <Badge>{row.status}</Badge> },
];

export default function RolesPage() {
  const [users, setUsers] = useState<DemoUser[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getUsers()
      .then(setUsers)
      .catch((requestError) => setError(requestError instanceof Error ? requestError.message : "Demo users could not load."))
      .finally(() => setLoading(false));
  }, []);

  const statusOptions = useMemo(() => uniqueOptions(users.map((user) => user.status)), [users]);
  const filteredUsers = useMemo(
    () => users.filter((user) => matchesSearch(user, search) && matchesValue(user.status, status)),
    [users, search, status],
  );

  return (
    <>
      <PageHeader
        title="Role Management"
        eyebrow="Demo access"
        description="Seeded users and role scopes for the MVP stakeholder walkthrough."
        icon={UserCog}
        action={<Badge tone="neutral">Demo authentication</Badge>}
      />

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {roleCodes.map((role) => {
          const Icon = roleIcons[role];
          return (
            <article key={role} className="rounded-lg border border-ink-100 bg-white p-5 shadow-soft">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-md bg-emerald-50 text-compliance-green">
                  <Icon aria-hidden="true" className="h-5 w-5" />
                </span>
                <h2 className="text-base font-bold text-ink-900">{roleLabels[role]}</h2>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {roleCapabilities[role].map((capability) => (
                  <Badge key={capability} tone="neutral">
                    {capability}
                  </Badge>
                ))}
              </div>
            </article>
          );
        })}
      </div>

      <div className="mb-3 flex items-center gap-2">
        <Users aria-hidden="true" className="h-4 w-4 text-compliance-green" />
        <h2 className="text-base font-bold text-ink-900">Demo Users</h2>
      </div>
      <TableFilters
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search user, role, mill"
        filters={[
          {
            label: "Status",
            value: status,
            onChange: setStatus,
            options: [{ label: "All statuses", value: "all" }, ...statusOptions.map((value) => ({ label: value, value }))],
          },
        ]}
      />
      {loading ? <StatePanel type="loading" title="Loading roles" /> : null}
      {error ? <StatePanel type="error" title="Roles unavailable" detail={error} /> : null}
      {!loading && !error ? (
        <DataTable columns={columns} rows={filteredUsers} getRowKey={(row) => row.id} emptyText="No demo users match the current filters." />
      ) : null}
    </>
  );
}
