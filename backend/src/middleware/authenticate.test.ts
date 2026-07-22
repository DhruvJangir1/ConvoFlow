import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockVerifyClerkToken, mockFetchClerkUser, mockPrisma, mockGetAdminClient } = vi.hoisted(() => {
  const mockVerifyClerkToken = vi.fn();
  const mockFetchClerkUser = vi.fn();

  const mockPrisma = {
    users: {
      findFirst: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    clerkUsers: {
      upsert: vi.fn(),
    },
  };

  const mockGetAdminClient = vi.fn();

  return { mockVerifyClerkToken, mockFetchClerkUser, mockPrisma, mockGetAdminClient };
});

vi.mock('../lib/auth.js', () => ({
  verifyClerkToken: (...args: unknown[]) => mockVerifyClerkToken(...args),
  fetchClerkUser: (...args: unknown[]) => mockFetchClerkUser(...args),
}));

vi.mock('../lib/connectionPoolClient.js', () => ({
  prisma: mockPrisma,
}));

vi.mock('../supabase/admin.js', () => ({
  getAdminClient: (...args: unknown[]) => mockGetAdminClient(...args),
}));

import { authenticate } from './authenticate';
import type { Request, Response, NextFunction } from 'express';

function createReq(authHeader?: string) {
  return {
    headers: authHeader ? { authorization: authHeader } : {},
    user: undefined,
  } as unknown as Request;
}

function createRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
}

