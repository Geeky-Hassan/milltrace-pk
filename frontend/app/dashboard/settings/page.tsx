"use client";

import { useEffect, useState } from "react";
import { Clock, Gauge, Link2, Settings, Warehouse } from "lucide-react";
import { Badge } from "@/components/Badge";
import { PageHeader } from "@/components/PageHeader";
import { StatePanel } from "@/components/StatePanel";
import { getComplianceSettings } from "@/lib/api";
import type { ComplianceSettings } from "@/types";

const cards = [
  { key: "expected_recovery_percentage", label: "Expected recovery", suffix: "%", icon: Gauge },
  { key: "activated_warehouse_limit_hours", label: "Warehouse time limit", suffix: " hours", icon: Warehouse },
  { key: "dispatch_receipt_limit_hours", label: "Buyer receipt limit", suffix: " hours", icon: Clock },
] as const;

export default function SettingsPage() {
  const [settings, setSettings] = useState<ComplianceSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getComplianceSettings()
      .then(setSettings)
      .catch((requestError) => setError(requestError instanceof Error ? requestError.message : "Settings could not load."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <PageHeader
        title="Settings"
        eyebrow="Compliance controls"
        description="Read-only demo settings used by the backend rules engine."
        icon={Settings}
        action={<Badge tone="neutral">MVP configuration</Badge>}
      />

      {loading ? <StatePanel type="loading" title="Loading compliance settings" /> : null}
      {error ? <StatePanel type="error" title="Settings unavailable" detail={error} /> : null}

      {settings ? (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            {cards.map((card) => {
              const Icon = card.icon;
              return (
                <article key={card.key} className="rounded-lg border border-ink-100 bg-white p-5 shadow-soft">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-ink-500">{card.label}</p>
                      <p className="mt-2 text-2xl font-bold text-ink-900">
                        {settings[card.key]}
                        {card.suffix}
                      </p>
                    </div>
                    <span className="rounded-md bg-emerald-50 p-2 text-compliance-green">
                      <Icon aria-hidden="true" className="h-4 w-4" />
                    </span>
                  </div>
                </article>
              );
            })}
          </div>

          <section className="mt-6 grid gap-6 xl:grid-cols-2">
            <article className="rounded-lg border border-ink-100 bg-white p-5 shadow-soft">
              <h2 className="text-base font-bold text-ink-900">Approved Warehouse Locations</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {settings.allowed_warehouse_locations.map((location) => (
                  <Badge key={location} tone="blue">
                    {location}
                  </Badge>
                ))}
              </div>
            </article>

            <article className="rounded-lg border border-ink-100 bg-white p-5 shadow-soft">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-md bg-ink-900 text-white">
                  <Link2 aria-hidden="true" className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="text-base font-bold text-ink-900">Future Blockchain Anchor</h2>
                  <p className="mt-2 text-sm leading-6 text-ink-500">
                    Audit events already form a hash chain. A periodic anchor hash can later be published to a blockchain or government notary service.
                  </p>
                  <p className="mt-3 font-mono text-xs text-ink-500">{settings.blockchain_anchor_hash ?? "not configured"}</p>
                </div>
              </div>
            </article>
          </section>
        </>
      ) : null}
    </>
  );
}
