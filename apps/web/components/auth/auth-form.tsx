"use client";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useActionState, useState } from "react";
import { login, register, type AuthState } from "@/app/(auth)/actions";
export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const signingUp = mode === "register";
  const [state, action, pending] = useActionState<AuthState, FormData>(
    signingUp ? register : login,
    {},
  );
  const [showPassword, setShowPassword] = useState(false);
  const error = (field: string) => state.errors?.[field]?.[0];
  return (
    <form action={action} className="mt-8" aria-busy={pending}>
      {state.message && (
        <Alert variant="destructive" className="mb-5">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}
      <fieldset disabled={pending} className="space-y-5 disabled:opacity-70">
        {signingUp && (
          <div className="space-y-2">
            <Label className="text-[13px] leading-[1.4]" htmlFor="name">
              Your name
            </Label>
            <Input
              className="h-12 rounded-[10px] border-auth-input bg-white shadow-none caret-primary"
              id="name"
              name="name"
              autoComplete="name"
              placeholder="Juan Dela Cruz"
              required
              minLength={2}
              maxLength={120}
              defaultValue={state.values?.name}
              aria-invalid={!!error("name")}
              aria-describedby={error("name") ? "name-error" : undefined}
            />
            {error("name") && (
              <p id="name-error" className="text-sm text-destructive">
                {error("name")}
              </p>
            )}
          </div>
        )}
        <div className="space-y-2">
          <Label className="text-[13px] leading-[1.4]" htmlFor="email">
            Email address
          </Label>
          <Input
            className="h-12 rounded-[10px] border-auth-input bg-white shadow-none caret-primary"
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            required
            maxLength={255}
            defaultValue={state.values?.email}
            aria-invalid={!!error("email")}
            aria-describedby={error("email") ? "email-error" : undefined}
          />
          {error("email") && (
            <p id="email-error" className="text-sm text-destructive">
              {error("email")}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label className="text-[13px] leading-[1.4]" htmlFor="password">
            Password
          </Label>
          <div className="relative">
            <Input
              className="h-12 rounded-[10px] border-auth-input bg-white pr-20 shadow-none caret-primary"
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete={signingUp ? "new-password" : "current-password"}
              required
              minLength={8}
              aria-invalid={!!error("password")}
              aria-describedby={
                error("password")
                  ? "password-error"
                  : signingUp
                    ? "password-hint"
                    : undefined
              }
            />
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-0.5 top-0.5 h-11 min-w-15 rounded-lg"
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
            >
              {showPassword ? "Hide" : "Show"}
            </Button>
          </div>
          {error("password") ? (
            <p id="password-error" className="text-sm text-destructive">
              {error("password")}
            </p>
          ) : (
            signingUp && (
              <p id="password-hint" className="text-sm text-muted-foreground">
                At least 8 characters.
              </p>
            )
          )}
        </div>
        {signingUp && (
          <div className="space-y-2">
            <Label
              className="text-[13px] leading-[1.4]"
              htmlFor="confirmPassword"
            >
              Confirm password
            </Label>
            <Input
              className="h-12 rounded-[10px] border-auth-input bg-white shadow-none caret-primary"
              id="confirmPassword"
              name="confirmPassword"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              minLength={8}
              aria-invalid={!!error("confirmPassword")}
              aria-describedby={
                error("confirmPassword") ? "confirm-error" : undefined
              }
            />
            {error("confirmPassword") && (
              <p id="confirm-error" className="text-sm text-destructive">
                {error("confirmPassword")}
              </p>
            )}
          </div>
        )}
        <Button
          className="mt-2 h-13 w-full justify-between rounded-xl active:bg-auth-forest motion-reduce:transition-none"
          type="submit"
        >
          {pending
            ? signingUp
              ? "Creating your account…"
              : "Signing in…"
            : signingUp
              ? "Create account"
              : "Sign in"}
          <ArrowRight aria-hidden="true" />
        </Button>
      </fieldset>
      <p className="mt-6 text-center text-sm leading-relaxed text-muted-foreground">
        {signingUp ? "Already have an account?" : "New to PasaOrder?"}{" "}
        <Link
          className="font-semibold text-primary underline-offset-4 hover:underline"
          href={signingUp ? "/login" : "/register"}
        >
          {signingUp ? "Sign in" : "Create an account"}
        </Link>
      </p>
    </form>
  );
}