const next = vi.fn() as NextFunction;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('authenticate middleware', () => {
  describe('missing or malformed authorization header', () => {
    it('returns 401 when no authorization header', async () => {
      const req = createReq();
      const res = createRes();

      await authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' });
      expect(next).not.toHaveBeenCalled();
    });

    it('returns 401 when header does not start with Bearer', async () => {
      const req = createReq('Basic abc123');
      const res = createRes();

      await authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('token verification', () => {
    it('returns 500 when token verification throws', async () => {
      mockVerifyClerkToken.mockRejectedValue(new Error('invalid token'));
      const req = createReq('Bearer bad-token');
      const res = createRes();

      await authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
      expect(next).not.toHaveBeenCalled();
    });

    it('returns 401 when token payload has no sub', async () => {
      mockVerifyClerkToken.mockResolvedValue({ sub: '' });
      const req = createReq('Bearer valid-token');
      const res = createRes();

      await authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token payload' });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('existing user by clerk_id', () => {
    it('sets req.user and calls next when user found by clerk_id', async () => {
      mockVerifyClerkToken.mockResolvedValue({ sub: 'clerk_abc' });
      mockPrisma.users.findFirst.mockResolvedValue({ id: 'uuid-1', email: 'alice@test.com' });

      const req = createReq('Bearer valid-token');
      const res = createRes();

      await authenticate(req, res, next);

      expect(mockPrisma.users.findFirst).toHaveBeenCalledWith({
        where: { clerk_id: 'clerk_abc' },
        select: { id: true, email: true },
      });
      expect(req.user).toEqual({ id: 'uuid-1', email: 'alice@test.com' });
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('Clerk user fetch failure', () => {
    it('returns 500 when fetchClerkUser throws', async () => {
      mockVerifyClerkToken.mockResolvedValue({ sub: 'clerk_abc' });
      mockPrisma.users.findFirst.mockResolvedValue(null);
      mockFetchClerkUser.mockRejectedValue(new Error('Clerk API error'));

      const req = createReq('Bearer valid-token');
      const res = createRes();

      await authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Failed to fetch user info from Clerk' });
      expect(next).not.toHaveBeenCalled();
    });

    it('returns 401 when Clerk user has no email', async () => {
      mockVerifyClerkToken.mockResolvedValue({ sub: 'clerk_abc' });
      mockPrisma.users.findFirst.mockResolvedValue(null);
      mockFetchClerkUser.mockResolvedValue({ emailAddress: '' });

      const req = createReq('Bearer valid-token');
      const res = createRes();

      await authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'No email found for this Clerk account' });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('link clerk_id to existing user by email', () => {
    it('links clerk_id and calls next when user found by email', async () => {
      mockVerifyClerkToken.mockResolvedValue({ sub: 'clerk_abc' });
      mockPrisma.users.findFirst
        .mockResolvedValueOnce(null)  // first call: by clerk_id
        .mockResolvedValueOnce({ id: 'uuid-2', email: 'bob@test.com' });  // second call: by email
      mockFetchClerkUser.mockResolvedValue({ emailAddress: 'bob@test.com' });
      mockPrisma.users.update.mockResolvedValue({});

      const req = createReq('Bearer valid-token');
      const res = createRes();

      await authenticate(req, res, next);

      expect(mockPrisma.users.update).toHaveBeenCalledWith({
        where: { id: 'uuid-2' },
        data: { clerk_id: 'clerk_abc' },
      });
      expect(req.user).toEqual({ id: 'uuid-2', email: 'bob@test.com' });
      expect(next).toHaveBeenCalled();
    });
  });

  describe('auto-provision new user', () => {
    it('creates Supabase auth user, clerkUsers, and users', async () => {
      mockVerifyClerkToken.mockResolvedValue({ sub: 'clerk_abc' });
      mockPrisma.users.findFirst
        .mockResolvedValueOnce(null)   // by clerk_id
        .mockResolvedValueOnce(null)   // by email
        .mockResolvedValueOnce(null);  // tag check
      mockFetchClerkUser.mockResolvedValue({ emailAddress: 'newuser@test.com' });

      const mockSupabase = {
        auth: {
          admin: {
            createUser: vi.fn().mockResolvedValue({
              data: { user: { id: 'supabase-uuid-1' } },
              error: null,
            }),
          },
        },
      };
      mockGetAdminClient.mockReturnValue(mockSupabase);

      mockPrisma.clerkUsers.upsert.mockResolvedValue({});
      mockPrisma.users.create.mockResolvedValue({ id: 'supabase-uuid-1', email: 'newuser@test.com' });

      const req = createReq('Bearer valid-token');
      const res = createRes();

      await authenticate(req, res, next);

      expect(mockSupabase.auth.admin.createUser).toHaveBeenCalledWith({
        email: 'newuser@test.com',
        email_confirm: true,
      });
      expect(mockPrisma.clerkUsers.upsert).toHaveBeenCalledWith({
        where: { clerk_id: 'clerk_abc' },
        create: { clerk_id: 'clerk_abc', email: 'newuser@test.com' },
        update: {},
      });
      expect(mockPrisma.users.create).toHaveBeenCalledWith({
        data: {
          id: 'supabase-uuid-1',
          user_name: 'newuser',
          email: 'newuser@test.com',
          user_tag: 'newuser',
          clerk_id: 'clerk_abc',
          is_verified: true,
        },
        select: { id: true, email: true },
      });
      expect(req.user).toEqual({ id: 'supabase-uuid-1', email: 'newuser@test.com' });
      expect(next).toHaveBeenCalled();
    });

    it('returns 500 when Supabase createUser fails', async () => {
      mockVerifyClerkToken.mockResolvedValue({ sub: 'clerk_abc' });
      mockPrisma.users.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      mockFetchClerkUser.mockResolvedValue({ emailAddress: 'fail@test.com' });

      const mockSupabase = {
        auth: {
          admin: {
            createUser: vi.fn().mockResolvedValue({
              data: { user: null },
              error: { message: 'duplicate email' },
            }),
          },
        },
      };
      mockGetAdminClient.mockReturnValue(mockSupabase);

      const req = createReq('Bearer valid-token');
      const res = createRes();

      await authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Failed to create auth user' });
      expect(next).not.toHaveBeenCalled();
    });

    it('increments tag when first choice is taken', async () => {
      mockVerifyClerkToken.mockResolvedValue({ sub: 'clerk_abc' });
      mockPrisma.users.findFirst
        .mockResolvedValueOnce(null)  // by clerk_id
        .mockResolvedValueOnce(null)  // by email
        .mockResolvedValueOnce({ id: 'existing' })  // tag collision: 'alice'
        .mockResolvedValueOnce(null); // tag 'alice1' is free
      mockFetchClerkUser.mockResolvedValue({ emailAddress: 'alice@test.com' });

      const mockSupabase = {
        auth: {
          admin: {
            createUser: vi.fn().mockResolvedValue({
              data: { user: { id: 'sb-uuid' } },
              error: null,
            }),
          },
        },
      };
      mockGetAdminClient.mockReturnValue(mockSupabase);

      mockPrisma.clerkUsers.upsert.mockResolvedValue({});
      mockPrisma.users.create.mockResolvedValue({ id: 'sb-uuid', email: 'alice@test.com' });

      const req = createReq('Bearer valid-token');
      const res = createRes();

      await authenticate(req, res, next);

      expect(mockPrisma.users.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ user_tag: 'alice1' }),
        }),
      );
      expect(next).toHaveBeenCalled();
    });
  });
});
