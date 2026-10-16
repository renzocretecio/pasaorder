import { Router } from "express";
import notificationsRoutes from "./notifications/notifications.routes.js";

import authRoutes from "./auth/auth.routes.js";
import imagesRoutes from "./images/images.routes.js";
import orderRoutes, { ownerOrdersRouter } from "./orders/orders.routes.js";

import catalogRoutes, {
  publicCatalogRouter,
} from "./catalog/catalog.routes.js";

const router = Router();
router.use("/catalog", catalogRoutes);
router.use("/public/stores", publicCatalogRouter);
router.use("/public/orders", orderRoutes);
router.use("/orders", ownerOrdersRouter);

router.use("/auth", authRoutes);
router.use("/images", imagesRoutes);
router.use("/notifications", notificationsRoutes);

export default router;
