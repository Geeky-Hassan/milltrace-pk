"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, BadgeCheck, Boxes, ClipboardCheck, Factory, FileWarning, Gauge, GitBranch, Link2, Map, PackageCheck, ReceiptText, Scale, ShieldCheck, Truck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/Badge";
import { PageHeader } from "@/components/PageHeader";
import { StatePanel } from "@/components/StatePanel";
import { getGapMap } from "@/lib/api";
import type { GapMapItem } from "@/types";

const problems = [
  ["Cane intake manipulation", "Wrong supplier, ticket reuse, or missing load.", "Unique intake ID, vehicle, supplier, timestamp, audit log."],
  ["Weighbridge mismatch", "Gross/tare edits can distort taxable production.", "Gross > tare validation and override reason control."],
  ["Suppressed production", "Sugar output can be hidden from tax records.", "Expected vs actual recovery variance."],
  ["Recovery manipulation", "Low recovery can mask off-book output.", "Warning and critical thresholds."],
  ["Serial gaps", "Skipped serials can support undeclared bags.", "Sequential generation and gap alerts."],
  ["Warehouse mismatch", "Stock can leak between packaging and storage.", "Serial-level warehouse receipt."],
  ["Dispatch without invoice", "Product can leave without tax evidence.", "Missing invoice exception."],
  ["Wrong buyer receipt", "Fake receipt can close a dispatch.", "Buyer and serial matching."],
  ["Manual override abuse", "Insiders can bypass controls.", "Reason, approval, audit trail."],
  ["Weak audit trail", "Logs can be altered after the fact.", "Hash-chain event log."],
];

const included = ["Demo role-based login", "Cane intake records", "Production batch creation", "Expected vs actual output", "Recovery variance detection", "Serial lifecycle", "Warehouse receipt tracking", "Dispatch validation", "Buyer receipt matching", "Exception alerts", "Audit logs", "Risk score", "Scenario testing lab", "Scope explanation page"];
const simulated = ["Weighbridge data is manually entered or seeded.", "FBR tax stamp/UIM data uses internal serials.", "Blockchain is simulated using hash-chain audit logs.", "Buyer receipt is simulated through dashboard actions.", "Production counters use batch output values.", "GPS/e-bilty integration is not live yet."];
const future = ["Real weighbridge API", "FBR Track & Trace / UIM", "ERP/inventory integration", "Packaging line PLC / hopper counter", "Checkweigher integration", "CCTV/NVR metadata", "E-invoice integration", "E-bilty/cargo tracking", "Buyer/distributor mobile app", "Bank/payment verification", "Permissioned ledger anchoring"];

type FlowStage = [string, string, string, string, string, LucideIcon];

const flow: FlowStage[] = [
  ["Cane Intake", "Supplier, vehicle, gross/tare", "Gross > tare; unique ticket", "WEIGHT_INVALID", "Mill Operator", Scale],
  ["Production Batch", "Linked intake IDs, actual output", "Recovery variance", "RECOVERY_VARIANCE", "Mill Operator", Factory],
  ["Serial Activation", "Batch serials, line, sequence", "Forward-only lifecycle", "SERIAL_GAP", "Mill Operator", PackageCheck],
  ["Warehouse Receipt", "Activated serial scans", "Only ACTIVATED can enter", "ACTIVATED_NOT_WAREHOUSED", "Warehouse Manager", Boxes],
  ["Dispatch", "Buyer, invoice, vehicle, serials", "Only WAREHOUSED can dispatch", "DISPATCH_INVALID_SERIAL", "Warehouse Manager", Truck],
  ["Buyer Receipt", "Buyer, received serials", "Buyer and serial match", "RECEIPT_SHORTAGE", "Warehouse/Buyer", ReceiptText],
  ["Exception Engine", "Rules and thresholds", "Group duplicate issues", "MANUAL_OVERRIDE", "System", FileWarning],
  ["Audit Trail", "Actor, old/new value, hash", "Hash-chain evidence", "Weak trail blocked", "System", ClipboardCheck],
  ["Compliance Dashboard", "Risk score and top risks", "Severity-based scoring", "Critical risk", "Owner / FBR", Gauge],
];

const limitations = ["Proves workflow and detection logic.", "Does not yet connect to real mill hardware.", "Does not yet connect to live FBR systems.", "Does not yet anchor hashes to a live blockchain.", "Does not replace legal enforcement.", "Provides evidence and exception dashboards."];
const success = ["Track one batch end-to-end.", "Detect abnormal recovery variance.", "Detect serial gaps and duplicates.", "Block invalid dispatch.", "Detect missing buyer receipt.", "Audit every sensitive action.", "Restrict each role correctly.", "Explain value within 5 minutes."];

function PillList({ items, tone }: { items: string[]; tone: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <Badge key={item} tone={tone}>{item}</Badge>
      ))}
    </div>
  );
}

