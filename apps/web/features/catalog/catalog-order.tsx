"use client";
import { useRef, useState, useTransition, type DragEvent } from "react";
import Link from "next/link";
import {
  ArrowDownUp,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  GripVertical,
  FileUp,
  Layers,
  Package,
  Plus,
  X,
} from "lucide-react";
import type { CatalogCategory } from "@pasaorder/types";
import { Button } from "@/components/ui/button";
import { Dialog } from "radix-ui";
import { CatalogImage } from "./catalog-image";
import { peso } from "./color";
import { saveCatalogOrder } from "./actions";

const dragType = "application/x-pasaorder-order";

function move<T>(values: T[], from: number, to: number) {
  if (to < 0 || to >= values.length || from === to) return values;
  const next = [...values];
  const [value] = next.splice(from, 1);
  next.splice(to, 0, value);
  return next;
}

export function CatalogOrder({
  storeId,
  categories: initialCategories,
}: {
  storeId: string;
  categories: CatalogCategory[];
}) {
  const base = `/dashboard/stores/${storeId}`;
  const [savedCategories, setSavedCategories] = useState(initialCategories);
  const [categories, setCategories] = useState(initialCategories);
  const [reorderingCategories, setReorderingCategories] = useState(false);
  const [reorderingItemsCategoryId, setReorderingItemsCategoryId] = useState<
    string | null
  >(null);
  const isReordering =
    reorderingCategories || reorderingItemsCategoryId !== null;
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const categoryListRef = useRef<HTMLDivElement>(null);

  function moveCategory(categoryId: string, offset: number) {
    setCategories((current) => {
      const index = current.findIndex((category) => category.id === categoryId);
      return move(current, index, index + offset);
    });
    setSaved(false);
  }

  function moveItem(categoryId: string, itemId: string, offset: number) {
    setCategories((current) =>
      current.map((category) => {
        if (category.id !== categoryId) return category;
        const index = category.items.findIndex((item) => item.id === itemId);
        return {
          ...category,
          items: move(category.items, index, index + offset),
        };
      }),
    );
    setSaved(false);
  }

  function saveOrder() {
    const order = {
      categoryIds: categories.map((category) => category.id),
      items: categories.map((category) => ({
        categoryId: category.id,
        itemIds: category.items.map((item) => item.id),
      })),
    };
    startTransition(async () => {
      setError("");
      const result = await saveCatalogOrder(storeId, order);
      if (result.success) {
        setSavedCategories(categories);
        setReorderingCategories(false);
        setReorderingItemsCategoryId(null);
        setSaved(true);
      } else {
        setError(result.message);
      }
    });
  }

  function cancelCategoryOrder() {
    setCategories(savedCategories);
    setError("");
    setReorderingCategories(false);
  }

  function onCategoryDrop(event: DragEvent<HTMLElement>, targetId: string) {
    event.preventDefault();
    const payload = event.dataTransfer.getData(dragType);
    if (!reorderingCategories || !payload.startsWith("category:")) return;
    const sourceId = payload.slice("category:".length);
    setCategories((current) =>
      move(
        current,
        current.findIndex((category) => category.id === sourceId),
        current.findIndex((category) => category.id === targetId),
      ),
    );
    setSaved(false);
  }

  function onItemDrop(
    event: DragEvent<HTMLLIElement>,
    categoryId: string,
    targetId: string,
  ) {
    event.preventDefault();
    const payload = event.dataTransfer.getData(dragType);
    if (
      reorderingItemsCategoryId !== categoryId ||
      !payload.startsWith(`item:${categoryId}:`)
    )
      return;
    const sourceId = payload.slice(`item:${categoryId}:`.length);
    setCategories((current) =>
      current.map((category) =>
        category.id !== categoryId
          ? category
          : {
              ...category,
              items: move(
                category.items,
                category.items.findIndex((item) => item.id === sourceId),
                category.items.findIndex((item) => item.id === targetId),
              ),
            },
      ),
    );
    setSaved(false);
  }

  return (
    <Dialog.Root
      open={reorderingCategories}
      onOpenChange={(open) => {
        setReorderingCategories(open);
        if (open) {
          setCategories(savedCategories);
          setError("");
        } else {
          cancelCategoryOrder();
        }
      }}
    >
      <section aria-label="Catalog items" className="min-w-0">
        <div className="sticky top-[var(--workspace-top)] z-10 -mx-1 mb-4 flex flex-wrap items-center justify-between gap-3 bg-background px-1 py-3">
          <div>
            <h2 className="text-[18px] font-semibold tracking-[-0.01em]">
              Your catalog
            </h2>
            <p className="mt-1 text-[13px] text-muted-foreground">
              {categories.length}{" "}
              {categories.length === 1 ? "category" : "categories"} ·{" "}
              {categories.reduce(
                (count, category) => count + category.items.length,
                0,
              )}{" "}
              items
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {!reorderingItemsCategoryId && (
              <>
                <Dialog.Trigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-12 rounded-xl bg-card"
                    onClick={() => setSaved(false)}
                  >
                    <ArrowDownUp aria-hidden="true" />
                    Reorder categories
                  </Button>
                </Dialog.Trigger>
                <Button
                  asChild
                  variant="outline"
                  className="h-12 rounded-xl bg-card"
                >
                  <Link href={`${base}/categories/new`}>
                    <Layers aria-hidden="true" />
                    Add category
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="h-12 rounded-xl bg-card"
                >
                  <Link href={`${base}/items/import`}>
                    <FileUp aria-hidden="true" />
                    Import
                  </Link>
                </Button>
                {categories.length > 0 && (
                  <Button asChild className="h-12 rounded-xl">
                    <Link href={`${base}/items/new`}>
                      <Plus aria-hidden="true" />
                      Add item
                    </Link>
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
        {reorderingItemsCategoryId && (
          <p className="mb-4 rounded-xl bg-secondary px-4 py-3 text-sm text-foreground">
            Drag products within their category or use the arrows, then save
            your changes.
          </p>
        )}
        {error && (
          <p role="alert" className="mb-4 text-sm text-destructive">
            {error}
          </p>
        )}
        {saved && !isReordering && (
          <p role="status" className="mb-4 text-sm text-muted-foreground">
            Catalog order saved.
          </p>
        )}
        {categories.length ? (
          <div className="space-y-5">
            {categories.map((category) => (
              <section
                key={category.id}
                className={`overflow-hidden rounded-2xl border bg-card ${isReordering ? "border-dashed border-primary/50" : ""}`}
              >
                <header className="flex items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="flex min-w-0 items-baseline gap-2">
                      <h3 className="min-w-0 break-words text-base font-semibold">
                        {category.name}
                      </h3>
                      <span className="text-[13px] text-muted-foreground">
                        {category.items.length}
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap justify-end gap-2">
                    {!isReordering && (
                      <>
                        <Button
                          type="button"
                          variant="ghost"
                          className="inline-flex min-h-11 shrink-0 items-center rounded-lg px-2 text-[13px] font-medium text-primary hover:bg-muted"
                          disabled={category.items.length < 2}
                          onClick={() => {
                            setCategories(savedCategories);
                            setError("");
                            setReorderingItemsCategoryId(category.id);
                          }}
                        >
                          <ArrowDownUp aria-hidden="true" />
                          Reorder products
                        </Button>
                        <Link
                          href={`${base}/categories/${category.id}`}
                          className="inline-flex min-h-11 shrink-0 items-center rounded-lg px-2 text-[13px] font-medium text-primary hover:bg-muted"
                          aria-label={`Edit category ${category.name}`}
                        >
                          Edit category
                        </Link>
                      </>
                    )}
                    {reorderingItemsCategoryId === category.id && (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-11 rounded-xl bg-card px-3 text-[13px]"
                          onClick={() => {
                            setCategories(savedCategories);
                            setError("");
                            setReorderingItemsCategoryId(null);
                          }}
                          disabled={pending}
                        >
                          <X aria-hidden="true" />
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          className="h-11 rounded-xl px-3 text-[13px]"
                          onClick={saveOrder}
                          disabled={pending}
                        >
                          <Check aria-hidden="true" />
                          {pending ? "Saving…" : "Save products"}
                        </Button>
                      </>
                    )}
                  </div>
                </header>
                {category.items.length ? (
                  <ul className="divide-y divide-border">
                    {category.items.map((item, itemIndex) => (
                      <li
                        key={item.id}
                        draggable={reorderingItemsCategoryId === category.id}
                        onDragStart={(event) => {
                          event.stopPropagation();
                          if (
                            reorderingItemsCategoryId !== category.id ||
                            (event.target as HTMLElement).closest("a,button")
                          ) {
                            event.preventDefault();
                            return;
                          }
                          event.dataTransfer.effectAllowed = "move";
                          event.dataTransfer.setData(
                            dragType,
                            `item:${category.id}:${item.id}`,
                          );
                        }}
                        onDragOver={(event) => {
                          if (reorderingItemsCategoryId === category.id)
                            event.preventDefault();
                        }}
                        onDrop={(event) => {
                          event.stopPropagation();
                          onItemDrop(event, category.id, item.id);
                        }}
                      >
                        {reorderingItemsCategoryId === category.id ? (
                          <div className="flex min-h-24 cursor-grab items-center gap-3 bg-secondary/30 px-4 py-4 active:cursor-grabbing sm:gap-4 sm:px-5">
                            <GripVertical
                              className="size-4 shrink-0 text-muted-foreground"
                              aria-hidden="true"
                            />
                            <MoveButtons
                              label={`item ${item.name}`}
                              index={itemIndex}
                              count={category.items.length}
                              onMove={(offset) =>
                                moveItem(category.id, item.id, offset)
                              }
                              disabled={pending}
                            />
                            <CatalogImage
                              src={item.imageUrl}
                              alt=""
                              className="size-12"
                            />
                            <div className="min-w-0 flex-1">
                              <Link
                                href={`${base}/items/${item.id}`}
                                className="break-words text-base font-medium text-primary underline-offset-4 hover:underline"
                              >
                                {item.name}
                              </Link>
                              <p className="mt-1 text-[13px] text-muted-foreground">
                                Drag to change its position
                              </p>
                            </div>
                          </div>
                        ) : (
                          <Link
                            href={`${base}/items/${item.id}`}
                            className="flex min-h-24 items-center gap-3 px-4 py-4 hover:bg-muted/60 sm:gap-4 sm:px-5"
                          >
                            <CatalogImage
                              src={item.imageUrl}
                              alt=""
                              className="size-12"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="break-words text-base font-medium">
                                {item.name}
                              </p>
                              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
                                <span className="text-base font-semibold text-foreground tabular-nums">
                                  {item.variants.length > 0 && "From "}
                                  {peso(item.price)}
                                </span>
                                <span className="text-muted-foreground">
                                  {item.isAvailable
                                    ? "Available"
                                    : "Unavailable"}
                                </span>
                              </div>
                            </div>
                            <ChevronRight
                              className="size-4 shrink-0 text-muted-foreground"
                              aria-hidden="true"
                            />
                          </Link>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="px-5 py-8 text-sm text-muted-foreground">
                    No items yet. Use “Add item” to fill this category.
                  </p>
                )}
              </section>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed bg-card px-5 py-12 text-center">
            <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-secondary text-primary">
              <Package className="size-6" aria-hidden="true" />
            </span>
            <h3 className="mt-5 text-[18px] font-semibold">
              Make room for your bestsellers.
            </h3>
            <p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
              Create a category, then add the items your customers love.
            </p>
            <Button asChild className="mt-6 h-12 rounded-xl">
              <Link href={`${base}/categories/new`}>Create first category</Link>
            </Button>
          </div>
        )}
      </section>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/45" />
        <Dialog.Content className="fixed inset-x-3 top-1/2 z-50 mx-auto flex max-h-[min(42rem,calc(100dvh-1.5rem))] w-[calc(100%-1.5rem)] max-w-xl -translate-y-1/2 flex-col overflow-hidden rounded-2xl border bg-card shadow-xl sm:inset-x-6 sm:w-[calc(100%-3rem)]">
          <div className="shrink-0 border-b px-5 py-4 sm:px-6">
            <Dialog.Title className="text-lg font-semibold">
              Reorder categories
            </Dialog.Title>
            <Dialog.Description className="mt-1 text-sm text-muted-foreground">
              Drag categories into place or use the arrows. Scroll this list to
              reach every category.
            </Dialog.Description>
          </div>
          <div
            ref={categoryListRef}
            onDragOver={(event) => {
              const list = categoryListRef.current;
              if (!list) return;
              const bounds = list.getBoundingClientRect();
              const edge = 48;
              if (event.clientY < bounds.top + edge) list.scrollTop -= 12;
              else if (event.clientY > bounds.bottom - edge)
                list.scrollTop += 12;
            }}
            className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6"
          >
            {categories.map((category, index) => (
              <div
                key={category.id}
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData(
                    dragType,
                    `category:${category.id}`,
                  );
                }}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => onCategoryDrop(event, category.id)}
                className="flex min-h-16 items-center gap-3 rounded-xl border bg-background px-3 py-2 cursor-grab active:cursor-grabbing"
              >
                <GripVertical
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <MoveButtons
                  label={`category ${category.name}`}
                  index={index}
                  count={categories.length}
                  onMove={(offset) => moveCategory(category.id, offset)}
                  disabled={pending}
                />
                <span className="min-w-0 flex-1 break-words text-sm font-medium">
                  {category.name}
                </span>
                <span className="shrink-0 text-[13px] text-muted-foreground">
                  {category.items.length}{" "}
                  {category.items.length === 1 ? "product" : "products"}
                </span>
              </div>
            ))}
          </div>
          {error && (
            <p
              role="alert"
              className="shrink-0 px-5 pb-2 text-sm text-destructive sm:px-6"
            >
              {error}
            </p>
          )}
          <div className="flex shrink-0 justify-end gap-2 border-t px-4 py-3 sm:px-6">
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-xl"
              onClick={cancelCategoryOrder}
              disabled={pending}
            >
              <X aria-hidden="true" />
              Cancel
            </Button>
            <Button
              type="button"
              className="h-11 rounded-xl"
              onClick={saveOrder}
              disabled={pending}
            >
              <Check aria-hidden="true" />
              {pending ? "Saving…" : "Save categories"}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function MoveButtons({
  label,
  index,
  count,
  onMove,
  disabled,
}: {
  label: string;
  index: number;
  count: number;
  onMove: (offset: number) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex shrink-0 flex-col">
      <button
        type="button"
        aria-label={`Move ${label} up`}
        disabled={disabled || index === 0}
        onClick={() => onMove(-1)}
        className="grid size-11 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-35"
      >
        <ChevronUp className="size-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        aria-label={`Move ${label} down`}
        disabled={disabled || index === count - 1}
        onClick={() => onMove(1)}
        className="grid size-11 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-35"
      >
        <ChevronDown className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
