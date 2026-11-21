import { requireUser } from "@/server/auth/guards";
import { DashboardShell } from "@/components/layout/dashboard-shell";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser(["client"], "/account");
  return <DashboardShell user={user}>{children}</DashboardShell>;
}
