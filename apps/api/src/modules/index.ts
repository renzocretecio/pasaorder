import { Router } from "express";

import authRoutes from "./auth/auth.routes.js";
import imagesRoutes from "./images/images.routes.js";
import orderRoutes, {
  ownerOrdersRouter,
  publicChatRouter,
} from "./orders/orders.routes.js";

import catalogRoutes, {
  publicCatalogRouter,
} from "./catalog/catalog.routes.js";
import metaRoutes, { ownerMetaRouter } from "./meta/meta.routes.js";

const router = Router();
router.use("/catalog", catalogRoutes);
router.use("/public/stores", publicCatalogRouter);
router.use("/public/orders", orderRoutes);
router.use("/public/chats", publicChatRouter);
router.use("/orders", ownerOrdersRouter);
router.use("/meta", metaRoutes);
router.use("/meta", ownerMetaRouter);

router.use("/auth", authRoutes);
router.use("/images", imagesRoutes);

export default router;
