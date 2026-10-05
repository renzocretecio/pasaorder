import { cookies } from "next/headers";
import { ApiError, SESSION_COOKIE, authApi } from "@/lib/auth";

export async function GET() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token)
    return Response.json(
      { message: "Authentication required" },
      { status: 401 },
    );
  try {
    const result = await authApi<{ token: string }>("/auth/socket-token", {
      headers: { authorization: `Bearer ${token}` },
    });
    return Response.json(result, {
      headers: { "Cache-Control": "no-store, private" },
    });
  } catch (error) {
    return Response.json(
      {
        message:
          error instanceof ApiError
            ? error.message
            : "Unable to connect to live updates.",
      },
      { status: error instanceof ApiError ? error.status : 503 },
    );
  }
}
