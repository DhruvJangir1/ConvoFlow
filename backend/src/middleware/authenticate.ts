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
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer')) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const payload = await verifyClerkToken(token);

    const clerkId = payload.sub;

    if (!clerkId) {
      res.status(401).json({ error: 'Invalid token payload' });
      return;
    }

    const existing = await prisma.users.findFirst({
      where: { clerk_id: clerkId },
      select: { id: true, email: true },
    });

    if (existing) {
      req.user = { id: existing.id, email: existing.email };
      next();
      return;
    }

    let clerkUser;
    try {
      clerkUser = await fetchClerkUser(clerkId);
    } catch {
      console.error('[authenticate] Failed to fetch Clerk user');
      res.status(500).json({ error: 'Failed to fetch user info from Clerk' });
      return;
    }

    const email = clerkUser.emailAddress;

    if (!email) {
      res.status(401).json({ error: 'No email found for this Clerk account' });
      return;
    }

    const byEmail = await prisma.users.findFirst({
      where: { email },
      select: { id: true, email: true },
    });

    if (byEmail) {
      await prisma.users.update({
        where: { id: byEmail.id },
        data: { clerk_id: clerkId },
      });
      console.log(`[authenticate] Linked clerk_id ${clerkId} to existing user ${byEmail.id}`);
      req.user = { id: byEmail.id, email: byEmail.email };
      next();
      return;
    }

    try {
      const supabase = getAdminClient();
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        email_confirm: true,
      });

      if (authError || !authData.user) {
        console.error('[authenticate] Failed to create Supabase auth user:', authError);
        res.status(500).json({ error: 'Failed to create auth user' });
        return;
      }

      const authUserId = authData.user.id;

      const username = email.split('@')[0] || 'user';
      let tag = username;
      let suffix = 1;
      while (true) {
        const dup = await prisma.users.findFirst({ where: { user_tag: tag }, select: { id: true } });
        if (!dup) break;
        tag = `${username}${suffix}`;
        suffix++;
      }

      await prisma.clerkUsers.upsert({
        where: { clerk_id: clerkId },
        create: { clerk_id: clerkId, email },
        update: {},
      });

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

      console.log(`[authenticate] Auto-provisioned new user ${newUser.id} for clerk_id ${clerkId}`);
      req.user = { id: newUser.id, email: newUser.email };
      next();
    } catch (adminErr) {
      console.error('[authenticate] Supabase admin client unavailable:', adminErr);
      res.status(500).json({ error: 'Auth provisioning unavailable — check server configuration' });
      return;
    }
  } catch (err) {
    console.error('[authenticate] Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
