import { z } from "zod";
import { idSchema, slugSchema } from "./common.js";
const weekdays = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;
const optionalText = (max: number) => z.string().trim().max(max).default("");
const orderTypeValues = ["DINE_IN", "PICKUP", "DELIVERY"] as const;
const paymentMethodValues = ["CASH", "GCASH"] as const;
export const imageUrlSchema = z
  .string()
  .trim()
  .max(2000)
  .refine((value) => {
    if (!value) return true;
    const uploaded = value.match(
      /^\/api\/images\/(?:([a-z0-9]+(?:-[a-z0-9]+)*)\/)?[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\.webp$/,
    );
    if (uploaded) return !uploaded[1] || uploaded[1].length <= 32;
    try {
      const url = new URL(value);
      return url.protocol === "https:" && !url.username && !url.password;
    } catch {
      return false;
    }
  }, "Upload an image, use a valid HTTPS URL, or leave it empty")
  .default("");
export const accentColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Use a six-digit hex color")
  .transform((value) => value.toLowerCase());
const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Enter a valid time");
export const operatingHoursSchema = z
  .array(
    z
      .object({
        day: z.enum(weekdays),
        open: z.boolean(),
        opens: z.string(),
        closes: z.string(),
      })
      .strict(),
  )
  .length(7)
  .superRefine((hours, context) => {
    for (const [index, hoursDay] of hours.entries()) {
      if (hoursDay.day !== weekdays[index])
        context.addIssue({
          code: "custom",
          path: [index, "day"],
          message: "Invalid day order",
        });
      if (
        hoursDay.open &&
        (!timeSchema.safeParse(hoursDay.opens).success ||
          !timeSchema.safeParse(hoursDay.closes).success ||
          hoursDay.opens === hoursDay.closes)
      )
        context.addIssue({
          code: "custom",
          path: [index],
          message: `Enter different opening and closing times for ${hoursDay.day}`,
        });
      if (!hoursDay.open && (hoursDay.opens || hoursDay.closes))
        context.addIssue({
          code: "custom",
          path: [index],
          message: "Closed days cannot have hours",
        });
    }
  });
export const catalogStoreSettingsSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    description: optionalText(2000),
    contactPhone: optionalText(40).refine(
      (phone) =>
        !phone ||
        (/^[+()\d\s.-]+$/.test(phone) && phone.replace(/\D/g, "").length >= 6),
      "Enter a valid phone number",
    ),
    address: optionalText(500),
    operatingHours: operatingHoursSchema.nullable().default(null),
    orderTypes: z
      .array(z.enum(orderTypeValues))
      .min(1)
      .refine((values) => new Set(values).size === values.length)
      .default([...orderTypeValues]),
    paymentMethods: z
      .array(z.enum(paymentMethodValues))
      .min(1, "Choose at least one payment method")
      .refine((values) => new Set(values).size === values.length)
      .default(["CASH"]),
    gcashAccountName: optionalText(120),
    gcashNumber: z
      .string()
      .trim()
      .max(40)
      .refine(
        (value) =>
          !value ||
          (/^[+()\d\s.-]+$/.test(value) &&
            value.replace(/\D/g, "").length >= 6),
        "Enter a valid GCash number",
      )
      .default(""),
    gcashQrUrl: imageUrlSchema,
    logoUrl: imageUrlSchema,
    bannerUrl: imageUrlSchema,
    accentColor: accentColorSchema.default("#244d35"),
  })
  .superRefine((settings, context) => {
    if (settings.paymentMethods.includes("GCASH")) {
      if (!settings.gcashAccountName.trim())
        context.addIssue({
          code: "custom",
          path: ["gcashAccountName"],
          message: "Enter the GCash account name",
        });
      if (!settings.gcashNumber.trim())
        context.addIssue({
          code: "custom",
          path: ["gcashNumber"],
          message: "Enter the GCash mobile number",
        });
    }
  });
export const setupStoreSchema = catalogStoreSettingsSchema
  .extend({
    slug: slugSchema,
  })
  .strict();
