"use client";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Trash2, Upload } from "lucide-react";
import { CatalogImage } from "./catalog-image";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
type ImageKind = "logo" | "banner" | "product";

export function ImageUpload({
  id,
  name,
  initialUrl,
  kind,
  invalid,
  describedBy,
}: {
  id: string;
  name: "logoUrl" | "bannerUrl" | "imageUrl";
  initialUrl: string;
  kind: ImageKind;
  invalid: boolean;
  describedBy?: string;
}) {
  const [url, setUrl] = useState(initialUrl);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  function chooseImage(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    if (!selected) return;
    if (selected.size > MAX_IMAGE_BYTES) {
      setError("Choose an image smaller than 5 MB.");
      event.target.value = "";
      setFile(null);
      setPreview("");
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(selected.type)) {
      setError("Use a JPG, PNG, or WebP image.");
      event.target.value = "";
      setFile(null);
      setPreview("");
      return;
    }
    setError("");
    setUrl("");
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
  }

  return (
    <div className="space-y-3">
      <div
        className={
          kind === "banner"
            ? "flex flex-col items-start gap-3"
            : "flex items-center gap-4"
        }
      >
        <CatalogImage
          src={preview || url}
          alt=""
          store={kind === "logo"}
          placeholderLabel={
            kind === "product"
              ? "No photo"
              : kind === "banner"
                ? "No banner"
                : undefined
          }
          className={
            kind === "banner"
              ? "aspect-[3/1] w-full max-w-xl rounded-xl"
              : "size-16 rounded-xl"
          }
        />
        <div>
          <label
            htmlFor={id}
            className="relative inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border bg-card px-4 text-sm font-medium hover:bg-muted focus-within:outline-2 focus-within:outline-ring"
          >
            <Upload className="size-4" aria-hidden="true" />
            {kind === "banner" ? "Choose banner" : "Choose image"}
            <input
              ref={fileInput}
              id={id}
              type="file"
              name={
                kind === "logo"
                  ? "logoFile"
                  : kind === "banner"
                    ? "bannerFile"
                    : "imageFile"
              }
              accept="image/jpeg,image/png,image/webp"
              aria-invalid={invalid}
              aria-describedby={describedBy}
              aria-label={
                kind === "logo"
                  ? "Choose store logo"
                  : kind === "banner"
                    ? "Choose store banner"
                    : "Choose product image"
              }
              onChange={chooseImage}
              className="absolute inset-0 size-full cursor-pointer opacity-0"
            />
          </label>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {file
              ? "Selected image uploads when you save."
              : "JPG, PNG, or WebP · up to 5 MB"}
          </p>
          {(url || file) && (
            <button
              type="button"
              onClick={() => {
                setUrl("");
                setFile(null);
                setPreview("");
                if (fileInput.current) fileInput.current.value = "";
                setError("");
              }}
              className="mt-1 inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:rounded-md focus-visible:outline-2 focus-visible:outline-ring"
            >
              <Trash2 className="size-4" aria-hidden="true" />
              Remove image
            </button>
          )}
        </div>
      </div>
      <input type="hidden" name={name} value={url} />
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
