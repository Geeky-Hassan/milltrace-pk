import clsx from "clsx";
import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { Tone } from "@/types";

const toneStyles: Record<Tone, { border: string; text: string; bg: string }> = {
  success: { border: "border-emerald-200", text: "text-emerald-700", bg: "bg-emerald-50" },
  warning: { border: "border-amber-200", text: "text-amber-700", bg: "bg-amber-50" },
  danger: { border: "border-red-200", text: "text-red-700", bg: "bg-red-50" },
  neutral: { border: "border-ink-100", text: "text-ink-500", bg: "bg-ink-50" },
};

export function DashboardCard({
  label,
  value,
  delta,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string;
  delta: string;
  tone: Tone;
  icon?: LucideIcon;
}) {
  const DeltaIcon = tone === "success" ? ArrowUpRight : tone === "danger" ? ArrowDownRight : Minus;
  return (
    <article className={clsx("rounded-lg border bg-white p-4 shadow-soft", toneStyles[tone].border)}>
      <div className="flex items-start justify-between gap-3">
        <p className="max-w-[13rem] text-sm font-medium text-ink-500">{label}</p>
        {Icon ? (
          <span className={clsx("rounded-md p-2", toneStyles[tone].bg, toneStyles[tone].text)}>
            <Icon aria-hidden="true" className="h-4 w-4" />
          </span>
        ) : null}
      </div>
      <p className="mt-4 text-2xl font-bold text-ink-900">{value}</p>
      <div className={clsx("mt-3 flex items-center gap-1.5 text-xs font-semibold", toneStyles[tone].text)}>
        <DeltaIcon aria-hidden="true" className="h-3.5 w-3.5" />
        <span>{delta}</span>
      </div>
    </article>
  );
}

