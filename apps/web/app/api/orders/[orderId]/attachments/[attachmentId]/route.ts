import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/auth";

const apiBase = () =>
  (
    process.env.API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://localhost:4000/api"
  ).replace(/\/$/, "");

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orderId: string; attachmentId: string }> },
) {
  const { orderId, attachmentId } = await params;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token)
    return Response.json(
      { message: "Authentication required" },
      { status: 401 },
    );
  try {
    const response = await fetch(
      `${apiBase()}/orders/${encodeURIComponent(orderId)}/attachments/${encodeURIComponent(attachmentId)}`,
      {
        headers: { authorization: `Bearer ${token}` },
        cache: "no-store",
        signal: AbortSignal.timeout(30000),
      },
    );
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      return Response.json(
        { message: body?.message ?? "Attachment could not be downloaded" },
        { status: response.status },
      );
    }
    return new Response(response.body, {
      status: 200,
      headers: {
        "Content-Type":
          response.headers.get("content-type") ?? "application/octet-stream",
        "Content-Disposition":
          response.headers.get("content-disposition") ??
          'attachment; filename="order-attachment"',
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return Response.json(
      { message: "Attachment download is unavailable. Try again shortly." },
      { status: 503 },
    );
  }
}
