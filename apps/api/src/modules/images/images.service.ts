import { randomUUID } from "node:crypto";
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import sharp from "sharp";
import { env } from "../../config/env.js";
import { AppError } from "../../middleware/errors.js";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const imageNamePattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/;
export const imagePrefixPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export type ImageKind = "logo" | "banner" | "product" | "payment-qr";

const uploadPrefix = env.IMAGE_PREFIX ?? env.NODE_ENV;

export function imageObjectKey(name: string, prefix?: string) {
  if (
    !imageNamePattern.test(name) ||
    (prefix && (!imagePrefixPattern.test(prefix) || prefix.length > 32))
  )
    throw new AppError(404, "Image not found");
  return prefix ? `images/${prefix}/${name}` : `images/${name}`;
}

let client: S3Client | undefined;

function storage() {
  if (
    !env.R2_ENDPOINT ||
    !env.R2_BUCKET_NAME ||
    !env.R2_ACCESS_KEY_ID ||
    !env.R2_SECRET_ACCESS_KEY
  )
    throw new AppError(503, "R2 image storage is not configured");

  client ??= new S3Client({
    region: "auto",
    endpoint: env.R2_ENDPOINT,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
    maxAttempts: 2,
  });
  return { client, bucket: env.R2_BUCKET_NAME };
}

function missingObject(error: unknown) {
  return (
    error instanceof Error &&
    (error.name === "NoSuchKey" || error.name === "NotFound")
  );
}

export async function prepareImage(bytes: Buffer, kind: ImageKind) {
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES)
    throw new AppError(413, "Choose an image smaller than 5 MB");
  try {
    const image = sharp(bytes, {
      failOn: "error",
      limitInputPixels: 25_000_000,
    });
    const metadata = await image.metadata();
    if (!["jpeg", "png", "webp"].includes(metadata.format ?? ""))
      throw new AppError(415, "Use a JPG, PNG, or WebP image");
    return await image
      .rotate()
      .resize({
        width: kind === "banner" ? 1920 : kind === "product" ? 1600 : 1000,
        height: kind === "banner" ? 1080 : kind === "product" ? 1600 : 1000,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 82 })
      .toBuffer();
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(400, "This image could not be processed");
  }
}

export async function uploadImage(bytes: Buffer, kind: ImageKind) {
  const image = await prepareImage(bytes, kind);
  const name = `${randomUUID()}.webp`;
  const { client, bucket } = storage();
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: imageObjectKey(name, uploadPrefix),
      Body: image,
      ContentType: "image/webp",
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
  return { url: `/api/images/${uploadPrefix}/${name}` };
}

export async function readImage(name: string, prefix?: string) {
  const key = imageObjectKey(name, prefix);
  const { client, bucket } = storage();
  try {
    return await client.send(
      new GetObjectCommand({ Bucket: bucket, Key: key }),
    );
  } catch (error) {
    if (!missingObject(error)) throw error;
    throw new AppError(404, "Image not found");
  }
}
