import type { Metadata } from "next";
import { requireUser } from "@/server/auth/guards";
import { getPartnerProfile } from "@/server/services/partner.service";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { PasswordForm, PayoutForm, ProfileForm } from "@/components/forms/settings-forms";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser();
  const profile = user.role === "partner" ? getPartnerProfile(user.id) : null;

  return (
    <>
      <PageHeader title="Settings" description="Your profile and sign-in details." />
      <div className="space-y-6">
        <Card>
          <CardHeader title="Profile" />
          <div className="p-5"><ProfileForm defaults={user} showCompany={user.role === "client"} /></div>
        </Card>
        {profile && (
          <Card>
            <CardHeader title="Payout details" description="Where we send your monthly commission." />
            <div className="p-5"><PayoutForm upi={profile.payoutUpi} /></div>
          </Card>
        )}
        <Card>
          <CardHeader title="Password" />
          <div className="p-5"><PasswordForm /></div>
        </Card>
      </div>
    </>
  );
}
