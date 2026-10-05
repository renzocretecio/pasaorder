"use client";
/* eslint-disable @next/next/no-img-element -- Arbitrary store-supplied HTTPS URLs use native lazy loading. */
import { useState, useRef, useEffect } from "react";
import { Package, Store } from "lucide-react";
import { cn } from "@/lib/utils";
export function CatalogImage({
  src,
  alt,
  className,
  store = false,
  placeholderLabel,
}: {
  src?: string | null;
  alt: string;
  className?: string;
  store?: boolean;
  placeholderLabel?: string;
}) {
  const [failed, setFailed] = useState<string>();
  const imageRef = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const node = imageRef.current;
    if (src && node?.complete && node.naturalWidth === 0)
      void node.decode().catch(() => setFailed(src));
  }, [src]);
  const Icon = store ? Store : Package;
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center overflow-hidden rounded-xl bg-[var(--store-accent-soft,var(--muted))] text-[var(--store-accent-ink,var(--muted-foreground))]",
        className,
      )}
    >
      {src && failed !== src ? (
        <img
          ref={imageRef}
          src={src}
          alt={alt}
          width={96}
          height={96}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(src)}
          className="size-full bg-white object-cover"
        />
      ) : (
        <span className="flex size-full flex-col items-center justify-center gap-1 bg-[var(--store-accent-soft,var(--muted))] px-1 text-[var(--store-accent-ink,var(--muted-foreground))]">
          <Icon
            className={placeholderLabel ? "size-6" : "size-5"}
            aria-hidden="true"
          />
          {placeholderLabel && (
            <span className="text-[10px] leading-none">{placeholderLabel}</span>
          )}
        </span>
      )}
    </span>
  );
}
