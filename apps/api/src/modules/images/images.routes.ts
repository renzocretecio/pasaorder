import { Router, raw, type Request, type Response } from "express";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { requireAuth } from "../../middleware/auth.js";
import { AppError } from "../../middleware/errors.js";
import {
  MAX_IMAGE_BYTES,
  readImage,
  uploadImage,
  type ImageKind,
} from "./images.service.js";

const router = Router();
const imageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

router.post(
  "/",
  requireAuth,
  (req, _res, next) => {
    if (
      !imageTypes.has(
        req.get("content-type")?.split(";")[0].toLowerCase() ?? "",
      )
    )
      next(new AppError(415, "Use a JPG, PNG, or WebP image"));
    else next();
  },
  raw({ type: () => true, limit: MAX_IMAGE_BYTES }),
  async (req, res) => {
    const kind = req.get("x-image-kind");
    if (kind !== "logo" && kind !== "banner" && kind !== "product")
      throw new AppError(400, "Choose a logo, banner, or product image");
    if (!Buffer.isBuffer(req.body))
      throw new AppError(400, "Choose an image to upload");
    res.status(201).json(await uploadImage(req.body, kind as ImageKind));
  },
);

async function serveImage(req: Request, res: Response) {
  const object = await readImage(
    String(req.params.name),
    req.params.prefix ? String(req.params.prefix) : undefined,
  );
  if (!(object.Body instanceof Readable))
    throw new AppError(502, "Image is unavailable");
  res.set({
    "Content-Type": "image/webp",
    "Content-Length": object.ContentLength?.toString(),
    "Cache-Control": "public, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
  });
  await pipeline(object.Body, res);
}

router.get("/:prefix/:name", serveImage);
router.get("/:name", serveImage);

export default router;
