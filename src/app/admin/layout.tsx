import { requireUser } from "@/server/auth/guards";
import { DashboardShell } from "@/components/layout/dashboard-shell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser(["admin"], "/admin");
  return <DashboardShell user={user}>{children}</DashboardShell>;
}
