import express, { Router } from "express";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { z } from "zod";
import {
  createOrderSchema,
  createManualOrderSchema,
  idSchema,
  overviewDateRangeSchema,
  updatePaymentStatusSchema,
  updateOrderStatusSchema,
} from "@pasaorder/validation";
import { AppError } from "../../middleware/errors.js";
import { requireAuth } from "../../middleware/auth.js";
import * as repository from "./orders.repository.js";
import { emitOrdersChanged } from "../../realtime/socket.js";
import {
  deletePrivateOrderFile,
  readOrderAttachment,
  writePaymentProof,
} from "./order-attachments.storage.js";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const router = Router();
export const ownerOrdersRouter = Router();

ownerOrdersRouter.use(requireAuth);
ownerOrdersRouter.post("/stores/:storeId/manual", async (req, res) => {
  const storeId = idSchema.parse(req.params.storeId);
  const input = createManualOrderSchema.parse(req.body);
  const result = await repository.createManualOrder(
    req.auth!.userId,
    storeId,
    input,
  );
  if (result.created) emitOrdersChanged(result.order.storeId);
  res.status(201).json({ order: result.order });
});
ownerOrdersRouter.get("/stores/:storeId/overview", async (req, res) => {
  const storeId = idSchema.parse(req.params.storeId);
  const range =
    req.query.from === undefined && req.query.to === undefined
      ? undefined
      : overviewDateRangeSchema.parse({
          from: req.query.from,
          to: req.query.to,
        });
  res.json({
    overview: await repository.getStoreOverview(
      req.auth!.userId,
      storeId,
      range,
    ),
  });
});
ownerOrdersRouter.get("/stores/:storeId/recent-orders", async (req, res) => {
  const storeId = idSchema.parse(req.params.storeId);
  res.json({
    orders: await repository.listRecentOrders(req.auth!.userId, storeId),
  });
});
ownerOrdersRouter.get("/stores/:storeId/history", async (req, res) => {
  const storeId = idSchema.parse(req.params.storeId);
  const query = z
    .object({
      cursor: z.string().max(256).optional(),
      payment: z.enum(["ALL", "UNPAID"]).default("ALL"),
    })
    .parse(req.query);
  res.json(
    await repository.listPastOrders(
      req.auth!.userId,
      storeId,
      query.cursor,
      query.payment,
    ),
  );
});
ownerOrdersRouter.get("/", async (req, res) => {
  const storeId =
    req.query.storeId === undefined
      ? undefined
      : idSchema.parse(req.query.storeId);
  res.json({
    orders: await repository.listOwnerOrders(req.auth!.userId, storeId),
  });
});
ownerOrdersRouter.get(
  "/:orderId/attachments/:attachmentId",
  async (req, res) => {
    const attachment = await repository.getOwnerOrderAttachment(
      req.auth!.userId,
      idSchema.parse(req.params.orderId),
      z.uuid().parse(req.params.attachmentId),
    );
    const object = await readOrderAttachment(attachment.objectKey);
    if (!(object.Body instanceof Readable))
      throw new AppError(502, "Order attachment is unavailable");
    const fileName = encodeURIComponent(attachment.fileName);
    res.set({
      "Content-Type": attachment.contentType,
      "Content-Length": object.ContentLength?.toString(),
      "Content-Disposition": `attachment; filename="attachment"; filename*=UTF-8''${fileName}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    });
    await pipeline(object.Body, res);
  },
);
ownerOrdersRouter.get("/:orderId/payment-proof", async (req, res) => {
  const proof = await repository.getOwnerPaymentProof(
    req.auth!.userId,
    idSchema.parse(req.params.orderId),
  );
  const object = await readOrderAttachment(proof.objectKey);
  if (!(object.Body instanceof Readable))
    throw new AppError(502, "Payment proof is unavailable");
  res.set({
    "Content-Type": "image/webp",
    "Content-Length": object.ContentLength?.toString(),
    "Content-Disposition": 'inline; filename="payment-proof.webp"',
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  });
  await pipeline(object.Body, res);
});
ownerOrdersRouter.patch("/:id/status", async (req, res) => {
  const { storeId } = await repository.updateOwnerOrder(
    req.auth!.userId,
    idSchema.parse(req.params.id),
    updateOrderStatusSchema.parse(req.body),
  );
  emitOrdersChanged(storeId);
  res.sendStatus(204);
});
ownerOrdersRouter.patch("/:id/payment", async (req, res) => {
  const { storeId } = await repository.updateOwnerOrderPayment(
    req.auth!.userId,
    idSchema.parse(req.params.id),
    updatePaymentStatusSchema.parse(req.body).status,
  );
  emitOrdersChanged(storeId);
  res.sendStatus(204);
});

router.post("/", async (req, res) => {
  if (req.is("multipart/form-data"))
    throw new AppError(400, "File uploads are not available at checkout");
  const input = createOrderSchema.parse(req.body);
  const result = await repository.createPublicOrder(input);
  if (result.created) emitOrdersChanged(result.order.storeId);
  res.status(201).json({ order: result.order });
});

router.post(
  "/:trackingToken/payment-proof",
  express.raw({ type: "multipart/form-data", limit: "6mb" }),
  async (req, res) => {
    const token = z.uuid().safeParse(req.params.trackingToken);
    if (!token.success) throw new AppError(404, "Order not found");
    await repository.assertPublicPaymentProofAllowed(token.data);
    const contentType = req.headers["content-type"];
    if (!contentType?.toLowerCase().startsWith("multipart/form-data;"))
      throw new AppError(400, "Choose a payment proof image to upload");
    if (!Buffer.isBuffer(req.body))
      throw new AppError(400, "Choose a payment proof image to upload");

    let form: FormData;
    try {
      form = await new Request("http://localhost", {
        method: "POST",
        headers: { "content-type": contentType },
        body: new Uint8Array(req.body),
      }).formData();
    } catch {
      throw new AppError(400, "The payment proof upload is invalid");
    }
    const entries = [...form.entries()];
    const file = form.get("proof");
    if (
      entries.length !== 1 ||
      !(file instanceof File) ||
      file.size === 0 ||
      file.size > 5 * 1024 * 1024
    )
      throw new AppError(400, "Choose one image up to 5 MB");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
      throw new AppError(400, "Use a JPG, PNG, or WebP image");

    let image: Buffer;
    try {
      const input = Buffer.from(await file.arrayBuffer());
      const pipeline = sharp(input, { limitInputPixels: 20_000_000 });
      const metadata = await pipeline.metadata();
      if (
        !metadata.width ||
        !metadata.height ||
        !["jpeg", "png", "webp"].includes(metadata.format ?? "")
      )
        throw new Error("Unsupported image");
      const matchesType =
        (file.type === "image/jpeg" && metadata.format === "jpeg") ||
        (file.type === "image/png" && metadata.format === "png") ||
        (file.type === "image/webp" && metadata.format === "webp");
      if (!matchesType) throw new Error("Image content does not match type");
      image = await sharp(input, { limitInputPixels: 20_000_000 })
        .rotate()
        .webp({ quality: 82 })
        .toBuffer();
    } catch {
      throw new AppError(
        400,
        "That image could not be read. Choose a JPG, PNG, or WebP image.",
      );
    }

    const id = randomUUID();
    const objectKey = `images/proofs/${token.data}/${id}.webp`;
    await writePaymentProof(objectKey, image);
    try {
      const result = await repository.savePublicPaymentProof({
        trackingToken: token.data,
        id,
        objectKey,
        fileName: "payment-proof.webp",
        sizeBytes: image.length,
      });
      if (result.previousObjectKey)
        await deletePrivateOrderFile(result.previousObjectKey).catch(() => {});
      emitOrdersChanged(result.storeId);
      res.status(201).json({ uploadedAt: new Date().toISOString() });
    } catch (error) {
      await deletePrivateOrderFile(objectKey).catch(() => {});
      throw error;
    }
  },
);

router.get("/:trackingToken", async (req, res) => {
  const token = req.params.trackingToken;
  if (!/^[0-9a-f-]{36}$/i.test(token))
    throw new AppError(404, "Order not found");
  const [order, paymentProof] = await Promise.all([
    repository.getPublicOrder(token),
    repository.getPublicPaymentProof(token),
  ]);
  res.json({ order: { ...order, paymentProof } });
});

export default router;
