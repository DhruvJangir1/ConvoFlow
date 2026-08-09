import { verifyToken, createClerkClient } from '@clerk/backend';

const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
export interface ClerkTokenPayload {
  sub: string;
}

export interface ClerkUserInfo {
  emailAddress: string;
}

export async function verifyClerkToken(token: string): Promise<ClerkTokenPayload> {
  console.log('[auth] verifyClerkToken called');
  const payload = await verifyToken(token, {
    secretKey: process.env.CLERK_SECRET_KEY,
  });
  console.log('[auth] verifyToken succeeded — sub:', payload.sub);
  return { sub: payload.sub };
}

export async function fetchClerkUser(clerkId: string): Promise<ClerkUserInfo> {
  console.log('[auth] fetchClerkUser called for clerkId:', clerkId);
  const clerkUser = await clerkClient.users.getUser(clerkId);
  console.log('[auth] Clerk API returned user:', clerkUser.id);

  const primaryEmail = clerkUser.emailAddresses.find(
    (ea) => ea.id === clerkUser.primaryEmailAddressId,
  );

  if (!primaryEmail){
    console.log('no primary email found from user!')
    return { emailAddress : '' };
  }

  if (!primaryEmail.emailAddress){
    console.log('no user email address found!');
    return { emailAddress:''};
  }

  console.log('[auth] Primary email:', primaryEmail.emailAddress);

  return { emailAddress: primaryEmail.emailAddress };
}
