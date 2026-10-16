"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";

export function PaymentProofUpload({
  trackingToken,
  uploadedAt,
}: {
  trackingToken: string;
  uploadedAt: string | null;
}) {
  const [currentUpload, setCurrentUpload] = useState(uploadedAt);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const proof = data.get("proof");
    if (!(proof instanceof File) || proof.size === 0) {
      setError(true);
      setMessage("Choose a payment screenshot first.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(
        `/api/public/orders/${encodeURIComponent(trackingToken)}/payment-proof`,
        { method: "POST", body: data },
      );
      const result = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(result.message ?? "The image could not be uploaded.");
      setCurrentUpload(result.uploadedAt ?? new Date().toISOString());
      setMessage("Payment proof sent. The store will verify it.");
      setError(false);
      form.reset();
    } catch (uploadError) {
      setError(true);
      setMessage(
        uploadError instanceof Error
          ? uploadError.message
          : "The image could not be uploaded. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="mt-4 rounded-xl border border-[#d6dfd6] bg-white p-4"
    >
      <h3 className="text-sm font-semibold">Send payment proof</h3>
      <p className="mt-1 text-xs leading-relaxed text-[#59685d]">
        Upload a screenshot of your GCash payment. The store will review it and
        update your order.
      </p>
      <label className="mt-3 block text-xs font-medium" htmlFor="payment-proof">
        JPG, PNG, or WebP · up to 5 MB
      </label>
      <input
        id="payment-proof"
        name="proof"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        required={!currentUpload}
        disabled={busy}
        className="mt-1 block min-h-11 w-full rounded-lg border border-[#d6dfd6] bg-[#fbfcfa] p-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-[#eef2ea] file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-[#244d35]"
      />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={busy} className="min-h-11">
          {busy
            ? "Uploading…"
            : currentUpload
              ? "Replace image"
              : "Upload proof"}
        </Button>
        {currentUpload && (
          <span className="text-xs text-[#59685d]">
            Proof received · awaiting review
          </span>
        )}
      </div>
      {message && (
        <p
          role={error ? "alert" : "status"}
          className={`mt-3 text-sm ${error ? "text-red-700" : "text-[#244d35]"}`}
        >
          {message}
        </p>
      )}
    </form>
  );
}
