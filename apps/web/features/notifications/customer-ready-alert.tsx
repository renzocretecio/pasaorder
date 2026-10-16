"use client";

import { useEffect, useState } from "react";
import { Bell, BellRing, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  homeScreenInstallHint,
  requestDeviceSubscription,
  serializeSubscription,
} from "./push";

export function CustomerReadyAlert({
  trackingToken,
}: {
  trackingToken: string;
}) {
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [installHint, setInstallHint] = useState("");

  useEffect(() => {
    void Promise.resolve().then(() => {
      setInstallHint(homeScreenInstallHint());
      setSupported(
        "Notification" in window &&
          "serviceWorker" in navigator &&
          "PushManager" in window,
      );
      if (!("serviceWorker" in navigator)) return;
      void navigator.serviceWorker
        .getRegistration("/")
        .then((registration) => registration?.pushManager.getSubscription())
        .then(async (subscription) => {
          if (!subscription) return;
          const response = await fetch(
            `/api/notifications/orders/${encodeURIComponent(trackingToken)}/subscription?endpoint=${encodeURIComponent(subscription.endpoint)}`,
            { cache: "no-store" },
          );
          const result = (await response.json().catch(() => null)) as {
            enabled?: boolean;
          } | null;
          setEnabled(response.ok && result?.enabled === true);
        })
        .catch(() => undefined);
    });
  }, [trackingToken]);

  async function toggle() {
    setBusy(true);
    setMessage("");
    try {
      const { subscription } = await requestDeviceSubscription();
      const response = await fetch(
        `/api/notifications/orders/${encodeURIComponent(trackingToken)}/subscription`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(serializeSubscription(subscription)),
        },
      );
      const result = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;
      if (!response.ok)
        throw new Error(result?.message ?? "Could not enable order alerts.");
      setEnabled(true);
      setMessage(
        "This device will get one alert when the store marks your order ready.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not enable notifications. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    setMessage("");
    try {
      const registration = await navigator.serviceWorker.getRegistration("/");
      const subscription = await registration?.pushManager.getSubscription();
      if (!subscription) {
        setEnabled(false);
        return;
      }
      const response = await fetch(
        `/api/notifications/orders/${encodeURIComponent(trackingToken)}/subscription`,
        {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        },
      );
      if (!response.ok) throw new Error("Could not turn off this order alert.");
      setEnabled(false);
      setMessage("Order alert turned off for this device.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not update this alert.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (!supported) return null;

  return (
    <section
      aria-label="Order notifications"
      className="border-t border-[#d6dfd6] py-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold">
            Get an update when it’s ready
          </h2>
          <p className="mt-1 text-sm text-[#59685d]">
            Optional. This device will receive one notification for this order.
          </p>
        </div>
        <Button
          type="button"
          variant={enabled ? "secondary" : "default"}
          className="min-h-11 rounded-xl"
          disabled={busy}
          onClick={enabled ? turnOff : toggle}
        >
          {busy ? (
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          ) : enabled ? (
            <BellRing className="size-4" aria-hidden="true" />
          ) : (
            <Bell className="size-4" aria-hidden="true" />
          )}
          {enabled ? "Turn off alert" : "Notify me when ready"}
        </Button>
      </div>
      {message && (
        <p
          role="status"
          className="mt-2 text-xs leading-relaxed text-[#59685d]"
        >
          {message}
        </p>
      )}
      {installHint && (
        <p className="mt-2 text-xs leading-relaxed text-[#59685d]">
          {installHint}
        </p>
      )}
    </section>
  );
}
