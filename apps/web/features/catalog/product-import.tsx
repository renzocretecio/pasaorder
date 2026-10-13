"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownToLine, FileSpreadsheet, Upload } from "lucide-react";
import {
  MIN_CATALOG_IMPORT_ITEMS,
  type CatalogImportInput,
} from "@pasaorder/validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { previewProductImport, saveProductImport } from "./import-actions";

export function ProductImport({ storeId }: { storeId: string }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [previewData, setPreviewData] = useState<{
    count: number;
    sample: CatalogImportInput["items"];
  } | null>(null);
  const [fileName, setFileName] = useState("");
  const [message, setMessage] = useState("");
  const [stage, setStage] = useState<"preview" | "import" | null>(null);
  const [pending, startTransition] = useTransition();

  function preview() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setMessage("Choose an XLSX workbook first.");
      return;
    }
    const data = new FormData();
    data.set("file", file);
    setStage("preview");
    setMessage("");
    setPreviewData(null);
    startTransition(async () => {
      const result = await previewProductImport(data);
      if (result.success)
        setPreviewData({ count: result.count, sample: result.sample });
      else setMessage(result.message);
      setStage(null);
    });
  }

  function save() {
    if (!previewData) return;
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setMessage("Choose an XLSX workbook first.");
      setPreviewData(null);
      return;
    }
    const data = new FormData();
    data.set("file", file);
    setStage("import");
    setMessage("");
    startTransition(async () => {
      const result = await saveProductImport(storeId, data);
      if (result.success) {
        router.push(`/dashboard/stores/${storeId}`);
        router.refresh();
      } else {
        setMessage(result.message);
        setStage(null);
      }
    });
  }

  return (
    <div className="space-y-7">
      <div className="rounded-xl border bg-muted/35 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <FileSpreadsheet className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="text-[18px] font-semibold tracking-[-0.01em]">
              Start with the template
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              One product per row. Use Category, Product, and either Price or
              Options. New categories are created automatically.
            </p>
            <a
              href="/dashboard/catalog-template.xlsx"
              className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:rounded focus-visible:outline-2 focus-visible:outline-ring"
            >
              <ArrowDownToLine className="size-4" aria-hidden="true" />
              Download XLSX template
            </a>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <Label htmlFor="product-workbook" className="text-[13px]">
          Excel workbook
        </Label>
        <Input
          ref={fileRef}
          id="product-workbook"
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          aria-describedby="product-workbook-hint"
          className="h-auto min-h-12 rounded-xl bg-card py-2.5 file:mr-3 file:font-medium"
          onChange={(event) => {
            setFileName(event.target.files?.[0]?.name ?? "");
            setPreviewData(null);
            setMessage("");
          }}
        />
        <p
          id="product-workbook-hint"
          className="text-[13px] leading-relaxed text-muted-foreground"
        >
          XLSX only · 2 MB maximum · at least {MIN_CATALOG_IMPORT_ITEMS}{" "}
          products. Product images can be added afterward.
        </p>
        {fileName && (
          <p className="text-[13px] text-muted-foreground">
            Selected: {fileName}
          </p>
        )}
      </div>

      <Button
        type="button"
        variant="outline"
        className="h-12 w-full rounded-xl sm:w-auto"
        onClick={preview}
        disabled={pending}
      >
        <Upload aria-hidden="true" />
        {pending && stage === "preview"
          ? "Reading workbook…"
          : "Preview products"}
      </Button>

      {message && (
        <div
          role="alert"
          className="whitespace-pre-line rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
        >
          {message}
        </div>
      )}

      {previewData && (
        <section
          aria-labelledby="import-preview-heading"
          className="border-t pt-6"
        >
          <div className="mb-4">
            <h2
              id="import-preview-heading"
              className="text-[18px] font-semibold tracking-[-0.01em]"
            >
              Ready to import {previewData.count} products
            </h2>
            <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
              All rows passed workbook validation. Existing categories will be
              reused. If any name already exists in its category, the import
              stops without adding products.
            </p>
            {previewData.count > previewData.sample.length && (
              <p className="mt-1 text-[13px] text-muted-foreground">
                Showing the first {previewData.sample.length} products below.
              </p>
            )}
          </div>
          <div
            className="max-h-80 overflow-y-auto rounded-xl border"
            role="list"
            aria-label="Products to import"
          >
            {previewData.sample.map((item) => (
              <div
                key={item.row}
                role="listitem"
                className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 border-b px-4 py-3 last:border-b-0"
              >
                <div className="min-w-0">
                  <p className="break-words text-sm font-semibold">
                    {item.name}
                  </p>
                  <p className="mt-0.5 text-[13px] text-muted-foreground">
                    Row {item.row} · {item.category}
                    {item.isAvailable ? "" : " · Unavailable"}
                  </p>
                </div>
                <span className="text-sm font-medium tabular-nums text-primary">
                  {item.variants.length
                    ? `${item.variants.length} ${item.variants.length === 1 ? "option" : "options"}`
                    : `₱${item.price}`}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button
              type="button"
              className="h-12 rounded-xl"
              onClick={save}
              disabled={pending}
            >
              {pending && stage === "import"
                ? "Importing…"
                : `Import ${previewData.count} products`}
            </Button>
            <p className="text-[13px] text-muted-foreground">
              All products are added together, or none are.
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
