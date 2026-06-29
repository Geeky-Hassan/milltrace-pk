import type { LucideIcon } from "lucide-react";

export function PageHeader({
  title,
  eyebrow,
  description,
  icon: Icon,
  action,
}: {
  title: string;
  eyebrow?: string;
  description?: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? <p className="text-xs font-bold uppercase tracking-wide text-compliance-green">{eyebrow}</p> : null}
        <div className="mt-1 flex items-center gap-3">
          {Icon ? (
            <span className="rounded-md bg-emerald-50 p-2 text-compliance-green ring-1 ring-emerald-100">
              <Icon aria-hidden="true" className="h-5 w-5" />
            </span>
          ) : null}
          <h1 className="truncate text-2xl font-bold text-ink-900">{title}</h1>
        </div>
        {description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-500">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

