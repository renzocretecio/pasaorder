import { Router } from "express";
import {
  createOrderSchema,
  idSchema,
  updatePaymentStatusSchema,
  updateOrderStatusSchema,
} from "@pasaorder/validation";
import { AppError } from "../../middleware/errors.js";
import { requireAuth } from "../../middleware/auth.js";
import * as repository from "./orders.repository.js";
import { emitOrdersChanged } from "../../realtime/socket.js";

const router = Router();
export const ownerOrdersRouter = Router();

ownerOrdersRouter.use(requireAuth);
ownerOrdersRouter.get("/", async (req, res) => {
  const storeId =
    req.query.storeId === undefined
      ? undefined
      : idSchema.parse(req.query.storeId);
  res.json({
    orders: await repository.listOwnerOrders(req.auth!.userId, storeId),
  });
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
  const input = createOrderSchema.parse(req.body);
  const result = await repository.createPublicOrder(input);
  if (result.created) emitOrdersChanged(result.order.storeId);
  res.status(201).json({ order: result.order });
});

router.get("/:trackingToken", async (req, res) => {
  const token = req.params.trackingToken;
  if (!/^[0-9a-f-]{36}$/i.test(token))
    throw new AppError(404, "Order not found");
  res.json({ order: await repository.getPublicOrder(token) });
});

export default router;
