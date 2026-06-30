"use client";

import { AlertTriangle, Calculator, Factory, PackageCheck, ReceiptText, Scale, ShieldCheck, Truck } from "lucide-react";
import { Badge } from "@/components/Badge";
import { PageHeader } from "@/components/PageHeader";

const formulaCards = [
  {
    title: "Cane Intake Net Weight",
    icon: Scale,
    formula: "Net cane = gross weight - tare weight",
    rule: "Gross and tare are entered in tons. The backend stores kg for precise calculations.",
    threshold: "Reject if gross <= tare, gross <= 0, tare <= 0, or duplicate vehicle appears inside 20 minutes.",
  },
  {
    title: "Expected Sugar Output",
    icon: Factory,
    formula: "Expected sugar = cane input x expected recovery %",
    rule: "Default expected recovery is 10.5% unless mill settings are changed.",
    threshold: "Output below 8.0% requires downtime explanation. Output above 14.5% is physically suspicious.",
  },
  {
    title: "Recovery Variance",
    icon: AlertTriangle,
    formula: "Variance % = (actual - expected) / expected x 100",
    rule: "Normal: within +/-3%. Warning: over 3% and up to 7%. Critical: over 7%.",
    threshold: "Warning and Critical variance create compliance exceptions.",
  },
  {
    title: "Packaging Bags",
    icon: PackageCheck,
    formula: "50 kg bags = floor(actual sugar output kg / 50)",
    rule: "Bag weight is fixed at 50 kg in this MVP. Operators choose batch and line only.",
    threshold: "Only generated serials are ISSUED. Bags without issued serials should not enter stock.",
  },
  {
    title: "Serial Lifecycle",
    icon: ShieldCheck,
    formula: "ISSUED -> ACTIVATED -> WAREHOUSED -> DISPATCHED -> RECEIVED",
    rule: "Serials can only move forward. VOIDED requires reason and supervisor approval.",
    threshold: "Invalid transitions, gaps, duplicates, and out-of-order activation create exceptions.",
  },
  {
    title: "Warehouse SLA",
    icon: PackageCheck,
    formula: "Activated serials must be warehoused within 24 hours",
    rule: "Warehouse stock is calculated from serial-level receipt records.",
    threshold: "Activated but not warehoused after 24 hours is a high-risk leakage alert.",
  },
  {
    title: "Dispatch Validation",
    icon: Truck,
    formula: "Dispatch quantity = scanned serial count",
    rule: "Only WAREHOUSED serials can be dispatched. Demo invoices are auto-generated.",
    threshold: "Invalid serials or quantity mismatch create exceptions. Future e-invoice integration will replace demo invoice generation.",
  },
  {
    title: "Buyer Receipt",
    icon: ReceiptText,
    formula: "Received serials must match dispatch serials and buyer",
    rule: "Shortage, extra serials, wrong buyer, or duplicate receipt are flagged.",
    threshold: "Receipt missing after 48 hours increases risk score.",
  },
];

const riskBands = [
  ["Low", "0-30", "Healthy flow with no major open exceptions"],
  ["Medium", "31-60", "Some unresolved controls need review"],
  ["High", "61-80", "Multiple weak signals or serious exception age"],
  ["Critical", "81-100", "Critical exceptions or connected fraud-chain risk"],
];

export default function FormulasPage() {
  return (
    <>
      <PageHeader
        title="Rules & Formulas"
        eyebrow="Compliance logic"
        description="The MVP calculations and thresholds used for traceability, stock control, and exception detection."
        icon={Calculator}
        action={<Badge tone="blue">Demo configuration</Badge>}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {formulaCards.map((item) => {
          const Icon = item.icon;
          return (
            <article key={item.title} className="rounded-lg border border-ink-100 bg-white p-5 shadow-soft">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-emerald-50 text-compliance-green ring-1 ring-emerald-100">
                  <Icon aria-hidden="true" className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-sm font-bold text-ink-900">{item.title}</h2>
                  <p className="mt-2 break-words rounded-md bg-ink-50 px-3 py-2 text-xs font-bold text-ink-700 ring-1 ring-ink-100">
                    {item.formula}
                  </p>
                </div>
              </div>
              <p className="mt-4 text-sm leading-6 text-ink-600">{item.rule}</p>
              <p className="mt-3 text-xs leading-5 text-ink-500">{item.threshold}</p>
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
        <div className="mt-5 grid gap-3 md:grid-cols-4">
          {riskBands.map(([level, range, detail]) => (
            <div key={level} className="rounded-lg bg-ink-50 p-4 ring-1 ring-ink-100">
              <div className="flex items-center justify-between gap-3">
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
