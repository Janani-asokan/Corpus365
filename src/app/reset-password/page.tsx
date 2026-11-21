import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/layout/auth-card";
import { ResetPasswordForm } from "@/components/forms/auth-forms";
import { Alert } from "@/components/ui/alert";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <AuthCard title="Choose a new password" footer={<Link href="/login" className="font-medium text-brand hover:underline">Back to sign in</Link>}>
      {token ? (
        <ResetPasswordForm token={token} />
      ) : (
        <Alert tone="danger">This link is incomplete. <Link href="/forgot-password" className="underline">Request a new reset link</Link>.</Alert>
      )}
    </AuthCard>
  );
}
