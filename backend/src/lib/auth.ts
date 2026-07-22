import { verifyToken, createClerkClient } from '@clerk/backend';

const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

export interface ClerkTokenPayload {
  sub: string;
}

export interface ClerkUserInfo {
  emailAddress: string;
}

export async function verifyClerkToken(token: string): Promise<ClerkTokenPayload> {
  const payload = await verifyToken(token, {
    secretKey: process.env.CLERK_SECRET_KEY,
  });

  return { sub: payload.sub };
}

export async function fetchClerkUser(clerkId: string): Promise<ClerkUserInfo> {
  const clerkUser = await clerkClient.users.getUser(clerkId);

  const primaryEmail = clerkUser.emailAddresses.find(
    (ea) => ea.id === clerkUser.primaryEmailAddressId,
  );

  return { emailAddress: primaryEmail?.emailAddress ?? '' };
}
