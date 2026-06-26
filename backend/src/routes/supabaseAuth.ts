import { Request, Response } from "express";
import { Prisma } from "../../../src/generated/prisma/client";
import { prisma } from "../lib/connectionPoolClient";
import adminClient from "../supabase/admin";
import { PRISMA_SAFE_SELECT } from "../util/constants";
import { insertPayloadType } from "../types/authTypes";

export type CreateAuthUserResult =
  | { success: true; userId: string }
  | { success: false; status: number; error: string };

export async function createNewSupabaseAuthUser(email: string, password: string, user_name: string): Promise<CreateAuthUserResult> {
  const { data: authCreateData, error: authCreateError } = await adminClient.auth.admin.createUser({
    email: email.trim().toLowerCase(),
    password,
    user_metadata: { user_name },
  });

  if (authCreateError) {
    const msg = authCreateError.message ?? 'Failed to create auth user';
    const conflict = /already|exists|duplicate/i.test(msg);
    return { success: false, status: conflict ? 409 : 500, error: msg };
  }

  const createdUser = authCreateData as
    | { id: string; email?: string }
    | { user: { id: string; email?: string } }
    | null;

  if (!createdUser) {
    return { success: false, status: 500, error: 'Failed to create auth user' };
  }

  const userId = 'user' in createdUser ? createdUser.user.id : createdUser.id;
  return { success: true, userId };
}

export async function createNewSupabaseUser(req: Request, res: Response, authResult: CreateAuthUserResult, insertPayload: insertPayloadType) {
  if (!authResult.success) {
    return;
  }

  try {
    const newUser = await prisma.users.create({
      data: insertPayload,
      select: PRISMA_SAFE_SELECT,
    });

    console.log('[/signup] insert success, user created:', newUser.id);

    return newUser;
  } catch (insertError: unknown) {
    try {
      await adminClient.auth.admin.deleteUser(authResult.userId);
    } catch (delErr) {
      console.error('[/signup] failed to delete auth user during rollback:', delErr);
    }

    if (insertError instanceof Prisma.PrismaClientKnownRequestError && insertError.code === 'P2002') {
      res.status(409).json({ error: 'Username or email already exists.' });
      return;
    }

    const message = insertError instanceof Error ? insertError.message : 'Failed to create user';
    res.status(500).json({ error: message });
  }
}
