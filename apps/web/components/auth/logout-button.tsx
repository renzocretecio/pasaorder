"use client";
import { Button } from "@/components/ui/button";
import { useActionState } from "react";
import { logout, type AuthState } from "@/app/(auth)/actions";
export function LogoutButton() {
  const [state, action, pending] = useActionState<AuthState>(logout, {});
  return (
    <form action={action}>
      <Button variant="outline" disabled={pending} className="h-11 w-full">
        {pending ? "Signing out…" : "Sign out"}
      </Button>
      {state.message && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {state.message}
        </p>
      )}
    </form>
  );
}
