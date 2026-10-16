const CACHE_NAME = "pasaorder-offline-v1";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.add(OFFLINE_URL)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                key.startsWith("pasaorder-offline-") && key !== CACHE_NAME,
            )
            .map((key) => caches.delete(key)),
        ),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || request.mode !== "navigate") return;

  event.respondWith(
    fetch(request).catch(async () => {
      const cached = await caches.match(OFFLINE_URL);
      return cached || Response.error();
    }),
  );
});

self.addEventListener("push", (event) => {
  let notification = {};
  try {
    notification = event.data ? event.data.json() : {};
  } catch {
    notification = { title: "PasaOrder", body: "You have an order update." };
  }
  const title =
    typeof notification.title === "string" ? notification.title : "PasaOrder";
  const body =
    typeof notification.body === "string"
      ? notification.body
      : "You have an order update.";
  const url =
    typeof notification.url === "string" &&
    notification.url.startsWith("/") &&
    !notification.url.startsWith("//")
      ? notification.url
      : "/login";
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/pwa-icon/192",
      badge: "/pwa-icon/192",
      data: { url },
      tag: `pasaorder-${url}`,
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url;
  if (typeof url !== "string" || !url.startsWith("/") || url.startsWith("//"))
    return;
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(async (clients) => {
        const target = new URL(url, self.location.origin).href;
        const existing = clients.find((client) => client.url === target);
        if (existing) return existing.focus();
        return self.clients.openWindow(target);
      }),
  );
});
