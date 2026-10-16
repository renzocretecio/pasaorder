"use client";
import { Button } from "@/components/ui/button";
export default function MenuError({ reset }: { reset: () => void }) {
  return (
    <main className="grid min-h-dvh place-items-center px-6">
      <div className="max-w-sm text-center">
        <h2 className="text-[28px] font-[650] leading-tight tracking-tight">
          We couldn’t load this catalog.
        </h2>
        <p className="mt-4 text-sm text-muted-foreground">
          Please check your connection and try again in a moment.
        </p>
        <Button onClick={reset} className="mt-6 h-11">
          Try again
        </Button>
      </div>
    </main>
  );
}
