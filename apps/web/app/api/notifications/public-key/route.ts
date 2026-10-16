const apiBase = () =>
  (
    process.env.API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://localhost:4000/api"
  ).replace(/\/$/, "");

export async function GET() {
  try {
    const response = await fetch(`${apiBase()}/notifications/public-key`, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    const body = await response.json().catch(() => null);
    return Response.json(body ?? { publicKey: null }, {
      status: response.status,
    });
  } catch {
    return Response.json(
      { message: "Push notification settings are unavailable." },
      { status: 503 },
    );
  }
}
