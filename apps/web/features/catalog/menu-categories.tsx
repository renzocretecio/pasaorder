"use client";
import { useSyncExternalStore } from "react";
function subscribe(callback: () => void) {
  window.addEventListener("hashchange", callback);
  return () => window.removeEventListener("hashchange", callback);
}
const getHash = () => window.location.hash;
const getServerHash = () => "";
export function MenuCategories({
  categories,
}: {
  categories: { id: string; name: string }[];
}) {
  const hash = useSyncExternalStore(subscribe, getHash, getServerHash);
  const active = categories.find(
    (category) => hash === `#category-${category.id}`,
  )?.id;
  return (
    <div className="mx-auto flex max-w-6xl snap-x snap-proximity gap-2 overflow-x-auto overscroll-x-contain px-4 py-2.5 sm:px-8 sm:py-3">
      {categories.map((category) => (
        <a
          key={category.id}
          href={`#category-${category.id}`}
          aria-current={active === category.id ? "location" : undefined}
          className={`inline-flex min-h-11 shrink-0 snap-start items-center rounded-full px-4 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--store-accent-ink)] sm:px-5 ${active === category.id ? "bg-[var(--store-accent)] text-[var(--store-accent-text)]" : "bg-white text-[#59685d] hover:bg-accent hover:text-accent-foreground"}`}
        >
          {category.name}
        </a>
      ))}
    </div>
  );
}
