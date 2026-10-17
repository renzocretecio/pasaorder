/**
 * Resolve the browser's Socket.IO origin. In production, prefer the current
 * site so a same-origin reverse proxy can forward `/socket.io` to the API.
 */
export function getSocketUrl() {
  const isLocalHost = ["localhost", "127.0.0.1"].includes(
    window.location.hostname,
  );
  const configuredUrl = process.env.NEXT_PUBLIC_SOCKET_URL?.trim();

  if (configuredUrl) {
    try {
      const configuredHost = new URL(configuredUrl, window.location.origin)
        .hostname;
      const isLoopback = ["localhost", "127.0.0.1", "::1"].includes(
        configuredHost,
      );

      // A loopback address in a production browser points to the customer's
      // own device, not the server. Use the same-origin proxy in that case.
      if (!isLocalHost && isLoopback) return window.location.origin;
    } catch {
      // Leave custom Socket.IO URLs to Socket.IO to validate and report.
    }

    return configuredUrl;
  }

  return isLocalHost ? "http://localhost:4000" : window.location.origin;
}
