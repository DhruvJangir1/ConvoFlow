import { resolveImageUrl } from '../services/imageUpload.js';

export async function signSenderImage(
  image_url: string | null
): Promise<string | null> {
  if (!image_url) {
    console.log('[chatImageHelpers:signSenderImage] no image_url: 0ms');
    return null;
  }
  const start = performance.now();
  try {
    const result = await resolveImageUrl(image_url);
    console.log(`[chatImageHelpers:signSenderImage] total: ${Math.round(performance.now() - start)}ms`);
    return result;
  } catch {
    console.error('[chatImageHelpers] Failed to sign sender image:', image_url);
    return null;
  }
}

export async function signMemberImages<T extends { image_url: string | null }>(
  members: T[]
): Promise<T[]> {
  return Promise.all(
    members.map(async (m) => ({
      ...m,
      image_url: await signSenderImage(m.image_url),
    }))
  );
}

export async function signChatAvatar(
  avatar_url: string | null,
  fallbackImage: string | null
): Promise<string | null> {
  const target = avatar_url || fallbackImage;
  return signSenderImage(target);
}
