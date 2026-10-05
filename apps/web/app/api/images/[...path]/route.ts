import { proxyImage } from "@/lib/image-proxy";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  if (path.length === 1) return proxyImage(path[0]);
  if (path.length === 2) return proxyImage(path[1], path[0]);
  return new Response(null, { status: 404 });
}
