import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { publicAuthApiBaseUrl } from "@/lib/auth";

const STATE_COOKIE = "pasaorder_google_state";
const FLOW_COOKIE = "pasaorder_google_flow";
const COOKIE_PATH = "/auth/google";

export function GET(request: NextRequest) {
  const flow =
    request.nextUrl.searchParams.get("flow") === "register"
      ? "register"
      : "login";
  const state = randomBytes(32).toString("hex");
  const target = new URL(`${publicAuthApiBaseUrl()}/auth/google`);
  target.searchParams.set("state", state);

  const response = NextResponse.redirect(target);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: COOKIE_PATH,
    maxAge: 10 * 60,
  };
  response.cookies.set(STATE_COOKIE, state, cookieOptions);
  response.cookies.set(FLOW_COOKIE, flow, cookieOptions);
  return response;
}
