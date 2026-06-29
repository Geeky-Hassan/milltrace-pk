import { CheckCircle2, XCircle } from "lucide-react";

export type ToastState = {
  tone: "success" | "error";
  message: string;
} | null;

export function Toast({ toast }: { toast: ToastState }) {
  if (!toast) {
    return null;
  }

  const Icon = toast.tone === "success" ? CheckCircle2 : XCircle;

  return (
    <div className="fixed bottom-5 right-5 z-50 max-w-sm rounded-lg border border-ink-100 bg-white p-4 shadow-soft">
      <div className="flex items-start gap-3">
        <Icon aria-hidden="true" className={toast.tone === "success" ? "h-5 w-5 text-compliance-green" : "h-5 w-5 text-red-700"} />
        <p className="text-sm font-semibold text-ink-800">{toast.message}</p>
      </div>
    </div>
  );
}
