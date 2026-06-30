"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Menu, ShieldCheck } from "lucide-react";
import { demoLogin } from "@/lib/api";
import { navItems, roleDescriptions, roleIcons, roleLabels } from "@/lib/roles";
import { setStoredAuth, useDemoRole } from "@/lib/use-demo-role";
import type { RoleCode } from "@/types";

const roles = Object.keys(roleLabels) as RoleCode[];

export function AppShell({ children }: { children: React.ReactNode }) {
  const role = useDemoRole();
  const pathname = usePathname();
  const router = useRouter();
  const RoleIcon = roleIcons[role];
  const visibleNav = navItems.filter((item) => item.roles.includes(role));

  async function handleRoleChange(nextRole: RoleCode) {
    const session = await demoLogin(nextRole);
    setStoredAuth(nextRole, session.token);
  }

  return (
    <div className="min-h-screen bg-ink-50">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 flex-col border-r border-ink-100 bg-white px-4 py-5 lg:flex">
        <Link href="/dashboard" className="flex shrink-0 items-center gap-3 rounded-lg px-2 py-2">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-ink-900 text-white">
            <ShieldCheck aria-hidden="true" className="h-5 w-5" />
          </span>
          <span>
            <span className="block text-base font-bold text-ink-900">MillTrace PK</span>
            <span className="block text-xs font-medium text-ink-500">Serial compliance MVP</span>
          </span>
        </Link>

        <div className="mt-6 shrink-0 rounded-lg border border-ink-100 bg-ink-50 p-3">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-md bg-white text-compliance-green ring-1 ring-ink-100">
              <RoleIcon aria-hidden="true" className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-ink-900">{roleLabels[role]}</p>
              <p className="truncate text-xs text-ink-500">Mehrab Sugar Mills</p>
            </div>
          </div>
          <p className="mt-3 text-xs leading-5 text-ink-500">{roleDescriptions[role]}</p>
        </div>

        <nav className="mt-6 min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
          {visibleNav.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-semibold transition",
                  active ? "bg-emerald-50 text-compliance-green" : "text-ink-600 hover:bg-ink-50 hover:text-ink-900",
                )}
              >
                <Icon aria-hidden="true" className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-30 border-b border-ink-100 bg-white/90 backdrop-blur">
          <div className="flex min-h-16 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3 lg:hidden">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-ink-900 text-white">
                <Menu aria-hidden="true" className="h-5 w-5" />
              </span>
              <span className="font-bold text-ink-900">MillTrace PK</span>
            </div>

            <div className="hidden min-w-0 lg:block">
              <p className="text-sm font-semibold text-ink-900">Mehrab Sugar Mills</p>
              <p className="text-xs text-ink-500">Rahim Yar Khan, Punjab - NTN 7394821-6</p>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <select
                aria-label="Demo role"
                className="h-10 rounded-md border border-ink-200 bg-white px-3 text-sm font-semibold text-ink-700 outline-none transition focus:border-compliance-green focus:ring-2 focus:ring-emerald-100"
                value={role}
                onChange={(event) => void handleRoleChange(event.target.value as RoleCode)}
              >
                {roles.map((roleCode) => (
                  <option key={roleCode} value={roleCode}>
                    {roleLabels[roleCode]}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="grid h-10 w-10 place-items-center rounded-md border border-ink-200 bg-white text-ink-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                aria-label="Return to login"
                onClick={() => router.push("/")}
              >
                <LogOut aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto border-t border-ink-100 px-4 py-2 lg:hidden">
            {visibleNav.map((item) => {
              const active = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    "flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-xs font-bold",
                    active ? "bg-emerald-50 text-compliance-green" : "bg-white text-ink-600",
                  )}
                >
                  <Icon aria-hidden="true" className="h-3.5 w-3.5" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </header>

        <main className="px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
