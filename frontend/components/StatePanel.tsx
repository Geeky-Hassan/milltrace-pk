import { AlertTriangle, Inbox, Loader2 } from "lucide-react";

type StatePanelProps = {
  type: "loading" | "error" | "empty";
  title: string;
  detail?: string;
};

export function StatePanel({ type, title, detail }: StatePanelProps) {
  const Icon = type === "loading" ? Loader2 : type === "error" ? AlertTriangle : Inbox;
  const tone =
    type === "error"
      ? "border-red-100 bg-red-50 text-red-700"
      : type === "loading"
        ? "border-emerald-100 bg-emerald-50 text-compliance-green"
        : "border-ink-100 bg-white text-ink-500";

  return (
    <div className={`rounded-lg border p-5 shadow-soft ${tone}`}>
      <div className="flex items-start gap-3">
        <Icon aria-hidden="true" className={`mt-0.5 h-5 w-5 ${type === "loading" ? "animate-spin" : ""}`} />
        <div>
          <p className="font-bold">{title}</p>
          {detail ? <p className="mt-1 text-sm leading-6 text-ink-500">{detail}</p> : null}
        </div>
      </div>
    </div>
  );
}
