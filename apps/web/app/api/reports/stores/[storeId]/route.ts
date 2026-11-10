import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/auth";

const apiBase = () =>
  (
    process.env.API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://localhost:4000/api"
  ).replace(/\/$/, "");

export async function GET(
  request: Request,
  { params }: { params: Promise<{ storeId: string }> },
) {
  const { storeId } = await params;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token)
    return Response.json(
      { message: "Authentication required" },
      { status: 401 },
    );
  const query = new URL(request.url).searchParams;
  const url = new URL(
    `${apiBase()}/orders/stores/${encodeURIComponent(storeId)}/overview.csv`,
  );
  url.search = query.toString();
  try {
    const response = await fetch(url, {
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      return Response.json(
        { message: body?.message ?? "Report could not be exported" },
        { status: response.status },
      );
    }
    return new Response(response.body, {
      status: 200,
      headers: {
        "Content-Type":
          response.headers.get("content-type") ?? "text/csv; charset=utf-8",
        "Content-Disposition":
          response.headers.get("content-disposition") ??
          'attachment; filename="pasaorder-report.csv"',
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return Response.json(
      { message: "Report export is unavailable. Try again shortly." },
      { status: 503 },
    );
  }
}
