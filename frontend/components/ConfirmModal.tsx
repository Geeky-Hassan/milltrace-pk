"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";

export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel,
  reasonLabel = "Reason",
  requireReason = false,
  busy = false,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  reasonLabel?: string;
  requireReason?: boolean;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");

  if (!open) {
    return null;
  }

  const disabled = busy || (requireReason && reason.trim().length < 4);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink-900/45 px-4">
      <div className="w-full max-w-lg rounded-lg border border-ink-100 bg-white p-5 shadow-soft">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-red-50 text-red-700">
            <AlertTriangle aria-hidden="true" className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-bold text-ink-900">{title}</h2>
            <p className="mt-1 text-sm leading-6 text-ink-500">{description}</p>
          </div>
        </div>

        <label className="mt-5 grid gap-1.5 text-sm font-semibold text-ink-700">
          {reasonLabel}
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={4}
            className="resize-none rounded-md border border-ink-200 px-3 py-2 text-sm outline-none transition focus:border-compliance-green focus:ring-2 focus:ring-emerald-100"
            placeholder="Add a short audit reason"
          />
        </label>

        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => {
              setReason("");
              onCancel();
            }}
            className="h-10 rounded-md border border-ink-200 bg-white px-4 text-sm font-bold text-ink-600 transition hover:bg-ink-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              onConfirm(reason.trim());
              setReason("");
            }}
            className="h-10 rounded-md bg-ink-900 px-4 text-sm font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-ink-300"
          >
            {busy ? "Working..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
