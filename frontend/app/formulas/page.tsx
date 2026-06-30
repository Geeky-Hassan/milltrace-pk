"use client";

import { AlertTriangle, Calculator, Factory, PackageCheck, ReceiptText, Scale, ShieldCheck, Truck } from "lucide-react";
import { Badge } from "@/components/Badge";
import { PageHeader } from "@/components/PageHeader";

const formulaCards = [
  {
    title: "Cane Intake",
    icon: Scale,
    formula: "Net cane = gross tons - tare tons",
    rule: "Operators enter weights in tons. Backend stores kg for precise calculation and audit.",
    checks: ["Gross must be greater than tare", "Reject zero or negative weight", "Duplicate vehicle window: 20 minutes"],
  },
  {
    title: "Production Output",
    icon: Factory,
    formula: "Expected sugar = cane input x 10.5%",
    rule: "Expected recovery can later come from mill settings, cane quality, season, or lab data.",
    checks: ["Low recovery requires downtime reason", "Over 14.5% is physically suspicious", "One cane intake cannot feed two batches"],
  },
  {
    title: "Recovery Variance",
    icon: AlertTriangle,
    formula: "Variance % = (actual - expected) / expected",
    rule: "The exception engine flags abnormal production gaps without calling every small variation fraud.",
    checks: ["Normal: within +/-3%", "Warning: above 3% up to 7%", "Critical: above 7%"],
  },
  {
    title: "Packaging Bags",
    icon: PackageCheck,
    formula: "Issued bags = floor(actual sugar kg / 50)",
    rule: "Bag size is fixed at 50 kg. Operators choose batch and line; quantity is derived automatically.",
    checks: ["Unique serial required", "Sequence gaps are flagged", "Only issued serials should be printed"],
  },
  {
    title: "Serial Lifecycle",
    icon: ShieldCheck,
    formula: "ISSUED -> ACTIVATED -> WAREHOUSED -> DISPATCHED -> RECEIVED",
    rule: "Serials move forward only. Voiding requires reason and supervisor approval.",
    checks: ["No backward status change", "No warehouse before activation", "No dispatch before warehouse"],
  },
  {
    title: "Warehouse SLA",
    icon: PackageCheck,
    formula: "Activated -> warehouse within 24 hours",
    rule: "Warehouse stock is calculated from serial receipts, not typed totals.",
    checks: ["Quantity = scanned serials", "Weight = serials x 50 kg", "Late warehousing raises leakage risk"],
  },
  {
    title: "Dispatch",
    icon: Truck,
    formula: "Dispatch quantity = scanned warehoused serials",
    rule: "A dispatch needs buyer, vehicle, driver, invoice, and serial list. Demo invoice can be generated or typed manually.",
    checks: ["Only WAREHOUSED serials", "Invoice required in UI", "Future e-invoice integration planned"],
  },
  {
    title: "Buyer Receipt",
    icon: ReceiptText,
    formula: "Receipt serials must match dispatch serials and buyer",
    rule: "Receipt confirms the chain. Any shortage, extra serial, wrong buyer, or duplicate receipt is flagged.",
    checks: ["48 hour missing receipt SLA", "Shortage creates exception", "Wrong buyer does not close dispatch"],
  },
];

const riskBands = [
  ["Low", "0-30", "Healthy flow, no serious open exception"],
  ["Medium", "31-60", "Some unresolved control issues"],
  ["High", "61-80", "Serious exception or connected weak signals"],
  ["Critical", "81-100", "Critical exception chain needs urgent review"],
];

export default function FormulasPage() {
  return (
    <>
      <PageHeader
        title="Rules & Formulas"
        eyebrow="Compliance logic"
        description="The calculation rules used by MillTrace PK for weights, recovery, serials, stock, dispatch, and receipt checks."
        icon={Calculator}
        action={<Badge tone="blue">Demo configuration</Badge>}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {formulaCards.map((item) => {
          const Icon = item.icon;
          return (
            <article key={item.title} className="min-w-0 rounded-lg border border-ink-100 bg-white p-4 shadow-soft">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-emerald-50 text-compliance-green ring-1 ring-emerald-100">
                  <Icon aria-hidden="true" className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-ink-900">{item.title}</h2>
                  <p className="mt-2 rounded-md bg-ink-50 px-3 py-2 text-xs font-bold leading-5 text-ink-700 ring-1 ring-ink-100 [overflow-wrap:anywhere]">
                    {item.formula}
                  </p>
                </div>
              </div>
              <p className="mt-4 text-sm leading-6 text-ink-600">{item.rule}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {item.checks.map((check) => (
                  <Badge key={check} tone="neutral">
                    {check}
                  </Badge>
                ))}
              </div>
            </article>
          );
        })}
      </div>

      <section className="mt-6 rounded-lg border border-ink-100 bg-white p-5 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-ink-900">Risk Score Bands</h2>
            <p className="mt-1 text-sm text-ink-500">Rule-based score used by Compliance Intelligence.</p>
          </div>
          <Badge tone="neutral">0 to 100</Badge>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {riskBands.map(([level, range, detail]) => (
            <div key={level} className="rounded-lg bg-ink-50 p-4 ring-1 ring-ink-100">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-bold text-ink-900">{level}</p>
                <Badge>{range}</Badge>
              </div>
              <p className="mt-3 text-sm leading-6 text-ink-500">{detail}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
