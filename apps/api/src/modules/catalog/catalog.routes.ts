import { Router } from "express";
import {
  setupStoreSchema,
  catalogStoreSettingsSchema,
  categorySchema,
  catalogItemSchema,
  publicationSchema,
  catalogOrderSchema,
  idSchema,
  slugSchema,
} from "@pasaorder/validation";
import { requireAuth } from "../../middleware/auth.js";
import * as repository from "./catalog.repository.js";
export const publicCatalogRouter = Router();
publicCatalogRouter.get("/:slug", async (req, res) => {
  res.json(await repository.readCatalog(slugSchema.parse(req.params.slug)));
});
const router = Router();
router.use(requireAuth);
router.get("/stores", async (req, res) => {
  res.json({ stores: await repository.listCatalogStores(req.auth!.userId) });
});
router.post("/setup", async (req, res) => {
  res
    .status(201)
    .json(
      await repository.setupStore(
        setupStoreSchema.parse(req.body),
        req.auth!.userId,
      ),
    );
});
router.patch("/default-store/:id", async (req, res) => {
  await repository.setDefaultStore(
    idSchema.parse(req.params.id),
    req.auth!.userId,
  );
  res.sendStatus(204);
});
router.get("/stores/:id", async (req, res) => {
  res.json(
    await repository.readCatalog(
      idSchema.parse(req.params.id),
      req.auth!.userId,
    ),
  );
});
router.patch("/stores/:id", async (req, res) => {
  await repository.settings(
    idSchema.parse(req.params.id),
    catalogStoreSettingsSchema.parse(req.body),
    req.auth!.userId,
  );
  res.sendStatus(204);
});
router.patch("/stores/:id/order", async (req, res) => {
  await repository.reorderCatalog(
    idSchema.parse(req.params.id),
    catalogOrderSchema.parse(req.body),
    req.auth!.userId,
  );
  res.sendStatus(204);
});
router.post("/stores/:id/categories", async (req, res) => {
  res
    .status(201)
    .json(
      await repository.saveCategory(
        idSchema.parse(req.params.id),
        undefined,
        categorySchema.parse(req.body),
        req.auth!.userId,
      ),
    );
});
router.patch("/stores/:id/categories/:categoryId", async (req, res) => {
  res.json(
    await repository.saveCategory(
      idSchema.parse(req.params.id),
      idSchema.parse(req.params.categoryId),
      categorySchema.parse(req.body),
      req.auth!.userId,
    ),
  );
});
router.post("/stores/:id/items", async (req, res) => {
  res
    .status(201)
    .json(
      await repository.saveItem(
        idSchema.parse(req.params.id),
        undefined,
        catalogItemSchema.parse(req.body),
        req.auth!.userId,
      ),
    );
});
router.patch("/stores/:id/items/:itemId", async (req, res) => {
  res.json(
    await repository.saveItem(
      idSchema.parse(req.params.id),
      idSchema.parse(req.params.itemId),
      catalogItemSchema.parse(req.body),
      req.auth!.userId,
    ),
  );
});
router.post("/stores/:id/publication", async (req, res) => {
  await repository.publish(
    idSchema.parse(req.params.id),
    publicationSchema.parse(req.body).isPublished,
    req.auth!.userId,
  );
  res.sendStatus(204);
});
export default router;