export default function ScopePage() {
  const [gaps, setGaps] = useState<GapMapItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getGapMap().then(setGaps).finally(() => setLoading(false));
  }, []);

  return (
    <AppShell>
      <PageHeader
        title="Scope & Solution Map"
        eyebrow="Stakeholder orientation"
        description="What MillTrace PK solves today, what is simulated, and what should integrate after MVP approval."
        icon={Map}
        action={<Badge tone="success">Demo-ready scope</Badge>}
      />

      <section className="rounded-lg border border-ink-100 bg-white p-5 shadow-soft">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-md bg-ink-900 text-white"><ShieldCheck className="h-5 w-5" aria-hidden="true" /></span>
          <div>
            <h2 className="text-lg font-bold text-ink-900">What We Are Solving</h2>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-ink-500">MillTrace PK tracks sugar from cane intake to production, packaging, warehouse, dispatch, and buyer receipt to reduce diversion, production suppression, serial manipulation, warehouse leakage, and tax evasion.</p>
          </div>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {problems.map(([problem, why, detects]) => (
            <article key={problem} className="rounded-lg border border-ink-100 p-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-ink-900">{problem}</h3>
                <AlertTriangle className="h-4 w-4 text-compliance-amber" aria-hidden="true" />
              </div>
              <p className="mt-3 text-xs font-bold uppercase text-ink-500">Why it matters</p>
              <p className="mt-1 text-sm leading-6 text-ink-600">{why}</p>
              <p className="mt-3 text-xs font-bold uppercase text-ink-500">MVP detects</p>
              <p className="mt-1 text-sm leading-6 text-ink-600">{detects}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-3">
        <article className="rounded-lg border border-ink-100 bg-white p-5 shadow-soft">
          <h2 className="text-base font-bold text-ink-900">Current MVP Scope</h2>
          <div className="mt-4"><PillList items={included} tone="success" /></div>
          <Badge tone="success" className="mt-4">Implemented in MVP</Badge>
        </article>
        <article className="rounded-lg border border-ink-100 bg-white p-5 shadow-soft">
          <h2 className="text-base font-bold text-ink-900">Simulated in MVP</h2>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-ink-600">
            {simulated.map((item) => <li key={item}>{item}</li>)}
          </ul>
          <Badge tone="warning" className="mt-4">Simulated for demo</Badge>
        </article>
        <article className="rounded-lg border border-ink-100 bg-white p-5 shadow-soft">
          <h2 className="text-base font-bold text-ink-900">Future Real Integrations</h2>
          <div className="mt-4"><PillList items={future} tone="blue" /></div>
          <Badge tone="blue" className="mt-4">Future integration</Badge>
        </article>
      </section>

      <section className="mt-6 rounded-lg border border-ink-100 bg-white p-5 shadow-soft">
        <div className="flex items-center gap-2">
          <GitBranch className="h-5 w-5 text-compliance-green" aria-hidden="true" />
          <h2 className="text-base font-bold text-ink-900">How We Solve The Problem</h2>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {flow.map(([stage, input, rule, exception, role, Icon]) => (
            <article key={stage} className="rounded-lg border border-ink-100 p-4">
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-md bg-emerald-50 text-compliance-green"><Icon className="h-4 w-4" aria-hidden="true" /></span>
                <h3 className="font-bold text-ink-900">{stage}</h3>
              </div>
              <div className="mt-4 grid gap-2 text-sm">
                <p><span className="font-bold text-ink-700">Input:</span> {input}</p>
                <p><span className="font-bold text-ink-700">Rule:</span> {rule}</p>
                <p><span className="font-bold text-ink-700">Exception:</span> {exception}</p>
                <p><span className="font-bold text-ink-700">Role:</span> {role}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-2">
        <article className="rounded-lg border border-ink-100 bg-white p-5 shadow-soft">
          <h2 className="text-base font-bold text-ink-900">MVP Limitations</h2>
          <div className="mt-4 grid gap-2">{limitations.map((item) => <Badge key={item} tone="neutral">{item}</Badge>)}</div>
        </article>
        <article className="rounded-lg border border-ink-100 bg-white p-5 shadow-soft">
          <h2 className="text-base font-bold text-ink-900">Success Criteria</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {success.map((item) => (
              <div key={item} className="flex items-center gap-2 text-sm font-semibold text-ink-700"><BadgeCheck className="h-4 w-4 text-compliance-green" aria-hidden="true" />{item}</div>
            ))}
          </div>
        </article>
      </section>

      <section className="mt-6 rounded-lg border border-ink-100 bg-white p-5 shadow-soft">
        <div className="flex items-center gap-2">
          <Link2 className="h-5 w-5 text-compliance-green" aria-hidden="true" />
          <h2 className="text-base font-bold text-ink-900">Gap Resolution Map</h2>
        </div>
        {loading ? <div className="mt-4"><StatePanel type="loading" title="Loading gap map" /></div> : null}
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {gaps.map((gap) => (
            <article key={gap.gap_name} className="rounded-lg border border-ink-100 p-4">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-bold text-ink-900">{gap.gap_name}</h3>
                <Badge tone={gap.mvp_status.includes("Simulated") ? "warning" : "success"}>{gap.mvp_status}</Badge>
              </div>
              <p className="mt-3 text-xs font-bold uppercase text-ink-500">Loophole</p>
              <p className="mt-1 text-sm leading-6 text-ink-600">{gap.current_loophole}</p>
              <p className="mt-3 text-xs font-bold uppercase text-ink-500">Control</p>
              <p className="mt-1 text-sm leading-6 text-ink-600">{gap.system_control}</p>
              <p className="mt-3 text-xs font-bold uppercase text-ink-500">Proved by</p>
              <p className="mt-1 text-sm font-bold text-ink-900">{gap.demo_scenario}</p>
            </article>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
