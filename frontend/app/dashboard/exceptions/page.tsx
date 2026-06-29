"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, FileWarning, SearchCheck, XCircle } from "lucide-react";
import { Badge } from "@/components/Badge";
import { ConfirmModal } from "@/components/ConfirmModal";
import { PageHeader } from "@/components/PageHeader";
import { StatePanel } from "@/components/StatePanel";
import { TableFilters } from "@/components/TableFilters";
import { Toast, type ToastState } from "@/components/Toast";
import { getExceptions, resolveException } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { canMarkExceptionInReview, canResolveException } from "@/lib/roles";
import { matchesSearch, matchesValue, uniqueOptions } from "@/lib/table";
import { useDemoRole } from "@/lib/use-demo-role";
import type { ExceptionAlert } from "@/types";

const severityRank: Record<string, number> = { Critical: 4, High: 3, Medium: 2, Low: 1 };

type ReviewAction = {
  alert: ExceptionAlert;
  status: "IN_REVIEW" | "RESOLVED" | "DISMISSED";
} | null;

export default function ExceptionsPage() {
  const role = useDemoRole();
  const [alerts, setAlerts] = useState<ExceptionAlert[]>([]);
  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState("all");
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const [reviewAction, setReviewAction] = useState<ReviewAction>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getExceptions()
      .then(setAlerts)
      .catch((requestError) => setError(requestError instanceof Error ? requestError.message : "Exceptions could not load."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timeout = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const criticalCount = alerts.filter((alert) => alert.severity === "Critical" || alert.severity === "High").length;
  const severityOptions = uniqueOptions(alerts.map((alert) => alert.severity));
  const statusOptions = uniqueOptions(alerts.map((alert) => alert.status));
  const filteredAlerts = alerts
    .filter((alert) => matchesSearch(alert, search) && matchesValue(alert.severity, severity) && matchesValue(alert.status, status))
    .sort((a, b) => (severityRank[b.severity] ?? 0) - (severityRank[a.severity] ?? 0));

  async function handleReview(reason: string) {
    if (!reviewAction) {
      return;
    }
    try {
      setBusy(true);
      const updated = await resolveException(reviewAction.alert.id, reviewAction.status, reason);
      setAlerts((current) => current.map((alert) => (alert.id === updated.id ? updated : alert)));
      setToast({ tone: "success", message: `Exception marked ${reviewAction.status.replaceAll("_", " ").toLowerCase()}.` });
      setReviewAction(null);
    } catch (requestError) {
      setToast({ tone: "error", message: requestError instanceof Error ? requestError.message : "Exception action was rejected." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Exceptions / Red Flags"
        eyebrow="Compliance monitoring"
        description="System-detected issues across serial continuity, production variance, custody, dispatch, receipt, and manual override activity."
        icon={FileWarning}
        action={<Badge tone="danger">{criticalCount} high priority</Badge>}
      />

      <TableFilters
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search type, entity, action"
        filters={[
          {
            label: "Severity",
            value: severity,
            onChange: setSeverity,
            options: [{ label: "All severities", value: "all" }, ...severityOptions.map((value) => ({ label: value, value }))],
          },
          {
            label: "Status",
            value: status,
            onChange: setStatus,
            options: [{ label: "All statuses", value: "all" }, ...statusOptions.map((value) => ({ label: value, value }))],
          },
        ]}
      />

      {loading ? <StatePanel type="loading" title="Loading exceptions" /> : null}
      {error ? <StatePanel type="error" title="Exceptions unavailable" detail={error} /> : null}

      <div className="grid gap-4 xl:grid-cols-2">
        {!loading && !error && filteredAlerts.length === 0 ? (
          <StatePanel type="empty" title="No exceptions found" detail="No alert matches the selected filters." />
        ) : null}
        {!loading && !error ? filteredAlerts.map((alert) => (
          <article key={alert.id} className="rounded-lg border border-ink-100 bg-white p-5 shadow-soft">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>{alert.severity}</Badge>
                  <Badge tone="neutral">{alert.status}</Badge>
                  {alert.occurrence_count && alert.occurrence_count > 1 ? <Badge tone="warning">{alert.occurrence_count} linked</Badge> : null}
                </div>
                <h2 className="mt-3 text-base font-bold text-ink-900">{alert.title ?? alert.alert_type}</h2>
                <p className="mt-1 text-sm font-semibold text-ink-500">{alert.related_entity_type ?? "Entity"} / {alert.related_entity_id ?? alert.related_entity}</p>
              </div>
              <span className="grid h-10 w-10 place-items-center rounded-md bg-red-50 text-red-700">
                <AlertTriangle aria-hidden="true" className="h-5 w-5" />
              </span>
            </div>
            <p className="mt-4 text-sm leading-6 text-ink-600">{alert.description}</p>
            <div className="mt-4 rounded-lg bg-ink-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-ink-500">Suggested action</p>
              <p className="mt-2 text-sm leading-6 text-ink-700">{alert.suggested_action}</p>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs font-semibold text-ink-400">Detected {formatDateTime(alert.created_at ?? alert.detected_at)}</p>
              <div className="flex flex-wrap gap-2">
                {canMarkExceptionInReview(role) && alert.status !== "IN_REVIEW" && alert.status !== "RESOLVED" && alert.status !== "DISMISSED" ? (
                  <button type="button" onClick={() => setReviewAction({ alert, status: "IN_REVIEW" })} className="inline-flex h-9 items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 text-xs font-bold text-amber-700 transition hover:bg-amber-100">
                    <SearchCheck aria-hidden="true" className="h-3.5 w-3.5" />
                    In review
                  </button>
                ) : null}
                {canResolveException(role) && alert.status !== "RESOLVED" && alert.status !== "DISMISSED" ? (
                  <>
                    <button type="button" onClick={() => setReviewAction({ alert, status: "RESOLVED" })} className="inline-flex h-9 items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100">
                      <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" />
                      Resolve
                    </button>
                    <button type="button" onClick={() => setReviewAction({ alert, status: "DISMISSED" })} className="inline-flex h-9 items-center gap-2 rounded-md border border-ink-200 bg-white px-3 text-xs font-bold text-ink-600 transition hover:bg-ink-50">
                      <XCircle aria-hidden="true" className="h-3.5 w-3.5" />
                      Dismiss
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          </article>
        )) : null}
      </div>

      <ConfirmModal
        open={Boolean(reviewAction)}
        title={reviewAction ? `${reviewAction.status.replaceAll("_", " ")} exception?` : "Review exception"}
        description="This action is written to the tamper-evident audit log and cannot be edited from the UI."
        confirmLabel={reviewAction ? reviewAction.status.replaceAll("_", " ") : "Confirm"}
        requireReason
        busy={busy}
        onCancel={() => setReviewAction(null)}
        onConfirm={handleReview}
      />
      <Toast toast={toast} />
    </>
  );
}
