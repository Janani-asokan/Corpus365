import type { ReactNode } from "react";
import type { SessionUser } from "@/server/auth/session";
import { DASHBOARD_NAV, ROLE_LABEL } from "@/lib/navigation";
import { DashboardNav } from "./dashboard-nav";

/** Signed-in area layout: role navigation beside the page content. */
export function DashboardShell({ user, children, banner }: { user: SessionUser; children: ReactNode; banner?: ReactNode }) {
  return (
    <div className="container-page grid grid-cols-1 gap-6 py-6 lg:grid-cols-[220px_1fr] lg:gap-10 lg:py-10">
      <aside className="no-print min-w-0 lg:sticky lg:top-24 lg:self-start">
        <div className="mb-4 hidden lg:block">
          <p className="eyebrow">{ROLE_LABEL[user.role]}</p>
          <p className="mt-1 truncate font-medium">{user.companyName ?? user.name}</p>
        </div>
        <DashboardNav items={DASHBOARD_NAV[user.role]} />
      </aside>
      <div className="min-w-0">
        {banner}
        {children}
      </div>
    </div>
  );
}
