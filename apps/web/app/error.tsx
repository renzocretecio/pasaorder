"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="grid min-h-svh place-items-center p-6">
      <div className="w-full max-w-sm space-y-5">
        <h1 className="text-3xl font-semibold tracking-tight">
          We couldn’t connect.
        </h1>
        <p className="text-muted-foreground">
          Please try again in a moment. Your account details haven’t changed.
        </p>
        <Button onClick={reset}>Try again</Button>
      </div>
    </main>
  );
}
