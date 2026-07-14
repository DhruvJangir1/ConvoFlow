import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import { s3Client } from '../supabase/supabaseS3Client.js';

function normalizeEnvVar(value?: string): string | undefined {
  return value?.replace(/^['"]|['"]$/g, '');
}

export interface ImageUploadInput {
  userId: string;
  fileName: string;
  base64Data?: string;
  contentType?: string;
  buffer?: Buffer;
}

export interface ImageUploadResult {
  url: string;
  path: string;
}

const SUPPORTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'image/avif'];

export function normalizeUploadBuffer(input: ImageUploadInput) {
  if (input.buffer) {
    const contentType = input.contentType || 'image/png';
    if (!SUPPORTED_IMAGE_TYPES.includes(contentType.toLowerCase())) {
      throw new Error(`Unsupported image type: ${contentType}`);
    }

    if (input.buffer.length === 0) {
      throw new Error('Decoded image buffer is empty');
    }

    return { buffer: input.buffer, contentType };
  }

  if (!input.base64Data) {
    throw new Error('No image data provided');
  }

  const match = input.base64Data.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  const cleanedBase64 = match ? match[2] : input.base64Data;
  const contentType = match?.[1] ?? input.contentType ?? 'image/png';

  if (!SUPPORTED_IMAGE_TYPES.includes(contentType.toLowerCase())) {
    throw new Error(`Unsupported image type: ${contentType}`);
  }

  const buffer = Buffer.from(cleanedBase64, 'base64');
  if (buffer.length === 0) {
    throw new Error('Decoded image buffer is empty');
  }

  return { buffer, contentType };
}

export function buildStorageObjectPath(userId: string, fileName: string, contentType: string): string {
  const safeFileName = fileName
    .replace(/\\/g, '/')
    .split('/')
    .filter(Boolean)
    .pop()
    ?.replace(/[^a-zA-Z0-9._-]/g, '-') || `image-${Date.now()}`;

  const extension = safeFileName.includes('.')
    ? safeFileName.slice(safeFileName.lastIndexOf('.'))
    : `.${contentType.split('/').pop() || 'png'}`;

  return `${userId}/${Date.now()}-${randomUUID()}-${safeFileName.replace(/\.[^.]+$/, '')}${extension}`;
}

let cachedBucketName: string | null = null;

async function resolveBucketName(): Promise<string> {
  if (cachedBucketName) {
    return cachedBucketName;
  }

  const configuredBucket =
    normalizeEnvVar(process.env.SUPABASE_S3_BUCKET_NAME) ||
    normalizeEnvVar(process.env.SUPABASE_STORAGE_BUCKET);
  if (configuredBucket) {
    cachedBucketName = configuredBucket;
    return configuredBucket;
  }

  throw new Error('No Supabase storage bucket could be resolved. Set SUPABASE_S3_BUCKET_NAME or SUPABASE_STORAGE_BUCKET.');
}

const SIGNED_URL_EXPIRES_IN = 3600;

export async function signImageUrl(key: string): Promise<string> {
  const bucket = await resolveBucketName();
  return getSignedUrl(
    s3Client,
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn: SIGNED_URL_EXPIRES_IN },
  );
}

export async function uploadImageToStorage(input: ImageUploadInput): Promise<ImageUploadResult> {
  const { buffer, contentType } = normalizeUploadBuffer(input);
  const storagePath = buildStorageObjectPath(input.userId, input.fileName, contentType);
  const bucket = await resolveBucketName();

  await s3Client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: storagePath,
    Body: buffer,
    ContentType: contentType,
  }));

  const signedUrl = await signImageUrl(storagePath);

  return {
    url: signedUrl,
    path: storagePath,
  };
}