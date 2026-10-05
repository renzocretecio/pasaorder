"use client";
import {
  useActionState,
  useState,
  useId,
  useRef,
  useEffect,
  startTransition,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  weekdays,
  orderTypes,
  type CatalogStore,
  type CatalogCategory,
  type OrderType,
  type Product,
  type Weekday,
  type PaymentMethod,
} from "@pasaorder/types";
import {
  catalogAction,
  type CatalogOperation,
  type CatalogState,
} from "./actions";
import Link from "next/link";
import { Check, ChevronDown, ArrowUpRight, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ShareMenu } from "./share-menu";
import { ImageUpload } from "./image-upload";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
function useCatalogAction() {
  const result = useActionState<CatalogState, FormData>(catalogAction, {});
  const formRef = useRef<HTMLFormElement>(null);
  const state = result[0];
  useEffect(() => {
    if (state.errors)
      formRef.current
        ?.querySelector<HTMLElement>('[aria-invalid="true"]')
        ?.focus();
    else if (state.message && !state.success)
      formRef.current?.querySelector<HTMLElement>('[role="alert"]')?.focus();
  }, [state]);
  return [...result, formRef] as const;
}
function FormSubmit({
  pending,
  busyLabel = "Saving…",
  children,
}: {
  pending: boolean;
  busyLabel?: string;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-x-0 bottom-[var(--workspace-bottom)] z-20 border-t bg-card py-3 pl-[max(1.25rem,env(safe-area-inset-left))] pr-[max(1.25rem,env(safe-area-inset-right))] md:sticky md:inset-x-auto md:bottom-4 md:mt-7 md:rounded-xl md:border md:p-3">
      <Button type="submit" disabled={pending} className="h-12 w-full">
        {pending ? busyLabel : children}
      </Button>
    </div>
  );
}
function ActionFields({
  operation,
  storeId = "",
  recordId = "",
}: {
  operation: CatalogOperation;
  storeId?: string;
  recordId?: string;
}) {
  return (
    <>
      <input type="hidden" name="_operation" value={operation} />
      <input type="hidden" name="_storeId" value={storeId} />
      <input type="hidden" name="_recordId" value={recordId} />
    </>
  );
}
function Feedback({ state }: { state: CatalogState }) {
  if (!state.message) return null;
  return (
    <Alert
      variant={state.success ? "default" : "destructive"}
      role={state.success ? "status" : "alert"}
      tabIndex={-1}
      className="mb-5"
    >
      <AlertDescription>{state.message}</AlertDescription>
    </Alert>
  );
}
type FieldControl = {
  id: string;
  "aria-invalid": boolean;
  "aria-describedby": string | undefined;
};
function Field({
  name,
  label,
  state,
  hint,
  children,
  ...props
}: {
  name: string;
  label: string;
  state: CatalogState;
  hint?: string;
  children?: (control: FieldControl) => ReactNode;
} & Omit<React.ComponentProps<typeof Input>, "name" | "children">) {
  const id = useId();
  const error = state.errors?.[name]?.[0];
  const control = {
    id,
    "aria-invalid": !!error,
    "aria-describedby": error ? `${id}-error` : hint ? `${id}-hint` : undefined,
  };
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-[13px] leading-[1.4]">
        {label}
      </Label>
      {children ? (
        children(control)
      ) : (
        <Input
          {...control}
          name={name}
          className="h-12 rounded-xl shadow-none"
          {...props}
        />
      )}
      {error ? (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-[13px] text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
const selectStyle =
  "h-12 w-full min-w-0 rounded-xl border border-input bg-card px-3 text-base focus-visible:outline-2 focus-visible:outline-ring";

function slugFromName(name: string) {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120)
    .replace(/-$/, "");
}

function submitWithSelectedImage(
  event: FormEvent<HTMLFormElement>,
  action: (data: FormData) => void,
) {
  const form = event.currentTarget;
  const inputs = form.querySelectorAll<HTMLInputElement>('input[type="file"]');
  if (![...inputs].some((input) => input.files?.length)) return;
  event.preventDefault();
  const data = new FormData(form);
  startTransition(() => action(data));
}

function StoreDayHours({
  day,
  store,
  values,
}: {
  day: Weekday;
  store?: CatalogStore;
  values?: Record<string, string>;
}) {
  const saved = store?.operatingHours?.find((hours) => hours.day === day);
  const [open, setOpen] = useState(
    values ? values[`hours_${day}_open`] === "on" : (saved?.open ?? false),
  );
  const label = day[0].toUpperCase() + day.slice(1);
  return (
    <div className="grid gap-3 border-b py-3 last:border-b-0 sm:grid-cols-[8rem_1fr] sm:items-center">
      <label className="flex min-h-9 items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          name={`hours_${day}_open`}
          checked={open}
          onChange={(event) => setOpen(event.target.checked)}
          className="size-4 accent-primary"
        />
        {label}
      </label>
      {open ? (
        <div className="flex min-w-0 items-center gap-2">
          <label className="min-w-0 flex-1 text-[13px] text-muted-foreground">
            Opens
            <Input
              type="time"
              name={`hours_${day}_opens`}
              required
              defaultValue={
                values?.[`hours_${day}_opens`] ?? saved?.opens ?? "09:00"
              }
              className="mt-1 h-11 w-full rounded-xl bg-card text-base"
            />
          </label>
          <span className="pt-5 text-muted-foreground" aria-hidden="true">
            –
          </span>
          <label className="min-w-0 flex-1 text-[13px] text-muted-foreground">
            Closes
            <Input
              type="time"
              name={`hours_${day}_closes`}
              required
              defaultValue={
                values?.[`hours_${day}_closes`] ?? saved?.closes ?? "17:00"
              }
              className="mt-1 h-11 w-full rounded-xl bg-card text-base"
            />
          </label>
        </div>
      ) : (
        <span className="text-sm text-muted-foreground">Closed</span>
      )}
    </div>
  );
}

export function StoreForm({ store }: { store?: CatalogStore }) {
  const [state, action, pending, formRef] = useCatalogAction();
  const [accent, setAccent] = useState(store?.accentColor ?? "#244d35");
  const [name, setName] = useState(state.values?.name ?? store?.name ?? "");
  const [slug, setSlug] = useState(state.values?.slug ?? "");
  const [slugEdited, setSlugEdited] = useState(false);
  const [selectedOrderTypes, setSelectedOrderTypes] = useState<OrderType[]>(
    store?.orderTypes ?? [...orderTypes],
  );
  const [selectedPaymentMethods, setSelectedPaymentMethods] = useState<
    PaymentMethod[]
  >(store?.paymentMethods ?? ["CASH"]);
  return (
    <form
      ref={formRef}
      action={action}
      onSubmit={(event) => submitWithSelectedImage(event, action)}
      aria-busy={pending}
    >
      <ActionFields
        operation={store ? "settings" : "setup"}
        storeId={store?.id}
      />
      <Feedback state={state} />
      <fieldset disabled={pending} className="space-y-5 pb-24 md:pb-0">
        <p className="border-b pb-4 text-[18px] font-semibold tracking-[-0.01em]">
          Store details
        </p>
        <Field
          name="name"
          label="Store name"
          state={state}
          required
          minLength={2}
          maxLength={120}
          value={name}
          onChange={(event) => {
            const nextName = event.target.value;
            setName(nextName);
            if (!store && !slugEdited) setSlug(slugFromName(nextName));
          }}
          placeholder="The name customers will see"
        />
        {!store && (
          <Field
            name="slug"
            label="Menu link"
            state={state}
            hint={`Your link: /menu/${slug || "your-store"}. Generated from the store name; you can edit it before creating the store.`}
            required
            maxLength={120}
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            value={slug}
            onChange={(event) => {
              setSlugEdited(true);
              setSlug(event.target.value);
            }}
            placeholder="your-store"
          />
        )}
        <Field name="description" label="About your store" state={state}>
          {(control) => (
            <textarea
              {...control}
              name="description"
              rows={3}
              maxLength={2000}
              defaultValue={
                state.values?.description ?? store?.description ?? ""
              }
              className="w-full rounded-xl border border-input bg-card p-3 text-base focus-visible:outline-2 focus-visible:outline-ring"
            />
          )}
        </Field>
        <Field
          name="contactPhone"
          label="Contact phone"
          state={state}
          hint="Optional. Customers can tap this number on your menu."
          type="tel"
          maxLength={40}
          defaultValue={state.values?.contactPhone ?? store?.contactPhone ?? ""}
          placeholder="e.g. +63 912 345 6789"
        />
        <Field
          name="address"
          label="Store address"
          state={state}
          hint="Optional. Show customers where to find you."
        >
          {(control) => (
            <textarea
              {...control}
              name="address"
              rows={2}
              maxLength={500}
              defaultValue={state.values?.address ?? store?.address ?? ""}
              className="w-full rounded-xl border border-input bg-card p-3 text-base focus-visible:outline-2 focus-visible:outline-ring"
            />
          )}
        </Field>
        <fieldset className="space-y-3">
          <legend className="text-[13px] font-medium">Order options</legend>
          <p className="text-[13px] text-muted-foreground">
            Choose how customers can receive their orders.
          </p>
          <div className="flex flex-wrap gap-2">
            {orderTypes.map((orderType) => {
              const selected = selectedOrderTypes.includes(orderType);
              const label =
                orderType === "DINE_IN"
                  ? "Dine in"
                  : orderType === "PICKUP"
                    ? "Takeaway"
                    : "Delivery";
              return (
                <label
                  key={orderType}
                  className={`flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border px-4 text-sm font-medium ${selected ? "border-primary bg-secondary text-primary" : "bg-card"}`}
                >
                  <input
                    type="checkbox"
                    name={`orderType_${orderType}`}
                    checked={selected}
                    onChange={(event) =>
                      setSelectedOrderTypes((current) =>
                        event.target.checked
                          ? [...current, orderType]
                          : current.filter((value) => value !== orderType),
                      )
                    }
                    className="size-4 accent-primary"
                  />
                  {label}
                </label>
              );
            })}
          </div>
          {state.errors?.orderTypes && (
            <p role="alert" className="text-sm text-destructive">
              {state.errors.orderTypes.join(" ")}
            </p>
          )}
        </fieldset>
        <details
          open={!!store || !!state.errors?.operatingHours}
          className="rounded-2xl border bg-card px-4 sm:px-5"
        >
          <summary className="min-h-14 cursor-pointer py-4 text-base font-semibold marker:text-muted-foreground">
            Operating hours{" "}
            <span className="text-[13px] font-normal text-muted-foreground">
              (optional)
            </span>
          </summary>
          <p className="pb-2 text-[13px] text-muted-foreground">
            Select the days you’re open. Closing times before opening times mean
            the next day.
          </p>
          <div className="pb-3">
            {weekdays.map((day) => (
              <StoreDayHours
                key={day}
                day={day}
                store={store}
                values={state.values}
              />
            ))}
            {state.errors?.operatingHours && (
              <p role="alert" className="mt-2 text-sm text-destructive">
                {state.errors.operatingHours.join(" ")}
              </p>
            )}
          </div>
        </details>
        <p className="border-t pt-5 text-[18px] font-semibold tracking-[-0.01em]">
          Your storefront
        </p>
        <Field
          name="logoUrl"
          label="Store logo"
          state={state}
          hint="Optional. Shown on your public menu."
        >
          {(control) => (
            <ImageUpload
              key={state.values?.logoUrl || store?.logoUrl || ""}
              id={control.id}
              invalid={control["aria-invalid"]}
              describedBy={control["aria-describedby"]}
              name="logoUrl"
              kind="logo"
              initialUrl={state.values?.logoUrl ?? store?.logoUrl ?? ""}
            />
          )}
        </Field>
        <Field
          name="bannerUrl"
          label="Store banner"
          state={state}
          hint="Optional. Use a wide photo for your store profile; the sides may crop on phones."
        >
          {(control) => (
            <ImageUpload
              key={state.values?.bannerUrl || store?.bannerUrl || ""}
              id={control.id}
              invalid={control["aria-invalid"]}
              describedBy={control["aria-describedby"]}
              name="bannerUrl"
              kind="banner"
              initialUrl={state.values?.bannerUrl ?? store?.bannerUrl ?? ""}
            />
          )}
        </Field>
        <Field
          name="accentColor"
          label="Storefront accent"
          state={state}
          hint="Used for storefront highlights. We choose readable text automatically."
        >
          {(control) => (
            <div className="flex items-center gap-3">
              <Input
                {...control}
                name="accentColor"
                type="color"
                value={accent}
                onChange={(e) => setAccent(e.target.value)}
                className="h-12 w-16 cursor-pointer rounded-xl p-1"
              />
              <span className="text-sm text-muted-foreground">{accent}</span>
            </div>
          )}
        </Field>
        <section
          className="space-y-4 border-t pt-5"
          aria-labelledby="payment-settings-title"
        >
          <div>
            <h2
              id="payment-settings-title"
              className="text-[18px] font-semibold tracking-[-0.01em]"
            >
              Payment options
            </h2>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Choose what customers can use at checkout. You’ll confirm payments
              yourself.
            </p>
          </div>
          <fieldset className="space-y-3">
            <legend className="sr-only">Available payment methods</legend>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { value: "CASH", label: "Cash" },
                  { value: "GCASH", label: "GCash" },
                ] as const
              ).map((method) => {
                const selected = selectedPaymentMethods.includes(method.value);
                return (
                  <label
                    key={method.value}
                    className={`flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border px-4 text-sm font-medium ${selected ? "border-primary bg-secondary text-primary" : "bg-card"}`}
                  >
                    <input
                      type="checkbox"
                      name={`paymentMethod_${method.value}`}
                      checked={selected}
                      onChange={(event) =>
                        setSelectedPaymentMethods((current) =>
                          event.target.checked
                            ? [...current, method.value]
                            : current.filter((value) => value !== method.value),
                        )
                      }
                      className="size-4 accent-primary"
                    />
                    {method.label}
                  </label>
                );
              })}
            </div>
            {state.errors?.paymentMethods && (
              <p role="alert" className="text-sm text-destructive">
                {state.errors.paymentMethods.join(" ")}
              </p>
            )}
          </fieldset>
          {selectedPaymentMethods.includes("GCASH") && (
            <div className="space-y-4 rounded-2xl border bg-card p-4 sm:p-5">
              <p className="text-sm leading-relaxed text-muted-foreground">
                Customers will see these details after choosing GCash. Add a QR
                image if you have one; account details are required either way.
              </p>
              <Field
                name="gcashAccountName"
                label="GCash account name"
                state={state}
                required
                maxLength={120}
                defaultValue={
                  state.values?.gcashAccountName ??
                  store?.gcashAccountName ??
                  ""
                }
                placeholder="Name registered with GCash"
              />
              <Field
                name="gcashNumber"
                label="GCash mobile number"
                state={state}
                required
                type="tel"
                maxLength={40}
                defaultValue={
                  state.values?.gcashNumber ?? store?.gcashNumber ?? ""
                }
                placeholder="e.g. 0917 123 4567"
              />
              <Field
                name="paymentQrUrl"
                label="GCash QR code"
                state={state}
                hint="Optional · JPG, PNG, or WebP · up to 5 MB"
              >
                {(control) => (
                  <ImageUpload
                    key={state.values?.paymentQrUrl || store?.gcashQrUrl || ""}
                    id={control.id}
                    invalid={control["aria-invalid"]}
                    describedBy={control["aria-describedby"]}
                    name="paymentQrUrl"
                    kind="payment-qr"
                    initialUrl={
                      state.values?.paymentQrUrl ?? store?.gcashQrUrl ?? ""
                    }
                  />
                )}
              </Field>
            </div>
          )}
        </section>
        <FormSubmit pending={pending}>
          {store ? "Save store settings" : "Create store"}
        </FormSubmit>
      </fieldset>
    </form>
  );
}
export function CategoryForm({
  storeId,
  category,
}: {
  storeId: string;
  category?: CatalogCategory;
}) {
  const [state, action, pending, formRef] = useCatalogAction();
  return (
    <form ref={formRef} action={action} aria-busy={pending}>
      <ActionFields
        operation="category"
        storeId={storeId}
        recordId={category?.id}
      />
      <Feedback state={state} />
      <fieldset disabled={pending} className="space-y-5 pb-24 md:pb-0">
        <Field
          name="name"
          label="Category name"
          state={state}
          required
          minLength={2}
          maxLength={120}
          defaultValue={state.values?.name ?? category?.name}
          placeholder="e.g. Bestsellers"
        />
        <input
          type="hidden"
          name="sortOrder"
          value={category?.sortOrder ?? 100000}
        />
        <FormSubmit pending={pending}>
          {category ? "Save category" : "Add category"}
        </FormSubmit>
      </fieldset>
    </form>
  );
}
export function ItemForm({
  storeId,
  categories,
  item,
}: {
  storeId: string;
  categories: CatalogCategory[];
  item?: Product;
}) {
  const [state, action, pending, formRef] = useCatalogAction();
  const [hasOptions, setHasOptions] = useState(!!item?.variants.length);
  const [singlePrice, setSinglePrice] = useState(
    state.values?.price ?? item?.price ?? "",
  );
  const [variants, setVariants] = useState(
    item?.variants.map((variant) => ({
      key: variant.id,
      id: variant.id,
      label: variant.label,
      price: variant.price,
    })) ?? [],
  );
  const variantFieldId = useId();
  const variantErrorId = useId();
  return (
    <form
      ref={formRef}
      action={action}
      onSubmit={(event) => submitWithSelectedImage(event, action)}
      aria-busy={pending}
    >
      <ActionFields operation="item" storeId={storeId} recordId={item?.id} />
      <Feedback state={state} />
      <fieldset disabled={pending} className="space-y-5 pb-24 md:pb-0">
        <Field name="categoryId" label="Category" state={state}>
          {(control) => (
            <select
              {...control}
              name="categoryId"
              required
              defaultValue={
                state.values?.categoryId ??
                item?.categoryId ??
                categories[0]?.id
              }
              className={selectStyle}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field
          name="name"
          label="Item name"
          state={state}
          required
          minLength={2}
          maxLength={120}
          defaultValue={state.values?.name ?? item?.name}
          placeholder="What are you selling?"
        />
        <div className="space-y-3">
          <p className="text-[13px] font-medium">How is it priced?</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { value: false, label: "One price" },
              { value: true, label: "Sizes / pieces" },
            ].map((choice) => (
              <label
                key={choice.label}
                className={`flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm font-medium ${hasOptions === choice.value ? "border-primary bg-secondary text-primary" : "bg-card"}`}
              >
                <input
                  type="radio"
                  name="pricingMode"
                  checked={hasOptions === choice.value}
                  onChange={() => {
                    setHasOptions(choice.value);
                    if (choice.value && variants.length === 0)
                      setVariants([
                        {
                          key: crypto.randomUUID(),
                          id: "",
                          label: "",
                          price: singlePrice,
                        },
                      ]);
                  }}
                  className="accent-primary"
                />
                {choice.label}
              </label>
            ))}
          </div>
        </div>
        {hasOptions ? (
          <div className="space-y-3">
            <div className="flex items-baseline justify-between gap-3">
              <div>
                <p className="text-[13px] font-medium">Size or piece options</p>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  Add a price for each choice customers can see.
                </p>
              </div>
            </div>
            {variants.map((variant, index) => (
              <div
                key={variant.key}
                className="grid grid-cols-[minmax(0,1fr)_minmax(0,7rem)_2.75rem] items-end gap-2 rounded-xl border bg-card p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,10rem)_2.75rem]"
              >
                <input type="hidden" name="variantId" value={variant.id} />
                <div className="min-w-0 space-y-2">
                  <Label htmlFor={`${variantFieldId}-${variant.key}-label`}>
                    Option {index + 1}
                  </Label>
                  <Input
                    id={`${variantFieldId}-${variant.key}-label`}
                    name="variantLabel"
                    aria-invalid={!!state.errors?.variants}
                    aria-describedby={
                      state.errors?.variants ? variantErrorId : undefined
                    }
                    required
                    maxLength={80}
                    value={variant.label}
                    onChange={(event) =>
                      setVariants((current) =>
                        current.map((row) =>
                          row.key === variant.key
                            ? { ...row, label: event.target.value }
                            : row,
                        ),
                      )
                    }
                    placeholder="Small / 6 pcs"
                    className="h-12 min-w-0 rounded-xl text-base"
                  />
                </div>
                <div className="min-w-0 space-y-2">
                  <Label htmlFor={`${variantFieldId}-${variant.key}-price`}>
                    PHP
                  </Label>
                  <Input
                    id={`${variantFieldId}-${variant.key}-price`}
                    name="variantPrice"
                    aria-invalid={!!state.errors?.variants}
                    aria-describedby={
                      state.errors?.variants ? variantErrorId : undefined
                    }
                    required
                    inputMode="decimal"
                    pattern="(0|[1-9][0-9]{0,7})(\.[0-9]{1,2})?"
                    value={variant.price}
                    onChange={(event) =>
                      setVariants((current) =>
                        current.map((row) =>
                          row.key === variant.key
                            ? { ...row, price: event.target.value }
                            : row,
                        ),
                      )
                    }
                    placeholder="150"
                    className="h-12 min-w-0 rounded-xl text-base"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove option ${index + 1}`}
                  disabled={variants.length === 1}
                  onClick={() =>
                    setVariants((current) =>
                      current.filter((row) => row.key !== variant.key),
                    )
                  }
                  className="size-11"
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </Button>
              </div>
            ))}
            {state.errors?.variants && (
              <p
                id={variantErrorId}
                role="alert"
                className="text-sm text-destructive"
              >
                {state.errors.variants[0]}
              </p>
            )}
            {state.errors?.price && (
              <p role="alert" className="text-sm text-destructive">
                {state.errors.price[0]}
              </p>
            )}
            <Button
              type="button"
              variant="outline"
              disabled={variants.length >= 20}
              onClick={() =>
                setVariants((current) => [
                  ...current,
                  {
                    key: crypto.randomUUID(),
                    id: "",
                    label: "",
                    price: "",
                  },
                ])
              }
              className="h-11 rounded-xl"
            >
              <Plus className="size-4" aria-hidden="true" />
              Add option
            </Button>
          </div>
        ) : (
          <Field
            name="price"
            label="Price (PHP)"
            state={state}
            required
            inputMode="decimal"
            pattern="(0|[1-9][0-9]{0,7})(\.[0-9]{1,2})?"
            value={singlePrice}
            onChange={(event) => setSinglePrice(event.target.value)}
            placeholder="150.00"
          />
        )}
        <Field name="description" label="Description" state={state}>
          {(control) => (
            <textarea
              {...control}
              name="description"
              maxLength={1000}
              rows={3}
              defaultValue={
                state.values?.description ?? item?.description ?? ""
              }
              className="w-full rounded-xl border border-input bg-card p-3 text-base focus-visible:outline-2 focus-visible:outline-ring"
            />
          )}
        </Field>
        <Field
          name="imageUrl"
          label="Product image"
          state={state}
          hint="Optional. Shown beside this item in the menu."
        >
          {(control) => (
            <ImageUpload
              key={state.values?.imageUrl || item?.imageUrl || ""}
              id={control.id}
              invalid={control["aria-invalid"]}
              describedBy={control["aria-describedby"]}
              name="imageUrl"
              kind="product"
              initialUrl={state.values?.imageUrl ?? item?.imageUrl ?? ""}
            />
          )}
        </Field>
        <input
          type="hidden"
          name="sortOrder"
          value={item?.sortOrder ?? 100000}
        />
        <label className="flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border bg-muted/40 px-4 text-base">
          <input
            name="isAvailable"
            type="checkbox"
            className="size-5 accent-primary"
            defaultChecked={
              state.values
                ? state.values.isAvailable === "on"
                : (item?.isAvailable ?? true)
            }
          />
          Available to customers
        </label>
        <p className="text-[13px] text-muted-foreground">
          Making your last available item unavailable also unpublishes the
          catalog.
        </p>
        <FormSubmit pending={pending}>
          {item ? "Save item" : "Add item"}
        </FormSubmit>
      </fieldset>
    </form>
  );
}
export function PublishPanel({
  store,
  categoryCount,
  available,
}: {
  store: CatalogStore;
  categoryCount: number;
  available: number;
}) {
  const [state, action, pending, formRef] = useCatalogAction();
  return (
    <aside className="rounded-2xl border bg-card p-5 lg:order-last lg:sticky lg:top-24">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">
          {store.isPublished
            ? "Your catalog is live"
            : available
              ? "Ready to publish"
              : "Build your catalog"}
        </h2>
        <Badge variant="secondary">
          {store.isPublished ? "Published" : "Draft"}
        </Badge>
      </div>
      {!store.isPublished && (
        <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
          {available
            ? "Preview your items, then make your menu link live."
            : "Add a category and an available item to get started."}
        </p>
      )}
      <form ref={formRef} action={action} aria-busy={pending} className="mt-4">
        <ActionFields operation="publication" storeId={store.id} />
        <input
          type="hidden"
          name="isPublished"
          value={String(!store.isPublished)}
        />
        <Feedback state={state} />
        {!store.isPublished && (
          <Button
            type="submit"
            disabled={pending}
            className="h-12 w-full rounded-xl"
          >
            {pending ? "Updating…" : "Publish catalog"}
          </Button>
        )}
        <details
          className={`group border-t ${store.isPublished ? "" : "mt-4"}`}
        >
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium focus-visible:rounded-md focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
            {store.isPublished ? "Share your catalog" : "Setup checklist"}
            <ChevronDown
              className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180 motion-reduce:transition-none"
              aria-hidden="true"
            />
          </summary>
          <div className="pt-2 pb-1">
            {store.isPublished ? (
              <>
                <p className="mb-4 text-[13px] leading-relaxed text-muted-foreground">
                  Saved edits go live immediately.
                </p>
                <p className="break-all text-[13px] text-muted-foreground">
                  /menu/{store.slug}
                </p>
                <Link
                  href={`/menu/${store.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="my-3 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary"
                >
                  Open public menu
                  <ArrowUpRight className="size-4" aria-hidden="true" />
                  <span className="sr-only">(opens in a new tab)</span>
                </Link>
                <ShareMenu slug={store.slug} />
                <div className="mt-4 border-t pt-4">
                  <p className="mb-3 text-[13px] text-muted-foreground">
                    Take your catalog offline while you make changes.
                  </p>
                  <Button
                    type="submit"
                    variant="outline"
                    disabled={pending}
                    className="h-12 w-full rounded-xl"
                  >
                    {pending ? "Updating…" : "Unpublish catalog"}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <ol className="space-y-3 text-[13px] text-muted-foreground">
                  {[
                    { done: !!categoryCount, label: "Add a category" },
                    { done: !!available, label: "Add an available item" },
                    { done: false, label: "Publish your catalog" },
                  ].map((step, index) => (
                    <li key={step.label} className="flex items-center gap-3">
                      <span
                        className={`grid size-6 shrink-0 place-items-center rounded-full ${step.done ? "bg-secondary text-primary" : "bg-muted"}`}
                      >
                        {step.done ? (
                          <Check className="size-3.5" aria-label="Complete" />
                        ) : (
                          index + 1
                        )}
                      </span>
                      {step.label}
                    </li>
                  ))}
                </ol>
                <p className="mt-4 break-all text-[13px] leading-relaxed text-muted-foreground">
                  Your permanent link: /menu/{store.slug}
                </p>
                <p className="mt-3 text-[13px] text-muted-foreground">
                  Your link and QR code become available after publishing.
                </p>
              </>
            )}
          </div>
        </details>
      </form>
    </aside>
  );
}
