import assert from "node:assert/strict";
import { test } from "node:test";
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import sharp from "sharp";

process.env.NODE_ENV = "test";
process.env.DOTENV_CONFIG_PATH = "/dev/null";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
process.env.JWT_SECRET = "test-secret-only-for-tests-32-characters";
process.env.WEB_ORIGIN = "http://localhost:3000";

const { env } = await import("../src/config/env.js");
const { readImage, uploadImage } =
  await import("../src/modules/images/images.service.js");

test("images upload to and read from R2 using existing URL paths", async () => {
  const original = {
    R2_ENDPOINT: env.R2_ENDPOINT,
    R2_BUCKET_NAME: env.R2_BUCKET_NAME,
    R2_ACCESS_KEY_ID: env.R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY: env.R2_SECRET_ACCESS_KEY,
  };
  Object.assign(env, {
    R2_ENDPOINT: "https://example.r2.cloudflarestorage.com",
    R2_BUCKET_NAME: "r2-images",
    R2_ACCESS_KEY_ID: "r2-test-key",
    R2_SECRET_ACCESS_KEY: "r2-test-secret",
  });
  const originalSend = S3Client.prototype.send;
  const requests: { operation: string; bucket: string; key: string }[] = [];
  S3Client.prototype.send = (async (
    command: GetObjectCommand | PutObjectCommand,
  ) => {
    requests.push({
      operation: command instanceof PutObjectCommand ? "put" : "get",
      bucket: command.input.Bucket!,
      key: command.input.Key!,
    });
    if (command instanceof PutObjectCommand) return {};
    if (requests.length === 3) {
      const error = new Error("missing");
      error.name = "NoSuchKey";
      throw error;
    }
    return { ContentLength: 7 };
  }) as typeof S3Client.prototype.send;
  try {
    const bytes = await sharp({
      create: { width: 1, height: 1, channels: 3, background: "#ffffff" },
    })
      .png()
      .toBuffer();
    const uploaded = await uploadImage(bytes, "product");
    assert.match(uploaded.url, /^\/api\/images\/test\/.+\.webp$/);
    assert.deepEqual(requests[0], {
      operation: "put",
      bucket: "r2-images",
      key: `images/test/${uploaded.url.split("/").at(-1)}`,
    });
    await readImage("123e4567-e89b-12d3-a456-426614174000.webp", "production");
    assert.deepEqual(requests[1], {
      operation: "get",
      bucket: "r2-images",
      key: "images/production/123e4567-e89b-12d3-a456-426614174000.webp",
    });
    await assert.rejects(
      readImage("123e4567-e89b-12d3-a456-426614174000.webp"),
      { status: 404 },
    );
    assert.equal(requests.length, 3);
  } finally {
    S3Client.prototype.send = originalSend;
    Object.assign(env, original);
  }
});
