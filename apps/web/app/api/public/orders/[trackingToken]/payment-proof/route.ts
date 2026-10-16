const apiBase = () =>
  (
    process.env.API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://localhost:4000/api"
  ).replace(/\/$/, "");

export async function POST(
  request: Request,
  { params }: { params: Promise<{ trackingToken: string }> },
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

  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > 6 * 1024 * 1024)
    return Response.json(
      { message: "Choose one image up to 5 MB" },
      { status: 413 },
    );
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data;"))
    return Response.json(
      { message: "Choose a payment proof image to upload" },
      { status: 400 },
    );

  const { trackingToken } = await params;
  try {
    const response = await fetch(
      `${apiBase()}/public/orders/${encodeURIComponent(trackingToken)}/payment-proof`,
      {
        method: "POST",
        headers: { "content-type": contentType },
        body: await request.arrayBuffer(),
        cache: "no-store",
        signal: AbortSignal.timeout(30000),
      },
    );
    const body = await response
      .json()
      .catch(() => ({ message: "Upload failed" }));
    return Response.json(body, { status: response.status });
  } catch {
    return Response.json(
      { message: "Payment proof upload is unavailable. Try again shortly." },
      { status: 503 },
    );
  }
}
