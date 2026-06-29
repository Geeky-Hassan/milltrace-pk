import clsx from "clsx";
import { Check, Circle, X } from "lucide-react";
import { serialLifecycle } from "@/lib/demo-data";

export function SerialLifecycle({ status }: { status: string }) {
  const normalizedStatus = status.toLowerCase().replaceAll("_", " ");
  const activeIndex = serialLifecycle.findIndex((stage) => stage.toLowerCase() === normalizedStatus);
  const isVoided = normalizedStatus === "voided";

  return (
    <div className="rounded-lg border border-ink-100 bg-white p-5 shadow-soft">
      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        {serialLifecycle.map((stage, index) => {
          const complete = !isVoided && activeIndex >= index;
          const active = stage.toLowerCase() === normalizedStatus;
          return (
            <div key={stage} className="flex flex-1 items-center gap-3">
              <span
                className={clsx(
                  "grid h-9 w-9 shrink-0 place-items-center rounded-full ring-1 ring-inset",
                  complete ? "bg-emerald-600 text-white ring-emerald-600" : "bg-ink-50 text-ink-400 ring-ink-200",
                  active ? "shadow-soft" : "",
                )}
              >
                {complete ? <Check aria-hidden="true" className="h-4 w-4" /> : <Circle aria-hidden="true" className="h-3 w-3" />}
              </span>
              <div className="min-w-0">
                <p className={clsx("text-sm font-semibold", complete ? "text-ink-900" : "text-ink-500")}>{stage}</p>
                <div className={clsx("mt-1 h-1.5 rounded-full", complete ? "bg-emerald-500" : "bg-ink-100")} />
              </div>
            </div>
          );
        })}
        {isVoided ? (
          <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
            <X aria-hidden="true" className="h-4 w-4" />
            <span className="text-sm font-semibold">Serial voided and held</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
