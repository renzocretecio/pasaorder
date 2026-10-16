import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { env } from "../../config/env.js";
import { AppError } from "../../middleware/errors.js";

let client: S3Client | undefined;

function storage() {
  const bucketName = env.R2_PRIVATE_BUCKET_NAME ?? env.R2_BUCKET_NAME;
  if (
    !env.R2_ENDPOINT ||
    !bucketName ||
    !env.R2_ACCESS_KEY_ID ||
    !env.R2_SECRET_ACCESS_KEY
  )
    throw new AppError(503, "Private order file storage is not configured");

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
  return { client, bucket: bucketName };
}

export async function readOrderAttachment(objectKey: string) {
  const { client: r2, bucket } = storage();
  return r2.send(new GetObjectCommand({ Bucket: bucket, Key: objectKey }));
}

export async function writePaymentProof(objectKey: string, bytes: Buffer) {
  const { client: r2, bucket } = storage();
  await r2.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      Body: bytes,
      ContentType: "image/webp",
      CacheControl: "private, no-store",
    }),
  );
}

export async function deletePrivateOrderFile(objectKey: string) {
  const { client: r2, bucket } = storage();
  await r2.send(new DeleteObjectCommand({ Bucket: bucket, Key: objectKey }));
}
