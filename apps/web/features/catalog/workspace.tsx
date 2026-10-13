import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
export function PageHeading({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <header className="mb-7 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between md:mb-8">
      <div className="min-w-0">
        <h1 className="break-words text-[28px] font-[650] leading-[1.2] tracking-[-0.025em]">
          {title}
        </h1>
        {description && (
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {children && (
        <div className="flex w-full shrink-0 flex-wrap gap-2 sm:w-auto sm:justify-end">
          {children}
        </div>
      )}
    </header>
  );
}
export function EditorPanel({
  title,
  description,
  back,
  children,
}: {
  title: string;
  description: string;
  back: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href={back}
        className="mb-4 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {back === "/dashboard" ? "Back to stores" : "Back to catalog"}
      </Link>
      <PageHeading title={title} description={description} />
      <div className="rounded-2xl border bg-card p-5 pb-7 sm:p-7">
        {children}
      </div>
    </div>
  );
}
