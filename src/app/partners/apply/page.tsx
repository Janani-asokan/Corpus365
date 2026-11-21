import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, HOME_FOR_ROLE } from "@/server/auth/guards";
import { AuthCard } from "@/components/layout/auth-card";
import { PartnerApplicationForm } from "@/components/forms/auth-forms";

export const metadata: Metadata = { title: "Apply as a Channel Partner" };

export default async function PartnerApplyPage() {
  const user = await getCurrentUser();
  if (user) redirect(HOME_FOR_ROLE[user.role]);

  return (
    <AuthCard
      wide
      title="Apply to become a Channel Partner"
      description="Free to join — no fees, no starter kit. We review applications within a few working days."
      footer={<>Already a partner? <Link href="/login" className="font-medium text-brand hover:underline">Sign in</Link></>}
    >
      <PartnerApplicationForm />
    </AuthCard>
  );
}
