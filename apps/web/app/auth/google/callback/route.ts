import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { ApiError, authApi, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/auth";

const STATE_COOKIE = "pasaorder_google_state";
const FLOW_COOKIE = "pasaorder_google_flow";
const COOKIE_PATH = "/auth/google";

function returnPath(flow: string | undefined) {
  return flow === "register" ? "/register" : "/login";
}

function redirectWithOutcome(
  request: NextRequest,
  flow: string | undefined,
  outcome: string,
) {
  const target = new URL(returnPath(flow), request.url);
  target.searchParams.set("oauth", outcome);
  const response = NextResponse.redirect(target);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  clearFlowCookies(response);
  return response;
}

function clearFlowCookies(response: NextResponse) {
  for (const name of [STATE_COOKIE, FLOW_COOKIE])
    response.cookies.set(name, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: COOKIE_PATH,
      maxAge: 0,
    });
}

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const expectedState = cookieStore.get(STATE_COOKIE)?.value;
  const flow = cookieStore.get(FLOW_COOKIE)?.value;
  const state = request.nextUrl.searchParams.get("state") ?? "";
  const outcome = request.nextUrl.searchParams.get("outcome");
  const code = request.nextUrl.searchParams.get("code") ?? "";

  const stateMatches =
    expectedState &&
    /^[a-f0-9]{64}$/.test(state) &&
    /^[a-f0-9]{64}$/.test(expectedState) &&
    timingSafeEqual(Buffer.from(state), Buffer.from(expectedState));
  if (!stateMatches) return redirectWithOutcome(request, flow, "state");
  if (outcome === "cancelled")
    return redirectWithOutcome(request, flow, "cancelled");
  if (outcome === "account_conflict")
    return redirectWithOutcome(request, flow, "conflict");
  if (outcome !== "success" || !/^[A-Za-z0-9_-]{40,128}$/.test(code))
    return redirectWithOutcome(request, flow, "failed");

  try {
    const result = await authApi<{ token: string }>("/auth/google/exchange", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const response = NextResponse.redirect(new URL("/dashboard", request.url));
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    response.cookies.set(SESSION_COOKIE, result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE,
    });
    clearFlowCookies(response);
    return response;
  } catch (error) {
    return redirectWithOutcome(
      request,
      flow,
      error instanceof ApiError && error.status === 409 ? "conflict" : "failed",
    );
  }
}
