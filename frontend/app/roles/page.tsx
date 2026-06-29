"use client";

import { CheckCircle2, Lock, UserCog } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/Badge";
import { PageHeader } from "@/components/PageHeader";
import { roleIcons, roleLabels } from "@/lib/roles";
import type { RoleCode } from "@/types";

type RoleDefinition = {
  role: RoleCode;
  purpose: string;
  can: string[];
  cannot: string[];
};

const roleDefinitions: RoleDefinition[] = [
  {
    role: "mill_owner",
    purpose: "Views overall business, production, stock, risk, and compliance status.",
    can: ["View dashboard", "View production", "View warehouse", "View dispatch", "View exceptions", "View audit logs"],
    cannot: ["Secretly edit compliance records", "Resolve official exceptions", "Bypass audit logs"],
  },
  {
    role: "mill_operator",
    purpose: "Handles cane intake, production batches, and serial activation.",
    can: ["Create cane intake", "Create production batch", "Activate serials", "View production exceptions"],
    cannot: ["Dispatch warehouse stock", "Resolve exceptions", "Edit warehouse records"],
  },
  {
    role: "warehouse_manager",
    purpose: "Handles warehouse receipt and dispatch.",
    can: ["Receive activated serials", "Create dispatch", "View warehouse stock", "View dispatch records"],
    cannot: ["Edit production output", "Resolve compliance exceptions", "Change cane intake records"],
  },
  {
    role: "fbr_officer",
    purpose: "Reviews compliance, exceptions, serial lifecycle, and risk.",
    can: ["View compliance dashboard", "View exceptions", "View audit logs", "Mark exceptions in review"],
    cannot: ["Change mill production data", "Create dispatch", "Edit warehouse records"],
  },
  {
    role: "government_admin",
    purpose: "Views high-level compliance and policy-level monitoring.",
    can: ["View high-level dashboard", "View scope map", "View all mills if available", "View risk status"],
    cannot: ["Manipulate operational records"],
  },
  {
    role: "auditor",
    purpose: "Reviews evidence, audit logs, and exception resolution.",
    can: ["View audit logs", "View exception details", "Add review notes", "Resolve or dismiss with reason"],
    cannot: ["Create production data", "Create dispatch data", "Change serial lifecycle directly"],
  },
];

export default function RolesResponsibilitiesPage() {
  return (
    <AppShell>
      <PageHeader
        title="Roles & Responsibilities"
        eyebrow="Access model"
        description="Each role gets only the actions needed for the sugar traceability workflow."
        icon={UserCog}
        action={<Badge tone="neutral">Demo RBAC</Badge>}
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {roleDefinitions.map((definition) => {
          const Icon = roleIcons[definition.role];
          return (
            <article key={definition.role} className="rounded-lg border border-ink-100 bg-white p-5 shadow-soft">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-emerald-50 text-compliance-green ring-1 ring-emerald-100">
                  <Icon aria-hidden="true" className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-ink-900">{roleLabels[definition.role]}</h2>
                  <p className="mt-1 text-sm leading-6 text-ink-500">{definition.purpose}</p>
                </div>
              </div>

              <div className="mt-5 grid gap-4">
                <div>
                  <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase text-ink-500">
                    <CheckCircle2 aria-hidden="true" className="h-4 w-4 text-compliance-green" />
                    Can
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {definition.can.map((item) => (
                      <Badge key={item} tone="success" className="max-w-full whitespace-normal text-left">
                        {item}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase text-ink-500">
                    <Lock aria-hidden="true" className="h-4 w-4 text-red-700" />
                    Cannot
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {definition.cannot.map((item) => (
                      <Badge key={item} tone="danger" className="max-w-full whitespace-normal text-left">
                        {item}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </section>
    </AppShell>
  );
}
