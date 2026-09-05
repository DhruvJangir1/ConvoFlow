import { resolveImageUrl } from '../services/imageUpload.js';

export async function signSenderImage(
  image_url: string | null
): Promise<string | null> {
  if (!image_url) return null;
  try {
    return await resolveImageUrl(image_url);
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
