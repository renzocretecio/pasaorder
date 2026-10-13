import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser, googleOAuthEnabled } from "@/lib/auth";
import { AuthPageShell } from "@/components/auth/auth-page-shell";

export const metadata: Metadata = { title: "Sign in | PasaOrder" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ oauth?: string }>;
}) {
  if (await currentUser()) redirect("/dashboard");
  const [{ oauth }, googleEnabled] = await Promise.all([
    searchParams,
    googleOAuthEnabled(),
  ]);
  return (
    <AuthPageShell
      mode="login"
      googleEnabled={googleEnabled}
      oauthError={oauth}
    />
  );
}
