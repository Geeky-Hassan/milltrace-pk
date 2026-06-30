import clsx from "clsx";

const toneClasses: Record<string, string> = {
  success: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  warning: "bg-amber-50 text-amber-700 ring-amber-200",
  danger: "bg-red-50 text-red-700 ring-red-200",
  neutral: "bg-stone-100 text-stone-700 ring-stone-200",
  blue: "bg-sky-50 text-sky-700 ring-sky-200",
};

export function statusTone(value: string) {
  const normalized = value.toLowerCase().replaceAll("_", " ");
  if (["accepted", "normal", "in stock", "confirmed", "delivered", "received", "warehoused", "resolved"].includes(normalized)) {
    return "success";
  }
  if (["warning", "pending", "pending qa", "under review", "in review", "in transit", "activated"].includes(normalized)) {
    return "warning";
  }
  if (["critical", "high", "blocked", "voided", "open", "invalid", "failed"].includes(normalized)) {
    return "danger";
  }
  if (["medium", "issued", "dispatched"].includes(normalized)) {
    return "blue";
  }
  return "neutral";
}

export function Badge({ children, tone, className }: { children: React.ReactNode; tone?: string; className?: string }) {
  const resolvedTone = tone ?? (typeof children === "string" ? statusTone(children) : "neutral");
  return (
    <span
      className={clsx(
        "inline-flex max-w-full items-center whitespace-normal break-words rounded-full px-2.5 py-1 text-left text-xs font-semibold leading-tight ring-1 ring-inset [overflow-wrap:anywhere]",
        toneClasses[resolvedTone] ?? toneClasses.neutral,
        className,
      )}
    >
      {children}
    </span>
  );
}
