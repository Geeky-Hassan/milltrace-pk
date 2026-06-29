"use client";

import { useRouter } from "next/navigation";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { demoLogin } from "@/lib/api";
import { roleDescriptions, roleIcons, roleLabels } from "@/lib/roles";
import { setStoredAuth } from "@/lib/use-demo-role";
import type { RoleCode } from "@/types";

const roles = Object.keys(roleLabels) as RoleCode[];

export default function LoginPage() {
  const router = useRouter();

  async function handleLogin(role: RoleCode) {
    const session = await demoLogin(role);
    setStoredAuth(role, session.token);
    router.push("/dashboard");
  }

  return (
    <main className="min-h-screen bg-ink-50">
      <section className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
        <div className="flex items-center px-6 py-10 sm:px-10 lg:px-16">
          <div className="w-full max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-compliance-green shadow-soft">
              <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5" />
              Compliance traceability MVP
            </div>
            <h1 className="mt-6 max-w-2xl text-4xl font-bold text-ink-900 sm:text-5xl">MillTrace PK</h1>
            <p className="mt-4 max-w-xl text-lg leading-8 text-ink-600">
              Trace sugar from cane intake to warehouse dispatch with serial-level compliance.
            </p>

            <div className="mt-9 grid gap-3 sm:grid-cols-2">
              {roles.map((role) => {
                const Icon = roleIcons[role];
                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() => handleLogin(role)}
                    className="group flex min-h-24 items-center justify-between gap-4 rounded-lg border border-ink-100 bg-white p-4 text-left shadow-soft transition hover:-translate-y-0.5 hover:border-emerald-200 hover:bg-emerald-50/40"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-ink-900 text-white transition group-hover:bg-compliance-green">
                        <Icon aria-hidden="true" className="h-5 w-5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-bold text-ink-900">{roleLabels[role]}</span>
                        <span className="mt-1 line-clamp-2 block text-xs leading-5 text-ink-500">{roleDescriptions[role]}</span>
                      </span>
                    </span>
                    <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0 text-ink-400 transition group-hover:text-compliance-green" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="relative hidden overflow-hidden bg-ink-900 p-10 text-white lg:block">
          <div className="absolute inset-0 bg-[linear-gradient(140deg,rgba(255,255,255,0.10),transparent_48%)]" />
          <div className="relative flex h-full flex-col justify-between">
            <div className="rounded-lg border border-white/10 bg-white/8 p-5 backdrop-blur">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-white/75">Today flow</span>
                <span className="rounded-full bg-emerald-400/15 px-2.5 py-1 text-xs font-bold text-emerald-200">Live demo</span>
              </div>
              <div className="mt-6 space-y-4">
                {[
                  ["Cane intake", "60.2 tons", "91%"],
                  ["Production", "17.8 tons", "72%"],
                  ["Warehouse", "14.5 tons", "64%"],
                  ["Dispatch", "5.9 tons", "32%"],
                ].map(([label, value, width]) => (
                  <div key={label}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-white/72">{label}</span>
                      <span className="font-bold">{value}</span>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-white/10">
                      <div className="h-2 rounded-full bg-emerald-300" style={{ width }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-4">
              <div className="rounded-lg border border-white/10 bg-white/8 p-5 backdrop-blur">
                <p className="text-sm font-semibold text-white/70">Exception focus</p>
                <p className="mt-3 text-3xl font-bold">4</p>
                <p className="mt-1 text-sm text-white/60">High or critical items awaiting review</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border border-white/10 bg-white/8 p-4 backdrop-blur">
                  <p className="text-xs font-semibold text-white/60">Active serials</p>
                  <p className="mt-2 text-2xl font-bold">4</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/8 p-4 backdrop-blur">
                  <p className="text-xs font-semibold text-white/60">Recovery</p>
                  <p className="mt-2 text-2xl font-bold">10.3%</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
