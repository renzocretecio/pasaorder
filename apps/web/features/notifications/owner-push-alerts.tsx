"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  homeScreenInstallHint,
  requestDeviceSubscription,
  serializeSubscription,
} from "./push";
import {
  getOwnerPushSubscription,
  saveOwnerPushSubscription,
  removeOwnerPushSubscription,
} from "@/features/orders/actions";

export function OwnerPushAlerts() {
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
          const result = await getOwnerPushSubscription(subscription.endpoint);
          setEnabled(result.success && result.enabled);
        })
        .catch(() => undefined);
    });
  }, []);

  async function toggle() {
    setBusy(true);
    setMessage("");
    try {
      if (enabled) {
        const registration = await navigator.serviceWorker.getRegistration("/");
        const subscription = await registration?.pushManager.getSubscription();
        if (subscription) {
          const result = await removeOwnerPushSubscription(
            subscription.endpoint,
          );
          if (!result.success) throw new Error(result.message);
          await subscription.unsubscribe();
        }
        setEnabled(false);
      } else {
        const { subscription } = await requestDeviceSubscription();
        const result = await saveOwnerPushSubscription(
          serializeSubscription(subscription),
        );
        if (!result.success) throw new Error(result.message);
        setEnabled(true);
      }
      setMessage(
        enabled
          ? "New-order alerts turned off."
          : "New-order alerts are on for this device.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not update notification settings. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (!supported) return null;

  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <Button
        type="button"
        variant={enabled ? "outline" : "secondary"}
        className="min-h-11 rounded-xl"
        disabled={busy}
        onClick={toggle}
      >
        {busy ? (
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
        ) : enabled ? (
          <BellOff className="size-4" aria-hidden="true" />
        ) : (
          <Bell className="size-4" aria-hidden="true" />
        )}
        {enabled ? "Turn off order alerts" : "Enable order alerts"}
      </Button>
      {message && (
        <p
          role="status"
          className="max-w-xs text-xs text-muted-foreground sm:text-right"
        >
          {message}
        </p>
      )}
      {installHint && (
        <p className="max-w-xs text-xs text-muted-foreground sm:text-right">
          {installHint}
        </p>
      )}
    </div>
  );
}
