import { S3Client } from '@aws-sdk/client-s3';

function normalizeEnvVar(value?: string): string | undefined {
  return value?.replace(/^['"]|['"]$/g, '');
}

const region = normalizeEnvVar(process.env.SUPABASE_PROJECT_REGION);
const endpoint = normalizeEnvVar(process.env.SUPABASE_S3_BUCKET_ENDPOINT);
const accessKeyId = normalizeEnvVar(process.env.SUPABASE_S3_ACCESS_KEY_ID) || '';
const secretAccessKey = normalizeEnvVar(process.env.SUPABASE_S3_SECRET_ACCESS_KEY) || '';

if (!endpoint || !accessKeyId || !secretAccessKey) {
  throw new Error('Missing S3 storage configuration. Check your S3 environment variables.');
}

export const s3Client = new S3Client({
  region,
  endpoint,
  forcePathStyle: true,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});

export const S3_BUCKET_NAME =
  normalizeEnvVar(process.env.SUPABASE_S3_BUCKET_NAME) ||
  normalizeEnvVar(process.env.SUPABASE_STORAGE_BUCKET) ||
  'chat-images';

export default s3Client;

