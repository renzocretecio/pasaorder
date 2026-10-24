"use client";

import { useEffect, useState } from "react";
import { Dialog } from "radix-ui";
import { Download, LoaderCircle, Receipt, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  createCustomerOrderReceiptImage,
  type CustomerReceiptOrder,
} from "./download-order-receipt";

export function CustomerOrderReceipt({
  order,
  storeName,
}: {
  order: CustomerReceiptOrder;
  storeName: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<{
    url: string;
    fileName: string;
  } | null>(null);

  useEffect(() => {
    const url = preview?.url;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [preview?.url]);

  async function showReceipt() {
    setOpen(true);
    setLoading(true);
    setError("");
    setPreview(null);
    try {
      const receipt = await createCustomerOrderReceiptImage(storeName, order);
      setPreview({
        url: URL.createObjectURL(receipt.blob),
        fileName: receipt.fileName,
      });
    } catch {
      setError("Could not create the receipt image. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="border-t border-[#d6dfd6] py-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold">Save your order receipt</h2>
          <p className="mt-1 text-sm text-[#59685d]">
            View it here or download an image to keep a copy.
          </p>
        </div>
        <Dialog.Root open={open} onOpenChange={setOpen}>
          <Button
            type="button"
            variant="outline"
            className="min-h-11 w-full rounded-lg border-[#b9c8bb] bg-white text-[#244d35] hover:bg-[#eef2ea] sm:w-auto"
            onClick={() => void showReceipt()}
          >
            <Receipt className="size-4" aria-hidden="true" />
            View receipt
          </Button>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-50 bg-black/55 backdrop-blur-[2px]" />
            <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 flex max-h-[calc(100dvh-1rem)] flex-col overflow-hidden rounded-t-2xl border bg-white shadow-xl sm:inset-x-6 sm:top-1/2 sm:bottom-auto sm:mx-auto sm:max-h-[min(52rem,calc(100dvh-2rem))] sm:max-w-3xl sm:-translate-y-1/2 sm:rounded-2xl">
              <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[#d6dfd6] px-5 py-4 sm:px-6">
                <div className="min-w-0">
                  <Dialog.Title className="text-lg font-semibold tracking-[-0.02em]">
                    Order receipt · #{order.id}
                  </Dialog.Title>
                  <Dialog.Description className="mt-1 text-sm text-[#59685d]">
                    Your order details and current payment status.
                  </Dialog.Description>
                </div>
                <Dialog.Close asChild>
                  <button
                    type="button"
                    aria-label="Close order receipt"
                    className="grid size-11 shrink-0 place-items-center rounded-xl text-[#59685d] hover:bg-[#eef2ea] hover:text-[#18251d] focus-visible:outline-2 focus-visible:outline-[#37794b]"
                  >
                    <X className="size-5" aria-hidden="true" />
                  </button>
                </Dialog.Close>
              </div>
              <div className="min-h-0 flex-1 overflow-auto bg-[#f1f3ef] p-3 sm:p-5">
                <div className="grid min-h-64 place-items-center rounded-xl border border-[#d6dfd6] bg-white p-3 sm:min-h-96 sm:p-5">
                  {loading ? (
                    <p className="flex items-center gap-2 text-sm text-[#59685d]">
                      <LoaderCircle
                        className="size-4 animate-spin"
                        aria-hidden="true"
                      />
                      Preparing receipt…
                    </p>
                  ) : error ? (
                    <p role="alert" className="text-sm text-red-700">
                      {error}
                    </p>
                  ) : preview ? (
                    // eslint-disable-next-line @next/next/no-img-element -- Receipt image is generated locally in the browser.
                    <img
                      src={preview.url}
                      alt={`Order receipt for ${storeName}, order ${order.id}`}
                      className="h-auto max-h-[65dvh] w-auto max-w-full object-contain"
                    />
                  ) : null}
                </div>
              </div>
              <div className="flex shrink-0 justify-end gap-2 border-t border-[#d6dfd6] px-5 py-4 sm:px-6">
                <Dialog.Close asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11 rounded-lg"
                  >
                    Close
                  </Button>
                </Dialog.Close>
                {preview && (
                  <Button className="min-h-11 rounded-lg" asChild>
                    <a href={preview.url} download={preview.fileName}>
                      <Download className="size-4" aria-hidden="true" />
                      Download image
                    </a>
                  </Button>
                )}
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>
    </section>
  );
}
