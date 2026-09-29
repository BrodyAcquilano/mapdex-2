// src/storage/storage.js

import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";

const R2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

async function uploadObject({ buffer, key, contentType }) {
  await R2.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );

  return `${process.env.R2_PUBLIC_BASE_URL}/${key}`;
}

async function removeObject(key) {
  await R2.send(
    new DeleteObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
    })
  );
}

async function getObjectBuffer(key) {
  const res = await R2.send(
    new GetObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
    })
  );

  if (!res.Body) {
    throw new Error("Storage object has no body.");
  }

  const chunks = [];

  for await (const chunk of res.Body) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
}

export const storage = {
  uploadObject,
  removeObject,
  getObjectBuffer,
};