"use client";
import { Button } from "@/components/ui/button";
export default function WorkspaceError({ reset }: { reset: () => void }) {
  return (
    <div className="mx-auto max-w-lg rounded-xl border bg-card p-8">
      <h2 className="text-[18px] font-semibold">
        We couldn’t load your workspace.
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        Please try again in a moment. Your saved catalog is still there.
      </p>
      <Button onClick={reset} className="mt-6 h-11">
        Try again
      </Button>
    </div>
  );
}
