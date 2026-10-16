"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { ProductAddonGroup } from "@pasaorder/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ProductAddonsEditor({
  initialGroups,
}: {
  initialGroups: ProductAddonGroup[];
}) {
  const [groups, setGroups] = useState(initialGroups);

  function updateGroup(id: string, changes: Partial<ProductAddonGroup>) {
    setGroups((current) =>
      current.map((group) =>
        group.id === id ? { ...group, ...changes } : group,
      ),
    );
  }

  return (
    <section
      className="space-y-4 border-t pt-5"
      aria-labelledby="product-addons-title"
    >
      <input type="hidden" name="addOnGroups" value={JSON.stringify(groups)} />
      <div>
        <h2
          id="product-addons-title"
          className="text-[18px] font-semibold tracking-[-0.01em]"
        >
          Add-ons
        </h2>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Optional extras customers can select. Add-on prices are included in
          the order total.
        </p>
      </div>
      {groups.map((group, groupIndex) => (
        <fieldset
          key={group.id}
          className="space-y-3 rounded-xl border bg-card p-3 sm:p-4"
        >
          <legend className="sr-only">Add-on group {groupIndex + 1}</legend>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_9rem_auto] sm:items-center">
            <Input
              aria-label={`Add-on group ${groupIndex + 1} name`}
              value={group.name}
              maxLength={80}
              placeholder="e.g. Gift wrap"
              onChange={(event) =>
                updateGroup(group.id, { name: event.target.value })
              }
              className="h-11 rounded-xl"
            />
            <select
              aria-label="Customer selection type"
              value={group.selection}
              onChange={(event) =>
                updateGroup(group.id, {
                  selection: event.target
                    .value as ProductAddonGroup["selection"],
                })
              }
              className="h-11 rounded-xl border border-input bg-background px-3 text-sm"
            >
              <option value="SINGLE">Choose one</option>
              <option value="MULTIPLE">Choose any</option>
            </select>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Remove ${group.name || `group ${groupIndex + 1}`}`}
              onClick={() =>
                setGroups((current) =>
                  current.filter((item) => item.id !== group.id),
                )
              }
              className="size-11"
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </Button>
          </div>
          <label className="inline-flex min-h-9 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={group.required}
              onChange={(event) =>
                updateGroup(group.id, { required: event.target.checked })
              }
              className="size-4 accent-primary"
            />
            Customer must choose from this group
          </label>
          <div className="space-y-2">
            {group.options.map((option, optionIndex) => (
              <div
                key={option.id}
                className="grid grid-cols-[minmax(0,1fr)_7rem_2.75rem] items-center gap-2"
              >
                <Input
                  aria-label={`Choice ${optionIndex + 1}`}
                  value={option.name}
                  maxLength={80}
                  placeholder="e.g. Gift box"
                  onChange={(event) =>
                    updateGroup(group.id, {
                      options: group.options.map((item) =>
                        item.id === option.id
                          ? { ...item, name: event.target.value }
                          : item,
                      ),
                    })
                  }
                  className="h-11 rounded-xl"
                />
                <label className="relative">
                  <span className="sr-only">Extra price in PHP</span>
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    ₱
                  </span>
                  <Input
                    aria-label={`Extra price for choice ${optionIndex + 1}`}
                    inputMode="decimal"
                    pattern="(0|[1-9][0-9]{0,7})(\.[0-9]{1,2})?"
                    value={option.price}
                    onChange={(event) =>
                      updateGroup(group.id, {
                        options: group.options.map((item) =>
                          item.id === option.id
                            ? { ...item, price: event.target.value }
                            : item,
                        ),
                      })
                    }
                    className="h-11 rounded-xl pl-7"
                  />
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove choice ${optionIndex + 1}`}
                  disabled={group.options.length <= 1}
                  onClick={() =>
                    updateGroup(group.id, {
                      options: group.options.filter(
                        (item) => item.id !== option.id,
                      ),
                    })
                  }
                  className="size-11"
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </Button>
              </div>
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={group.options.length >= 20}
            onClick={() =>
              updateGroup(group.id, {
                options: [
                  ...group.options,
                  { id: crypto.randomUUID(), name: "", price: "0" },
                ],
              })
            }
            className="h-10 rounded-xl"
          >
            <Plus className="size-4" aria-hidden="true" />
            Add choice
          </Button>
        </fieldset>
      ))}
      <Button
        type="button"
        variant="outline"
        disabled={groups.length >= 8}
        onClick={() =>
          setGroups((current) => [
            ...current,
            {
              id: crypto.randomUUID(),
              name: "",
              selection: "SINGLE",
              required: false,
              options: [{ id: crypto.randomUUID(), name: "", price: "0" }],
            },
          ])
        }
        className="h-11 rounded-xl"
      >
        <Plus className="size-4" aria-hidden="true" />
        Add add-on group
      </Button>
    </section>
  );
}
