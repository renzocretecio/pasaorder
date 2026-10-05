"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { loginSchema, registerSchema } from "@pasaorder/validation";
import type { AuthResponse } from "@pasaorder/types";
import { ApiError, authApi, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/auth";
export type AuthState = {
  message?: string;
  errors?: Record<string, string[]>;
  values?: { name?: string; email?: string };
};
async function authenticate(
  mode: "login" | "register",
  formData: FormData,
): Promise<AuthState> {
  const name = String(formData.get("name") ?? "");
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const parsed = (mode === "register" ? registerSchema : loginSchema).safeParse(
    { name, email, password },
  );
  const values = { name, email };
  if (!parsed.success) {
    const errors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues)
      (errors[String(issue.path[0])] ??= []).push(issue.message);
    return { errors, values };
  }
  if (mode === "register" && password !== formData.get("confirmPassword"))
    return { errors: { confirmPassword: ["Passwords don’t match."] }, values };
  let result: AuthResponse;
  try {
    result = await authApi<AuthResponse>(`/auth/${mode}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(parsed.data),
    });
  } catch (error) {
    return {
      message:
        error instanceof ApiError
          ? error.message
          : "Unable to sign in. Please try again.",
      values,
    };
  }
  (await cookies()).set(SESSION_COOKIE, result.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  redirect("/dashboard");
}
export async function login(_previous: AuthState, formData: FormData) {
  return authenticate("login", formData);
}
export async function register(_previous: AuthState, formData: FormData) {
  return authenticate("register", formData);
}
export async function logout(): Promise<AuthState> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    try {
      await authApi<void>("/auth/logout", {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
      });
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 401))
        return { message: "Couldn’t sign out. Please try again." };
    }
  }
  store.delete(SESSION_COOKIE);
  redirect("/login");
}
