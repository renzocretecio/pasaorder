const apiBase = () =>
  (
    process.env.API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://localhost:4000/api"
  ).replace(/\/$/, "");

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin) {
    let originHost: string;
    try {
      originHost = new URL(origin).host;
    } catch {
      return Response.json(
        { message: "Invalid request origin" },
        { status: 403 },
      );
    }
    if (!host || originHost !== host)
      return Response.json(
        { message: "Invalid request origin" },
        { status: 403 },
      );
  }
  try {
    const response = await fetch(`${apiBase()}/public/orders`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: await request.text(),
      signal: AbortSignal.timeout(15000),
    });
    const result = await response
      .json()
      .catch(() => ({ message: "Order could not be placed" }));
    return Response.json(result, { status: response.status });
  } catch {
    return Response.json(
      { message: "We couldn’t reach the store. Please try again shortly." },
      { status: 503 },
    );
  }
}
