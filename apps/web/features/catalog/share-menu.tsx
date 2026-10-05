"use client";
import { useState } from "react";
import { Copy, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
export function ShareMenu({ slug }: { slug: string }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  function url() {
    return new URL(`/menu/${slug}`, window.location.origin).href;
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(url());
      setMessage("Menu link copied.");
    } catch {
      setMessage(
        "Copy is unavailable. Open your menu and copy the link from the address bar.",
      );
    }
  }
  async function download() {
    setBusy(true);
    try {
      const QRCode = await import("qrcode");
      const data = await QRCode.toDataURL(url(), {
        width: 1024,
        margin: 4,
        errorCorrectionLevel: "M",
      });
      const link = document.createElement("a");
      link.href = data;
      link.download = `${slug}-menu-qr.png`;
      link.click();
      setMessage("QR code downloaded.");
    } catch {
      setMessage("Couldn’t create the QR code. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
        <Button
          variant="outline"
          type="button"
          className="h-12 rounded-xl"
          onClick={copy}
        >
          <Copy aria-hidden="true" />
          Copy link
        </Button>
        <Button
          variant="outline"
          type="button"
          className="h-12 rounded-xl"
          disabled={busy}
          onClick={download}
        >
          <Download aria-hidden="true" />
          {busy ? "Creating QR…" : "Download QR"}
        </Button>
      </div>
      <p role="status" className="mt-3 text-[13px] text-muted-foreground">
        {message}
      </p>
    </div>
  );
}
