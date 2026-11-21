import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, HOME_FOR_ROLE } from "@/server/auth/guards";
import { readReferralCode } from "@/server/referral";
import { findApprovedPartnerByCode } from "@/server/services/partner.service";
import { getUser } from "@/server/services/user.service";
import { safeNextPath } from "@/lib/validation";
import { AuthCard } from "@/components/layout/auth-card";
import { ClientSignupForm } from "@/components/forms/auth-forms";

export const metadata: Metadata = { title: "Create a business account" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const user = await getCurrentUser();
  if (user) redirect(safeNextPath(next, HOME_FOR_ROLE[user.role]));

  const code = await readReferralCode();
  const partner = code ? findApprovedPartnerByCode(code) : null;
  const partnerUser = partner ? getUser(partner.userId) : null;

  return (
    <AuthCard
      wide
      title="Create your business account"
      description={
        partnerUser
          ? <>You were referred by <span className="font-medium text-ink">{partnerUser.name}</span>, your local Corpus365 partner.</>
          : "Start free trials, subscribe to apps and manage your invoices in one place."
      }
      footer={
        <>
          Already have an account? <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"} className="font-medium text-brand hover:underline">Sign in</Link>
          {" · "}
          Want to sell Corpus365? <Link href="/partners/apply" className="font-medium text-brand hover:underline">Apply as a partner</Link>
        </>
      }
    >
      <ClientSignupForm next={next ? safeNextPath(next) : undefined} />
    </AuthCard>
  );
}
