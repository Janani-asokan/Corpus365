import { requireUser } from "@/server/auth/guards";
import { getPartnerProfile } from "@/server/services/partner.service";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Alert } from "@/components/ui/alert";
import { config } from "@/lib/config";

export default async function PartnerLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser(["partner"], "/partner");
  const profile = await getPartnerProfile(user.id);

  const banner =
    profile?.status === "pending" ? (
      <Alert tone="info" title="Your application is under review" className="mb-6">
        We usually review applications within a few working days. Meanwhile you can explore the portal and training. Your referral link activates once you’re approved.
      </Alert>
    ) : profile?.status === "rejected" ? (
      <Alert tone="danger" title="Application not approved" className="mb-6">
        {profile.reviewNote ?? "We couldn’t approve your application this time."} Questions? Email {config.supportEmail}.
      </Alert>
    ) : profile?.status === "suspended" ? (
      <Alert tone="danger" title="Account suspended" className="mb-6">
        Your referral link is paused. Please contact {config.supportEmail}.
      </Alert>
    ) : null;

  return <DashboardShell user={user} banner={banner}>{children}</DashboardShell>;
}
