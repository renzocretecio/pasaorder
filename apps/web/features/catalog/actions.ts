"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  setupStoreSchema,
  catalogStoreSettingsSchema,
  categorySchema,
  catalogItemSchema,
  publicationSchema,
  catalogOrderSchema,
  idSchema,
} from "@pasaorder/validation";
import { requireUser, ApiError } from "@/lib/auth";
import { ownerApi, uploadCatalogImage } from "@/lib/catalog";
import { orderTypes, weekdays, type Catalog } from "@pasaorder/types";
export type CatalogState = {
  message?: string;
  success?: boolean;
  errors?: Record<string, string[]>;
  values?: Record<string, string>;
};
export type CatalogOperation =
  "setup" | "category" | "item" | "settings" | "publication";
export async function catalogAction(previous: CatalogState, data: FormData) {
  return mutateCatalog(
    String(data.get("_operation") ?? "") as CatalogOperation,
    String(data.get("_storeId") ?? ""),
    String(data.get("_recordId") ?? ""),
    previous,
    data,
  );
}

export async function saveCatalogOrder(
  storeId: string,
  order: {
    categoryIds: string[];
    items: { categoryId: string; itemIds: string[] }[];
  },
) {
  await requireUser();
  if (!idSchema.safeParse(storeId).success)
    return { message: "Invalid store. Reload and try again.", success: false };
  const parsed = catalogOrderSchema.safeParse(order);
  if (!parsed.success)
    return {
      message: "The order could not be saved. Reload and try again.",
      success: false,
    };
  const base = `/catalog/stores/${storeId}`;
  try {
    await ownerApi(`${base}/order`, {
      method: "PATCH",
      body: JSON.stringify(parsed.data),
    });
    const catalog = await ownerApi<Catalog>(base);
    revalidatePath(`/menu/${catalog.store.slug}`);
    revalidatePath(`/dashboard/stores/${storeId}`, "page");
    return { message: "Catalog order saved.", success: true };
  } catch (error) {
    return {
      message:
        error instanceof ApiError
          ? error.message
          : "Couldn’t save the order. Please try again.",
      success: false,
    };
  }
}
async function mutateCatalog(
  operation: CatalogOperation,
  storeId: string,
  recordId: string,
  _previous: CatalogState,
  data: FormData,
): Promise<CatalogState> {
  await requireUser();
  const values = Object.fromEntries(
    [...data.entries()]
      .filter(
        ([key]) =>
          key !== "imageFile" &&
          key !== "logoFile" &&
          key !== "bannerFile" &&
          !key.startsWith("$ACTION_") &&
          !key.startsWith("_"),
      )
      .map(([key, value]) => [key, String(value)]),
  );
  const imageFields: {
    field: "logoUrl" | "bannerUrl" | "imageUrl";
    input: string;
    kind: "logo" | "banner" | "product";
  }[] =
    operation === "setup" || operation === "settings"
      ? [
          { field: "logoUrl", input: "logoFile", kind: "logo" },
          { field: "bannerUrl", input: "bannerFile", kind: "banner" },
        ]
      : operation === "item"
        ? [{ field: "imageUrl", input: "imageFile", kind: "product" }]
        : [];
  const selectedImages: {
    field: (typeof imageFields)[number]["field"];
    kind: (typeof imageFields)[number]["kind"];
    file: File;
  }[] = [];
  for (const image of imageFields) {
    const entry = data.get(image.input);
    if (entry && !(entry instanceof File))
      return {
        errors: { [image.field]: ["Choose a valid image file."] },
        values,
      };
    if (!(entry instanceof File) || !entry.size) continue;
    if (entry.size > 5 * 1024 * 1024)
      return {
        errors: { [image.field]: ["Choose an image smaller than 5 MB."] },
        values,
      };
    if (!["image/jpeg", "image/png", "image/webp"].includes(entry.type))
      return {
        errors: { [image.field]: ["Use a JPG, PNG, or WebP image."] },
        values,
      };
    selectedImages.push({ field: image.field, kind: image.kind, file: entry });
  }
  const hours = weekdays.map((day) => {
    const open = values[`hours_${day}_open`] === "on";
    return {
      day,
      open,
      opens: open ? (values[`hours_${day}_opens`] ?? "") : "",
      closes: open ? (values[`hours_${day}_closes`] ?? "") : "",
    };
  });
  const common = {
    name: values.name ?? "",
    description: values.description ?? "",
    contactPhone: values.contactPhone ?? "",
    address: values.address ?? "",
    operatingHours: hours.some((day) => day.open) ? hours : null,
    orderTypes: orderTypes.filter(
      (orderType) => values[`orderType_${orderType}`] === "on",
    ),
    logoUrl: selectedImages.some((image) => image.field === "logoUrl")
      ? ""
      : (values.logoUrl ?? ""),
    bannerUrl: selectedImages.some((image) => image.field === "bannerUrl")
      ? ""
      : (values.bannerUrl ?? ""),
    accentColor: values.accentColor ?? "#244d35",
  };
  let parsed;
  if (operation === "setup")
    parsed = setupStoreSchema.safeParse({
      ...common,
      slug: values.slug ?? "",
    });
  else if (operation === "settings")
    parsed = catalogStoreSettingsSchema.safeParse(common);
  else if (operation === "category")
    parsed = categorySchema.safeParse({
      name: values.name ?? "",
      sortOrder: values.sortOrder ?? "0",
    });
  else if (operation === "item")
    parsed = catalogItemSchema.safeParse({
      categoryId: values.categoryId ?? "",
      name: values.name ?? "",
      description: values.description ?? "",
      ...(values.price ? { price: values.price } : {}),
      variants: data.getAll("variantLabel").map((label, index) => {
        const id = String(data.getAll("variantId")[index] ?? "");
        return {
          ...(id ? { id } : {}),
          label: String(label),
          price: String(data.getAll("variantPrice")[index] ?? ""),
        };
      }),
      imageUrl: selectedImages.some((image) => image.field === "imageUrl")
        ? ""
        : (values.imageUrl ?? ""),
      isAvailable: values.isAvailable === "on",
      sortOrder: values.sortOrder ?? "0",
    });
  else if (operation === "publication")
    parsed = publicationSchema.safeParse({
      isPublished: values.isPublished === "true",
    });
  else return { message: "Unknown action. Please reload the page.", values };
  if (!parsed.success) {
    const errors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues)
      (errors[String(issue.path[0])] ??= []).push(issue.message);
    return { errors, values };
  }
  if (
    operation !== "setup" &&
    (!idSchema.safeParse(storeId).success ||
      (recordId && !idSchema.safeParse(recordId).success))
  )
    return { message: "Invalid record. Reload and try again.", values };
  let createdId: string | undefined;
  try {
    for (const image of selectedImages) {
      try {
        const { url } = await uploadCatalogImage(image.file, image.kind);
        values[image.field] = url;
        if (image.field === "logoUrl" && "logoUrl" in parsed.data)
          parsed.data.logoUrl = url;
        if (image.field === "bannerUrl" && "bannerUrl" in parsed.data)
          parsed.data.bannerUrl = url;
        if (image.field === "imageUrl" && "imageUrl" in parsed.data)
          parsed.data.imageUrl = url;
      } catch (error) {
        return {
          errors: {
            [image.field]: [
              error instanceof ApiError
                ? error.message
                : "Image upload failed. Try again.",
            ],
          },
          values,
        };
      }
    }
    if (operation === "setup")
      createdId = (
        await ownerApi<{ id: string }>("/catalog/setup", {
          method: "POST",
          body: JSON.stringify(parsed.data),
        })
      ).id;
    else {
      const base = `/catalog/stores/${storeId}`;
      const endpoint =
        operation === "category"
          ? `/categories${recordId ? `/${recordId}` : ""}`
          : operation === "item"
            ? `/items${recordId ? `/${recordId}` : ""}`
            : operation === "publication"
              ? "/publication"
              : "";
      await ownerApi(base + endpoint, {
        method: operation === "settings" || recordId ? "PATCH" : "POST",
        body: JSON.stringify(parsed.data),
      });
      const catalog = await ownerApi<Catalog>(base);
      revalidatePath(`/menu/${catalog.store.slug}`);
      revalidatePath(`/dashboard/stores/${storeId}`, "layout");
    }
    revalidatePath("/dashboard");
  } catch (error) {
    return {
      message:
        error instanceof ApiError
          ? error.status === 409 && operation === "setup"
            ? "That menu link is taken. Choose another slug."
            : error.message
          : "Couldn’t save. Please try again.",
      values,
    };
  }
  if (createdId) redirect(`/dashboard/stores/${createdId}`);
  if ((operation === "category" || operation === "item") && !recordId)
    redirect(`/dashboard/stores/${storeId}`);
  if (operation === "settings" || operation === "item")
    redirect(`/dashboard/stores/${storeId}`);
  return {
    success: true,
    message:
      operation === "publication"
        ? values.isPublished === "true"
          ? "Catalog published. Your menu link is live."
          : "Catalog unpublished. Only you can preview it."
        : "Saved successfully.",
  };
}
