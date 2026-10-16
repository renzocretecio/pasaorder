const apiBase = () =>
  (
    process.env.API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://localhost:4000/api"
  ).replace(/\/$/, "");

async function proxy(
  request: Request,
  context: { params: Promise<{ trackingToken: string }> },
) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin) {
    try {
      if (!host || new URL(origin).host !== host)
        return Response.json(
          { message: "Invalid request origin" },
          { status: 403 },
        );
    } catch {
      return Response.json(
        { message: "Invalid request origin" },
        { status: 403 },
      );
    }
  }

  const { trackingToken } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(trackingToken))
    return Response.json({ message: "Order not found" }, { status: 404 });
  const method = request.method;
  const search = new URL(request.url).search;
  try {
    const response = await fetch(
      `${apiBase()}/notifications/orders/${encodeURIComponent(trackingToken)}/subscription${search}`,
      {
        method,
        headers: { "content-type": "application/json" },
        body:
          method === "POST" || method === "DELETE"
            ? await request.text()
            : undefined,
        signal: AbortSignal.timeout(8000),
      },
    );
    if (response.status === 204) return new Response(null, { status: 204 });
    const body = await response.json().catch(() => null);
    return Response.json(body ?? {}, { status: response.status });
  } catch {
    return Response.json(
      { message: "Order notifications are unavailable. Please try again." },
      { status: 503 },
    );
  }
}

export const POST = proxy;
export const DELETE = proxy;
export const GET = proxy;
