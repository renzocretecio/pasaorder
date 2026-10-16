export type BrowserPushSubscription = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

export function homeScreenInstallHint() {
  const isIos = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator &&
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
  return isIos && !isStandalone
    ? "On iPhone or iPad, add PasaOrder to your Home Screen before enabling alerts."
    : "";
}

export function decodeApplicationServerKey(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const raw = window.atob(padded);
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

export async function getPushPublicKey() {
  const response = await fetch("/api/notifications/public-key", {
    cache: "no-store",
  });
  const result = (await response.json().catch(() => null)) as {
    publicKey?: string | null;
  } | null;
  if (!response.ok || !result?.publicKey)
    throw new Error(
      "Push notifications are not configured for this store yet.",
    );
  return result.publicKey;
}

export async function requestDeviceSubscription(): Promise<{
  manager: PushManager;
  subscription: PushSubscription;
}> {
  if (
    !("Notification" in window) ||
    !("serviceWorker" in navigator) ||
    !("PushManager" in window)
  )
    throw new Error("This browser does not support device notifications.");
  if (Notification.permission === "denied")
    throw new Error("Notifications are blocked in your browser settings.");
  const permission =
    Notification.permission === "granted"
      ? "granted"
      : await Notification.requestPermission();
  if (permission !== "granted")
    throw new Error("Allow notifications to receive order updates.");

  const registration = await navigator.serviceWorker.register("/sw.js", {
    scope: "/",
    updateViaCache: "none",
  });
  await navigator.serviceWorker.ready;
  const manager = registration.pushManager;
  const publicKey = await getPushPublicKey();
  const existing = await manager.getSubscription();
  const subscription =
    existing ??
    (await manager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: decodeApplicationServerKey(publicKey),
    }));
  return { manager, subscription };
}

export function serializeSubscription(
  subscription: PushSubscription,
): BrowserPushSubscription {
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth)
    throw new Error(
      "The browser returned an incomplete notification subscription.",
    );
  return {
    endpoint: json.endpoint,
    keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
  };
}
