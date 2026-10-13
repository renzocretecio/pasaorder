"use client";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useActionState, useState } from "react";
import { login, register, type AuthState } from "@/app/(auth)/actions";
function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48" className="size-5 shrink-0">
      <path
        fill="#4285F4"
        d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.6c3.9-3.6 6.1-8.8 6.1-15Z"
      />
      <path
        fill="#34A853"
        d="M24 44c5.6 0 10.3-1.9 13.7-5.1l-6.6-5.1c-1.8 1.2-4.1 2-7.1 2-5.4 0-10-3.6-11.6-8.5H5.6v5.3A20 20 0 0 0 24 44Z"
      />
      <path
        fill="#FBBC05"
        d="M12.4 27.3a12 12 0 0 1 0-7.6v-5.3H5.6a20 20 0 0 0 0 18.2l6.8-5.3Z"
      />
      <path
        fill="#EA4335"
        d="M24 11.2c3 0 5.7 1 7.8 3.1l5.9-5.9C34.3 5.1 29.6 3 24 3A20 20 0 0 0 5.6 14.4l6.8 5.3c1.6-4.9 6.2-8.5 11.6-8.5Z"
      />
    </svg>
  );
}

export function AuthForm({
  mode,
  googleEnabled = false,
}: {
  mode: "login" | "register";
  googleEnabled?: boolean;
}) {
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
      {googleEnabled && (
        <>
          <Button
            asChild
            variant="outline"
            className="h-12 w-full rounded-[10px] border-auth-input bg-white text-foreground shadow-none hover:bg-white/70"
          >
            <Link
              prefetch={false}
              href={`/api/auth/google/start?flow=${signingUp ? "register" : "login"}`}
            >
              <GoogleMark />
              {signingUp ? "Sign up with Google" : "Sign in with Google"}
            </Link>
          </Button>
          <div className="my-6 flex items-center gap-4" aria-hidden="true">
            <span className="h-px flex-1 bg-primary/15" />
            <span className="text-xs text-muted-foreground">or use email</span>
            <span className="h-px flex-1 bg-primary/15" />
          </div>
        </>
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
