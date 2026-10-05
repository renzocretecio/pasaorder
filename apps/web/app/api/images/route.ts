import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/auth";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
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
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token)
    return Response.json(
      { message: "Please sign in to upload images" },
      { status: 401 },
    );
  if (Number(request.headers.get("content-length")) > MAX_IMAGE_BYTES)
    return Response.json(
      { message: "Choose an image smaller than 5 MB" },
      { status: 413 },
    );
  if (!request.body)
    return Response.json(
      { message: "Choose an image to upload" },
      { status: 400 },
    );
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_IMAGE_BYTES) {
      await reader.cancel();
      break;
    }
    chunks.push(value);
  }
  if (size > MAX_IMAGE_BYTES)
    return Response.json(
      { message: "Choose an image smaller than 5 MB" },
      { status: 413 },
    );
  const bytes = Buffer.concat(chunks, size);
  try {
    const response = await fetch(`${apiBase()}/images`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type":
          request.headers.get("content-type") ?? "application/octet-stream",
        "x-image-kind": request.headers.get("x-image-kind") ?? "",
      },
      body: bytes,
      signal: AbortSignal.timeout(30000),
    });
    const result = await response
      .json()
      .catch(() => ({ message: "Image upload failed" }));
    return Response.json(result, { status: response.status });
  } catch {
    return Response.json(
      { message: "Image upload is unavailable. Try again shortly." },
      { status: 503 },
    );
  }
}
