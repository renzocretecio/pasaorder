import "server-only";

const imageNamePattern = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\.webp$/;
const imagePrefixPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const apiBase = () =>
  (
    process.env.API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://localhost:4000/api"
  ).replace(/\/$/, "");

export async function proxyImage(name: string, prefix?: string) {
  if (
    !imageNamePattern.test(name) ||
    (prefix && (!imagePrefixPattern.test(prefix) || prefix.length > 32))
  )
    return new Response(null, { status: 404 });
  try {
    const path = prefix ? `${prefix}/${name}` : name;
    const response = await fetch(`${apiBase()}/images/${path}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok || !response.body)
      return new Response(null, {
        status: response.status === 404 ? 404 : 503,
      });
    return new Response(response.body, {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response(null, { status: 503 });
  }
}
