import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { authApi, SESSION_COOKIE } from "./auth";
import { ApiError } from "./auth";
import { notFound } from "next/navigation";
import { idSchema } from "@pasaorder/validation";
import type { Catalog } from "@pasaorder/types";
export async function ownerApi<T>(path: string, options: RequestInit = {}) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) redirect("/login");
  return authApi<T>(path, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...options.headers,
      authorization: `Bearer ${token}`,
    },
  });
}
export async function uploadCatalogImage(
  file: File,
  kind: "logo" | "banner" | "product",
) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) redirect("/login");
  return authApi<{ url: string }>("/images", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": file.type,
      "x-image-kind": kind,
    },
    body: Buffer.from(await file.arrayBuffer()),
    signal: AbortSignal.timeout(30000),
  });
}
export async function getOwnerCatalog(id: string) {
  if (!idSchema.safeParse(id).success) notFound();
  try {
    return await ownerApi<Catalog>(`/catalog/stores/${id}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
}
