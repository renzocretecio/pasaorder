"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyPaymentDetails({
  accountNumber,
}: {
  accountNumber: string;
}) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(accountNumber);
      setCopied(true);
      setFailed(false);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
      setFailed(true);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={copy}
        className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm font-medium hover:bg-[#f6f8f4] focus-visible:outline-2 focus-visible:outline-[#244d35]"
      >
        {copied ? (
          <Check className="size-4" aria-hidden="true" />
        ) : (
          <Copy className="size-4" aria-hidden="true" />
        )}
        {copied ? "Copied" : "Copy GCash number"}
      </button>
      {failed && (
        <p role="status" className="mt-2 text-xs text-[#59685d]">
          Copy wasn’t available. You can select and copy the details above.
        </p>
      )}
    </div>
  );
}
