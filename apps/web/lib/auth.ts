import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { AuthUser } from "@pasaorder/types";

export const SESSION_COOKIE = "pasaorder_session";
export const SESSION_MAX_AGE = 7 * 24 * 60 * 60;
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function authApi<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const base =
    process.env.API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://localhost:4000/api";
  let response: Response;
  try {
    response = await fetch(`${base.replace(/\/$/, "")}${path}`, {
      ...options,
      cache: "no-store",
      signal: options.signal ?? AbortSignal.timeout(10000),
    });
  } catch {
    throw new ApiError(
      503,
      "We couldn’t reach the server. Please try again shortly.",
    );
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const message =
      response.status >= 500
        ? "Something went wrong. Please try again shortly."
        : (body?.message ?? "Unable to complete this request.");
    throw new ApiError(response.status, message);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
export async function currentUser(): Promise<AuthUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const result = await authApi<{ user: AuthUser }>("/auth/me", {
      headers: { authorization: `Bearer ${token}` },
    });
    return result.user;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}
export async function requireUser() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}
