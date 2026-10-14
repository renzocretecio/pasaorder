export function siteOrigin() {
  return process.env.WEB_ORIGIN ?? "http://localhost:3000";
}

export function siteUrl(path: string) {
  return new URL(path, siteOrigin());
}
