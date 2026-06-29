"use client";

import Link from "next/link";
import { Boxes, ClipboardList, Factory, FileWarning, GitBranch, PackageCheck, ReceiptText, Scale, ScrollText, Truck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/Badge";
import { PageHeader } from "@/components/PageHeader";
import { canAccess } from "@/lib/roles";
import { useDemoRole } from "@/lib/use-demo-role";

type FlowStep = {
  title: string;
  role: string;
  creates: string;
  validation: string;
  exception: string;
  href: string;
  next: string;
  icon: LucideIcon;
};

const steps: FlowStep[] = [
  {
    title: "Cane Intake",
    role: "Mill Operator",
    creates: "Supplier, vehicle, gross weight, tare weight, net cane weight.",
    validation: "Gross weight must be greater than tare weight.",
    exception: "WEIGHT_INVALID or MANUAL_OVERRIDE",
    href: "/dashboard/cane-intake",
    next: "Create production batch",
    icon: Scale,
  },
  {
    title: "Production Batch",
    role: "Mill Operator",
    creates: "Linked intake records, actual sugar output, recovery percentage.",
    validation: "At least one unused cane intake is required.",
    exception: "RECOVERY_VARIANCE_WARNING or CRITICAL",
    href: "/dashboard/production",
    next: "Generate serials",
    icon: Factory,
  },
  {
    title: "Serial Generation",
    role: "Mill Operator",
    creates: "Batch serials, sequence numbers, bag weight, packaging line.",
    validation: "Serials must be unique and sequential.",
    exception: "SERIAL_DUPLICATE or SERIAL_GAP",
    href: "/dashboard/packaging",
    next: "Activate serials",
    icon: ClipboardList,
  },
  {
    title: "Serial Activation",
    role: "Mill Operator",
    creates: "ACTIVATED custody event for issued serials.",
    validation: "Lifecycle only moves forward.",
    exception: "SERIAL_INVALID_TRANSITION",
    href: "/dashboard/packaging",
    next: "Move to warehouse",
    icon: PackageCheck,
  },
  {
    title: "Warehouse Receipt",
    role: "Warehouse Manager",
    creates: "Warehouse receipt, bay location, stock quantity, total weight.",
    validation: "Only ACTIVATED serials can enter warehouse.",
    exception: "ACTIVATED_NOT_WAREHOUSED",
    href: "/dashboard/warehouse",
    next: "Create dispatch",
    icon: Boxes,
  },
  {
    title: "Dispatch",
    role: "Warehouse Manager",
    creates: "Buyer, vehicle, driver, invoice, serialized dispatch record.",
    validation: "Only WAREHOUSED serials with invoice can dispatch.",
    exception: "DISPATCH_INVALID_SERIAL or WITHOUT_INVOICE",
    href: "/dashboard/dispatch",
    next: "Confirm receipt",
    icon: Truck,
  },
  {
    title: "Buyer Receipt",
    role: "Warehouse Manager / Buyer",
    creates: "Received serial list and shortage or mismatch result.",
    validation: "Buyer and serials must match dispatch.",
    exception: "RECEIPT_SHORTAGE or WRONG_BUYER",
    href: "/dashboard/buyer-receipts",
    next: "Review exceptions",
    icon: ReceiptText,
  },
  {
    title: "Exceptions",
    role: "FBR Officer / Auditor",
    creates: "Review status, resolution reason, linked evidence.",
    validation: "Resolution or dismissal requires reason.",
    exception: "Open alerts remain visible until resolved.",
    href: "/dashboard/exceptions",
    next: "Inspect audit trail",
    icon: FileWarning,
  },
  {
    title: "Audit Trail",
    role: "System / Auditor",
    creates: "Actor, action, old/new values, event hash, previous hash.",
    validation: "Audit logs are read-only from the UI.",
    exception: "Tamper-evident evidence chain.",
    href: "/dashboard/audit-logs",
    next: "Trace one batch",
    icon: ScrollText,
  },
];

export default function EndToEndFlowPage() {
  const role = useDemoRole();

  return (
    <AppShell>
      <PageHeader
        title="End-to-End Flow"
        eyebrow="Demo journey"
        description="Follow the MVP from cane intake through buyer receipt, exceptions, and audit evidence."
        icon={GitBranch}
        action={<Badge tone="success">Step-by-step</Badge>}
      />

      <section className="grid gap-4">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const allowed = canAccess(role, step.href);
          return (
            <article key={step.title} className="rounded-lg border border-ink-100 bg-white p-5 shadow-soft">
              <div className="grid gap-4 lg:grid-cols-[13rem_1fr_auto] lg:items-start">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-emerald-50 text-sm font-bold text-compliance-green ring-1 ring-emerald-100">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-base font-bold text-ink-900">{step.title}</h2>
                    <Badge tone="neutral" className="mt-2 max-w-full whitespace-normal text-left">
                      {step.role}
                    </Badge>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-md bg-ink-50 p-3 ring-1 ring-ink-100">
                    <p className="text-xs font-bold uppercase text-ink-500">Creates</p>
                    <p className="mt-2 text-sm leading-6 text-ink-700">{step.creates}</p>
                  </div>
                  <div className="rounded-md bg-ink-50 p-3 ring-1 ring-ink-100">
                    <p className="text-xs font-bold uppercase text-ink-500">Validation</p>
                    <p className="mt-2 text-sm leading-6 text-ink-700">{step.validation}</p>
                  </div>
                  <div className="rounded-md bg-ink-50 p-3 ring-1 ring-ink-100">
                    <p className="text-xs font-bold uppercase text-ink-500">Possible exception</p>
                    <p className="mt-2 break-words text-sm font-bold leading-6 text-ink-900">{step.exception}</p>
                  </div>
                </div>

                {allowed ? (
                  <Link
                    href={step.href}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-ink-900 px-4 text-sm font-bold text-white transition hover:bg-compliance-green"
                  >
                    <Icon aria-hidden="true" className="h-4 w-4" />
                    {step.next}
                  </Link>
                ) : (
                  <span className="inline-flex h-10 items-center justify-center rounded-md border border-ink-200 bg-ink-50 px-4 text-sm font-bold text-ink-500">
                    Role locked
                  </span>
                )}
              </div>
            </article>
          );
        })}
      </section>
    </AppShell>
  );
}
