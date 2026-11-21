import { requireUser } from "@/server/auth/guards";
import { DashboardShell } from "@/components/layout/dashboard-shell";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser(undefined, "/settings");
  return <DashboardShell user={user}>{children}</DashboardShell>;
}