export const categorySchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    sortOrder: z.coerce.number().int().min(0).max(100000).default(0),
  })
  .strict();
const priceSchema = z
  .string()
  .regex(
    /^(?:0|[1-9]\d{0,7})(?:\.\d{1,2})?$/,
    "Enter a price with up to two decimal places",
  )
  .refine((value) => Number(value) > 0, "Price must be positive");
const variantSchema = z
  .object({
    id: idSchema.optional(),
    label: z.string().trim().min(1, "Enter a size or piece count").max(80),
    price: priceSchema,
  })
  .strict();
export const catalogItemSchema = z
  .object({
    categoryId: idSchema,
    name: z.string().trim().min(2).max(120),
    description: optionalText(1000),
    price: priceSchema.optional(),
    variants: z.array(variantSchema).max(20).default([]),
    imageUrl: imageUrlSchema,
    isAvailable: z.boolean().default(true),
    sortOrder: z.coerce.number().int().min(0).max(100000).default(0),
  })
  .strict()
  .superRefine((item, context) => {
    if (!item.variants.length && !item.price)
      context.addIssue({
        code: "custom",
        path: ["price"],
        message: "Enter a price or add at least one size or piece option",
      });
    const labels = new Set<string>();
    for (const [index, variant] of item.variants.entries()) {
      const label = variant.label.toLocaleLowerCase();
      if (labels.has(label))
        context.addIssue({
          code: "custom",
          path: ["variants", index, "label"],
          message: "Each option needs a different name",
        });
      labels.add(label);
    }
  });
export const MIN_CATALOG_IMPORT_ITEMS = 5;
// Technical ceiling for workbook parsing and API validation, not a store plan limit.
export const MAX_CATALOG_IMPORT_ITEMS = 9999;
export const catalogImportSchema = z
  .object({
    items: z
      .array(
        z
          .object({
            row: z.number().int().min(2).max(10000),
            category: z.string().trim().min(2).max(120),
            name: z.string().trim().min(2).max(120),
            description: optionalText(1000),
            price: priceSchema.optional(),
            variants: z.array(variantSchema.omit({ id: true })).max(20),
            isAvailable: z.boolean(),
          })
          .strict()
          .superRefine((item, context) => {
            if (item.variants.length === 0 && !item.price)
              context.addIssue({
                code: "custom",
                path: ["price"],
                message: "Enter a price or options",
              });
            if (item.variants.length > 0 && item.price)
              context.addIssue({
                code: "custom",
                path: ["price"],
                message: "Leave Price blank when using Options",
              });
            const labels = new Set<string>();
            for (const [index, variant] of item.variants.entries()) {
              const key = variant.label.toLocaleLowerCase();
              if (labels.has(key))
                context.addIssue({
                  code: "custom",
                  path: ["variants", index, "label"],
                  message: "Duplicate option",
                });
              labels.add(key);
            }
          }),
      )
      .min(MIN_CATALOG_IMPORT_ITEMS)
      .max(MAX_CATALOG_IMPORT_ITEMS),
  })
  .strict();
export type CatalogImportInput = z.infer<typeof catalogImportSchema>;
export const publicationSchema = z
  .object({ isPublished: z.boolean() })
  .strict();
export const catalogOrderSchema = z
  .object({
    categoryIds: z.array(idSchema).max(500),
    items: z
      .array(
        z
          .object({
            categoryId: idSchema,
            itemIds: z.array(idSchema).max(500),
          })
          .strict(),
      )
      .max(500),
  })
  .strict()
  .superRefine((order, context) => {
    if (new Set(order.categoryIds).size !== order.categoryIds.length)
      context.addIssue({ code: "custom", path: ["categoryIds"] });
    if (
      new Set(order.items.map(({ categoryId }) => categoryId)).size !==
      order.items.length
    )
      context.addIssue({ code: "custom", path: ["items"] });
    for (const [index, category] of order.items.entries())
      if (new Set(category.itemIds).size !== category.itemIds.length)
        context.addIssue({ code: "custom", path: ["items", index, "itemIds"] });
  });
