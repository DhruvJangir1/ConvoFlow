import type { Request, Response, NextFunction } from 'express';
import { verifyClerkToken, fetchClerkUser } from '../lib/auth.js';
import { prisma } from '../lib/connectionPoolClient.js';
import { getAdminClient } from '../supabase/admin.js';

declare module 'express-serve-static-core' {
  interface Request {
    user?: {
      id: string;
      email: string;
    };
  }
}

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  console.log('[authenticate] ── Incoming request ──');

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer')) {
    console.log('[authenticate] ✗ No/malformed Authorization header');
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const token = authHeader.slice(7);
  console.log(`[authenticate] Token received (length: ${token.length})`);

  try {
    // Step 1: Verify Clerk JWT
    console.log('[authenticate] Step 1: Verifying Clerk JWT...');
    const payload = await verifyClerkToken(token);
    const clerkId = payload.sub;
    console.log(`[authenticate] ✓ Clerk ID: ${clerkId}`);

    if (!clerkId) {
      console.log('[authenticate] ✗ payload.sub is empty');
      res.status(401).json({ error: 'Invalid token payload' });
      return;
    }

    // Step 2: Look up existing user by clerk_id
    console.log('[authenticate] Step 2: Looking up user by clerk_id...');
    const existing = await prisma.users.findFirst({
      where: { clerk_id: clerkId },
      select: { id: true, email: true },
    });

    if (existing) {
      console.log(`[authenticate] ✓ Found existing user: id=${existing.id}, email=${existing.email}`);
      req.user = { id: existing.id, email: existing.email };
      next();
      return;
    }
    console.log('[authenticate] ✗ No user found by clerk_id — continuing to auto-provision');

    // Step 3: Fetch Clerk user info (email)
    console.log('[authenticate] Step 3: Fetching Clerk user info...');
    let clerkUser;
    try {
      clerkUser = await fetchClerkUser(clerkId);
    } catch (err) {
      console.error('[authenticate] ✗ Failed to fetch Clerk user:', err);
      res.status(500).json({ error: 'Failed to fetch user info from Clerk' });
      return;
    }

    const email = clerkUser.emailAddress;
    console.log(`[authenticate] Clerk email: "${email}"`);

    if (!email) {
      console.log('[authenticate] ✗ No email found for this Clerk account');
      res.status(401).json({ error: 'No email found for this Clerk account' });
      return;
    }

    // Step 4: Check for existing user by email (link clerk_id)
    console.log('[authenticate] Step 4: Looking up user by email...');
    const byEmail = await prisma.users.findFirst({
      where: { email },
      select: { id: true, email: true },
    });

    if (byEmail) {
      console.log(`[authenticate] Found user by email: id=${byEmail.id} — linking clerk_id`);
      await prisma.users.update({
        where: { id: byEmail.id },
        data: { clerk_id: clerkId },
      });
      console.log(`[authenticate] ✓ Linked clerk_id to user ${byEmail.id}`);
      req.user = { id: byEmail.id, email: byEmail.email };
      next();
      return;
    }
    console.log('[authenticate] ✗ No user found by email — proceeding to create new user');

    // Step 5: Auto-provision via Supabase + Prisma
    console.log('[authenticate] Step 5: Auto-provisioning new user...');
    try {
      console.log('[authenticate] Getting Supabase admin client...');
      const supabase = getAdminClient();

      console.log('[authenticate] Calling supabase.auth.admin.createUser...');
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        email_confirm: true,
      });

      if (authError || !authData.user) {
        console.error('[authenticate] ✗ Supabase createUser failed:', authError);
        res.status(500).json({ error: 'Failed to create auth user' });
        return;
      }
      console.log(`[authenticate] ✓ Supabase auth user created: ${authData.user.id}`);

      const authUserId = authData.user.id;

      // Generate unique tag
      const username = email.split('@')[0] || 'user';
      let tag = username;
      let suffix = 1;
      console.log(`[authenticate] Generating unique tag for "${username}"...`);
      while (true) {
        const dup = await prisma.users.findFirst({ where: { user_tag: tag }, select: { id: true } });
        if (!dup) break;
        tag = `${username}${suffix}`;
        suffix++;
      }
      console.log(`[authenticate] Tag assigned: "${tag}"`);

      // Create clerkUsers row
      console.log('[authenticate] Creating clerkUsers row...');
      await prisma.clerkUsers.upsert({
        where: { clerk_id: clerkId },
        create: { clerk_id: clerkId, email },
        update: {},
      });
      console.log('[authenticate] ✓ clerkUsers row created');

      // Create USERS row
      console.log('[authenticate] Creating USERS row...');
      const newUser = await prisma.users.create({
        data: {
          id: authUserId,
          user_name: username,
          email,
          user_tag: tag,
          clerk_id: clerkId,
          is_verified: true,
        },
        select: { id: true, email: true },
      });

      console.log(`[authenticate] ✓ Auto-provisioned user: id=${newUser.id}, email=${newUser.email}`);
      req.user = { id: newUser.id, email: newUser.email };
      next();
    } catch (adminErr) {
      console.error('[authenticate] ✗ Supabase admin error:', adminErr);
      res.status(500).json({ error: 'Auth provisioning unavailable — check server configuration' });
      return;
    }
  } catch (err) {
    console.error('[authenticate] ✗ Unexpected error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
