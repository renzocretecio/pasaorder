import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { AuthPageShell } from "@/components/auth/auth-page-shell";

export const metadata: Metadata = { title: "Sign in | PasaOrder" };

export default async function Page() {
  if (await currentUser()) redirect("/dashboard");
  return <AuthPageShell mode="login" />;
}
