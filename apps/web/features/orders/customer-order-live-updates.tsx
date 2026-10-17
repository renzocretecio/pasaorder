"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { io } from "socket.io-client";
import { getSocketUrl } from "@/lib/socket-url";

export function CustomerOrderLiveUpdates({
  trackingToken,
}: {
  trackingToken: string;
}) {
  const router = useRouter();
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socket = io(getSocketUrl(), {
      auth: { trackingToken },
      autoConnect: false,
    });

    socket.on("connect", () => {
      setConnected(true);
      router.refresh();
    });
    socket.on("disconnect", () => setConnected(false));
    socket.on("connect_error", () => setConnected(false));
    socket.on("customer:order-changed", () => router.refresh());
    socket.connect();

    return () => {
      socket.disconnect();
    };
  }, [router, trackingToken]);

  return (
    <p
      role="status"
      className="mt-2 flex items-center gap-2 text-xs text-[#59685d]"
      aria-live="polite"
    >
      <span
        aria-hidden="true"
        className={`size-2 rounded-full ${connected ? "bg-emerald-600" : "bg-[#9aa59b]"}`}
      />
      {connected
        ? "Live order updates are on"
        : "Connecting to live order updates…"}
    </p>
  );
}
