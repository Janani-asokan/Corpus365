import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, HOME_FOR_ROLE } from "@/server/auth/guards";
import { safeNextPath } from "@/lib/validation";
import { AuthCard } from "@/components/layout/auth-card";
import { LoginForm } from "@/components/forms/auth-forms";
import { Alert } from "@/components/ui/alert";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; reset?: string }> }) {
  const { next, reset } = await searchParams;
  const user = await getCurrentUser();
  if (user) redirect(safeNextPath(next, HOME_FOR_ROLE[user.role]));

  return (
    <AuthCard
      title="Welcome back"
      description="Sign in to your business account or partner portal."
      footer={
        <>
          New to Corpus365? <Link href={next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"} className="font-medium text-brand hover:underline">Create a business account</Link>
          {" · "}
          <Link href="/partners/apply" className="font-medium text-brand hover:underline">Apply as a partner</Link>
        </>
      }
    >
      {reset && <Alert tone="success" className="mb-5">Password updated. Sign in with your new password.</Alert>}
      <LoginForm next={next ? safeNextPath(next) : undefined} />
    </AuthCard>
  );
}
