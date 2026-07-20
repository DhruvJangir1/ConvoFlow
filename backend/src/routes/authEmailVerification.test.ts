import { describe, it, expect, vi, beforeEach, beforeAll, afterAll, type Mock } from 'vitest';
// =========================================================================
// Mock Setup (must be before imports due to hoisting)
// =========================================================================

const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    users: {
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
  };
  return { mockPrisma };
});

vi.mock('../lib/connectionPoolClient.js', () => ({ prisma: mockPrisma }));

vi.mock('../../redis/redisClient.js', () => ({
  client: {
    set: vi.fn(),
    get: vi.fn(),
    del: vi.fn(),
  },
  connectRedis: vi.fn(),
  disconnectRedis: vi.fn(),
}));

vi.mock('./supabaseAuth.js', () => ({
  createNewSupabaseAuthUser: vi.fn(),
  createNewSupabaseUser: vi.fn(),
}));

vi.mock('../services/auth.js', async () => {
  const actual = await vi.importActual<typeof import('../services/auth.js')>('../services/auth.js');
  return {
    hashPassword: vi.fn(),
    comparePassword: vi.fn(),
    signAccessToken: vi.fn(),
    verifyAccessToken: actual.verifyAccessToken,
    generateRefreshToken: vi.fn(),
    hashToken: vi.fn(),
    REFRESH_TOKEN_EXPIRY_MS: 30 * 24 * 60 * 60 * 1000, // 30 days in milliseconds
    checkPassword: vi.fn(),
    rotateRefreshToken: vi.fn(),
  };
});

vi.mock('../services/authVerificaiton.js', () => ({
  sendUserVerificationCode: vi.fn(),
  setAuthCookies: vi.fn(),
}));

vi.mock('../services/verificationStore.js', () => ({
  setVerificationCode: vi.fn(),
}));

vi.mock('../services/authCookieSessions.js', () => ({
  clearAuthCookies: vi.fn(),
}));

vi.mock('../services/rateLimiter.js', () => ({
  trackAuthAttempt: vi.fn(),
}));

vi.mock('dotenv', () => ({ default: { config: vi.fn() } }));

vi.mock('../supabase/supabaseS3Client.js', () => ({ s3Client: {}, S3_BUCKET_NAME: 'test-bucket' }));

vi.mock('../supabase/admin.js', () => ({
  getAdminClient: vi.fn(() => ({
    auth: {
      admin: {
        createUser: vi.fn(),
        deleteUser: vi.fn().mockResolvedValue({}),
      },
    },
  })),
}));

// =========================================================================
// Imports (after mocks)
// =========================================================================

import express, { Request, Response } from 'express';
import request from 'supertest';
import cookieParser from 'cookie-parser';

import AuthEmailVerificationRouter from './authEmailVerification';
import {
  createNewSupabaseAuthUser,
  createNewSupabaseUser,
} from './supabaseAuth';
import {
  hashPassword,
  generateRefreshToken,
} from '../services/auth';
import { sendUserVerificationCode } from '../services/authVerificaiton';
import { setVerificationCode } from '../services/verificationStore';
import { authenticate } from '../middleware/authenticate';

// =========================================================================
// App Setup
// =========================================================================

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/auth', AuthEmailVerificationRouter);

const mockNewUser = {
  id: 'auth-user-id-123',
  user_name: 'TestUser',
  email: 'test@example.com',
  created_at: new Date('2025-01-01'),
  user_tag: 'testuser#0001',
  is_verified: false,
  last_login: new Date(),
};

// =========================================================================
// Tests
// =========================================================================

describe('Sign-Up Route — POST /auth/signup', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: no existing user
    (mockPrisma.users.findFirst as Mock).mockResolvedValue(null);
    (mockPrisma.users.count as Mock).mockResolvedValue(0);
    (mockPrisma.users.create as Mock).mockResolvedValue(mockNewUser);

    (hashPassword as Mock).mockResolvedValue('$2a$12$hashedpassword');
    (generateRefreshToken as Mock).mockReturnValue({
      hash: '$2a$10$refreshhash',
      token: 'raw_refresh_token',
      salt: '$2a$10$salt',
    });
    (createNewSupabaseAuthUser as Mock).mockResolvedValue({
      success: true,
      userId: 'auth-user-id-123',
    });
    (createNewSupabaseUser as Mock).mockResolvedValue(mockNewUser);
    (sendUserVerificationCode as Mock).mockResolvedValue(undefined);
    (setVerificationCode as Mock).mockReturnValue(undefined);
  });

  // ========================================================================
  // 1. Input Validation
  // ========================================================================

  describe('Input Validation', () => {
    it('returns 400 when user_name is missing', async () => {
      const res = await request(app)
        .post('/auth/signup')
        .send({ email: 'test@example.com', password: 'password123' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('user_name, email, and password are required');
    });

    it('returns 400 when email is missing', async () => {
      const res = await request(app)
        .post('/auth/signup')
        .send({ user_name: 'TestUser', password: 'password123' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('user_name, email, and password are required');
    });

    it('returns 400 when password is missing', async () => {
      const res = await request(app)
        .post('/auth/signup')
        .send({ user_name: 'TestUser', email: 'test@example.com' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('user_name, email, and password are required');
    });

    it('returns 400 when all fields are missing', async () => {
      const res = await request(app)
        .post('/auth/signup')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('user_name, email, and password are required');
    });

    it('returns 400 when user_name is empty string', async () => {
      const res = await request(app)
        .post('/auth/signup')
        .send({ user_name: '   ', email: 'test@example.com', password: 'password123' });

      expect(res.status).toBe(400);
    });

    it('returns 400 for invalid email format', async () => {
      const res = await request(app)
        .post('/auth/signup')
        .send({ user_name: 'TestUser', email: 'not-an-email', password: 'password123' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid email format');
    });

    it('returns 400 for email without domain', async () => {
      const res = await request(app)
        .post('/auth/signup')
        .send({ user_name: 'TestUser', email: 'user@', password: 'password123' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid email format');
    });
  });

  // ========================================================================
  // 2. Uniqueness Checks
  // ========================================================================

  describe('Uniqueness Checks', () => {
    it('returns 409 when email is already registered', async () => {
      (mockPrisma.users.findFirst as Mock)
        .mockResolvedValueOnce({ id: 'existing-user-id' });

      const res = await request(app)
        .post('/auth/signup')
        .send({ user_name: 'TestUser', email: 'taken@example.com', password: 'password123' });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('Email already registered');
      expect(mockPrisma.users.findFirst).toHaveBeenCalledWith({
        where: { email: 'taken@example.com' },
        select: { id: true },
      });
    });

    it('returns 409 when username is already taken', async () => {
      (mockPrisma.users.findFirst as Mock)
        .mockResolvedValueOnce(null)   // email check passes
        .mockResolvedValueOnce({ id: 'existing-user-id' });  // username taken

      const res = await request(app)
        .post('/auth/signup')
        .send({ user_name: 'TakenName', email: 'new@example.com', password: 'password123' });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('Username already taken');
    });

    it('normalizes email to lowercase for uniqueness check', async () => {
      const res = await request(app)
        .post('/auth/signup')
        .send({ user_name: 'TestUser', email: 'TEST@EXAMPLE.COM', password: 'password123' });

      expect(mockPrisma.users.findFirst).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
        select: { id: true },
      });
      expect(res.status).not.toBe(409);
    });
  });

  // ========================================================================
  // 3. Supabase Auth User Creation
  // ========================================================================

  describe('Supabase Auth User Creation', () => {
    it('returns the error status when Supabase auth creation fails', async () => {
      (createNewSupabaseAuthUser as Mock).mockResolvedValue({
        success: false,
        status: 409,
        error: 'User already exists',
      });

      const res = await request(app)
        .post('/auth/signup')
        .send({ user_name: 'TestUser', email: 'test@example.com', password: 'password123' });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('User already exists');
    });

    it('returns 500 for generic Supabase auth failure', async () => {
      (createNewSupabaseAuthUser as Mock).mockResolvedValue({
        success: false,
        status: 500,
        error: 'Internal server error',
      });

      const res = await request(app)
        .post('/auth/signup')
        .send({ user_name: 'TestUser', email: 'test@example.com', password: 'password123' });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Internal server error');
    });
  });

  // ========================================================================
  // 4. Database Insert
  // ========================================================================

  describe('Database Insert', () => {
    it('returns 409 when createNewSupabaseUser signals a conflict', async () => {
      (createNewSupabaseUser as Mock).mockImplementation((_req: Request, res: Response) => {
        res.status(409).json({ error: 'Username or email already exists.' });
        return undefined;
      });

      const res = await request(app)
        .post('/auth/signup')
        .send({ user_name: 'TestUser', email: 'test@example.com', password: 'password123' });

      expect(res.status).toBe(409);
    });

    it('returns 500 when createNewSupabaseUser signals a server error', async () => {
      (createNewSupabaseUser as Mock).mockImplementation((_req: Request, res: Response) => {
        res.status(500).json({ error: 'Database insert failed' });
        return undefined;
      });

      const res = await request(app)
        .post('/auth/signup')
        .send({ user_name: 'TestUser', email: 'test@example.com', password: 'password123' });

      expect(res.status).toBe(500);
    });

    // failing
    it('returns early without sending email when createNewSupabaseUser returns null', async () => {
      (createNewSupabaseUser as Mock).mockResolvedValue(null);

      await request(app)
        .post('/auth/signup')
        .send({ user_name: 'TestUser', email: 'test@example.com', password: 'password123' });

      expect(sendUserVerificationCode).not.toHaveBeenCalled();
      expect(setVerificationCode).not.toHaveBeenCalled();
    });
  });

  // ========================================================================
  // 5. User Tag Generation
  // ========================================================================

  describe('User Tag Generation', () => {
    it('generates user_tag as username#0001 for the first user', async () => {
      (mockPrisma.users.count as Mock).mockResolvedValue(0);

      await request(app)
        .post('/auth/signup')
        .send({ user_name: 'TestUser', email: 'test@example.com', password: 'password123' });

      expect(createNewSupabaseUser).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ user_tag: 'testuser#0001' }),
      );
    });

    it('generates user_tag with correct padding for existing users', async () => {
      (mockPrisma.users.count as Mock).mockResolvedValue(99);

      await request(app)
        .post('/auth/signup')
        .send({ user_name: 'TestUser', email: 'test@example.com', password: 'password123' });

      expect(createNewSupabaseUser).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ user_tag: 'testuser#0100' }),
      );
    });

    it('lowercases username in user_tag', async () => {
      (mockPrisma.users.count as Mock).mockResolvedValue(0);

      await request(app)
        .post('/auth/signup')
        .send({ user_name: 'CamelCase', email: 'test@example.com', password: 'password123' });

      expect(createNewSupabaseUser).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ user_tag: 'camelcase#0001' }),
      );
    });
  });

  // ========================================================================
  // 6. Verification Code & Email
  // ========================================================================

  describe('Verification Code & Email', () => {
    it('stores a 6-digit verification code', async () => {
      await request(app)
        .post('/auth/signup')
        .send({ user_name: 'TestUser', email: 'test@example.com', password: 'password123' });

      expect(setVerificationCode).toHaveBeenCalledTimes(1);
      const [userId, code] = (setVerificationCode as Mock).mock.calls[0];
      expect(userId).toBe('auth-user-id-123');
      expect(code).toMatch(/^\d{6}$/);
    });

    it('sends verification email to the user', async () => {
      await request(app)
        .post('/auth/signup')
        .send({ user_name: 'TestUser', email: 'test@example.com', password: 'password123' });

      expect(sendUserVerificationCode).toHaveBeenCalledTimes(1);
      expect(sendUserVerificationCode).toHaveBeenCalledWith(
        'test@example.com',
        expect.stringMatching(/^\d{6}$/),
      );
    });

    it('returns 201 even when verification email fails to send', async () => {
      (sendUserVerificationCode as Mock).mockRejectedValue(
        new Error('Email service unavailable'),
      );

      const res = await request(app)
        .post('/auth/signup')
        .send({ user_name: 'TestUser', email: 'test@example.com', password: 'password123' });

      expect(res.status).toBe(201);
      expect(res.body.user.email).toBe('test@example.com');
    });

    it('still creates the user even when email sending fails', async () => {
      (sendUserVerificationCode as Mock).mockRejectedValue(
        new Error('Email service unavailable'),
      );

      await request(app)
        .post('/auth/signup')
        .send({ user_name: 'TestUser', email: 'test@example.com', password: 'password123' });

      expect(createNewSupabaseUser).toHaveBeenCalled();
      expect(setVerificationCode).toHaveBeenCalled();
    });
  });

  // ========================================================================
  // 7. Successful Signup (Full Flow)
  // ========================================================================

  describe('Successful Signup', () => {
    it('returns 201 with user DTO and verification_sent message', async () => {
      const res = await request(app)
        .post('/auth/signup')
        .send({ user_name: 'TestUser', email: 'test@example.com', password: 'password123' });

      expect(res.status).toBe(201);
      expect(res.body.message).toBe('verification_sent');
      expect(res.body.user).toBeDefined();
      expect(res.body.user.id).toBe('auth-user-id-123');
      expect(res.body.user.user_name).toBe('TestUser');
      expect(res.body.user.email).toBe('test@example.com');
      expect(res.body.user.user_tag).toBe('testuser#0001');
      expect(res.body.user.created_at).toBeDefined();
    });

    it('does not expose password or refresh token in response', async () => {
      const res = await request(app)
        .post('/auth/signup')
        .send({ user_name: 'TestUser', email: 'test@example.com', password: 'password123' });

      expect(res.body.user.password).toBeUndefined();
      expect(res.body.user.refresh_token_hash).toBeUndefined();
      expect(res.body.user.refresh_token_expiry).toBeUndefined();
    });

    it('hashes the password before storing', async () => {
      await request(app)
        .post('/auth/signup')
        .send({ user_name: 'TestUser', email: 'test@example.com', password: 'mysecretpassword' });

      expect(hashPassword).toHaveBeenCalledWith('mysecretpassword');
      expect(createNewSupabaseUser).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ password: '$2a$12$hashedpassword' }),
      );
    });

    it('generates a refresh token and stores its hash', async () => {
      await request(app)
        .post('/auth/signup')
        .send({ user_name: 'TestUser', email: 'test@example.com', password: 'password123' });

      expect(generateRefreshToken).toHaveBeenCalled();
      expect(createNewSupabaseUser).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.objectContaining({
          refresh_token_hash: '$2a$10$refreshhash',
          refresh_token_expiry: expect.any(Date),
        }),
      );
    });

    it('sets is_verified to false', async () => {
      await request(app)
        .post('/auth/signup')
        .send({ user_name: 'TestUser', email: 'test@example.com', password: 'password123' });

      expect(createNewSupabaseUser).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ is_verified: false }),
      );
    });

    it('creates Supabase auth user with correct parameters', async () => {
      await request(app)
        .post('/auth/signup')
        .send({ user_name: 'TestUser', email: 'Test@Example.COM', password: 'password123' });

      expect(createNewSupabaseAuthUser).toHaveBeenCalledWith(
        'test@example.com',
        'password123',
        'TestUser',
      );
    });
  });

  // ========================================================================
  // 8. Express Query Params Bypass Test
  // ========================================================================

  describe('Query Parameter Bypass Protection', () => {
    it('rejects signup when user_name is passed as query param only', async () => {
      const res = await request(app)
        .post('/auth/signup?user_name=TestUser')
        .send({ email: 'test@example.com', password: 'password123' });

      expect(res.status).toBe(400);
    });
  });
});

// =========================================================================
// JWT Auth Token Tests
// =========================================================================

describe('JWT Auth Tokens', () => {
  const TEST_SECRET = 'test-supabase-jwt-secret-for-unit-tests';
  let originalEnv: string | undefined;

  beforeAll(() => {
    originalEnv = process.env.SUPABASE_JWT_SECRET;
    process.env.SUPABASE_JWT_SECRET = TEST_SECRET;
  });

  afterAll(() => {
    if (originalEnv !== undefined) {
      process.env.SUPABASE_JWT_SECRET = originalEnv;
    } else {
      delete process.env.SUPABASE_JWT_SECRET;
    }
  });

  describe('Access Tokens (JWT)', () => {
    it('signs a token and verifies it back to the original payload', async () => {
      const auth = await vi.importActual<typeof import('../services/auth')>('../services/auth');

      const token = auth.signAccessToken('user-abc', 'alice@example.com');
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);

      const payload = auth.verifyAccessToken(token);
      expect(payload.sub).toBe('user-abc');
      expect(payload.email).toBe('alice@example.com');
      expect(payload.aud).toBe('authenticated');
      expect(typeof payload.iat).toBe('number');
      expect(typeof payload.exp).toBe('number');
      expect(payload.exp).toBeGreaterThan(payload.iat);
    });

    it('sets token expiry to 15 minutes from signing time', async () => {
      const auth = await vi.importActual<typeof import('../services/auth')>('../services/auth');

      const before = Math.floor(Date.now() / 1000);
      const token = auth.signAccessToken('user-abc', 'alice@example.com');
      const after = Math.floor(Date.now() / 1000);

      const payload = auth.verifyAccessToken(token);
      const expectedMin = before + 15 * 60 - 2;
      const expectedMax = after + 15 * 60 + 2;

      expect(payload.exp).toBeGreaterThanOrEqual(expectedMin);
      expect(payload.exp).toBeLessThanOrEqual(expectedMax);
    });

    it('rejects a tampered token', async () => {
      const auth = await vi.importActual<typeof import('../services/auth')>('../services/auth');

      const token = auth.signAccessToken('user-abc', 'alice@example.com');
      const tampered = token.slice(0, -5) + 'XXXXX';

      expect(() => auth.verifyAccessToken(tampered)).toThrow();
    });

    it('rejects a token signed with a different secret', async () => {
      const jwt = await vi.importActual<typeof import('jsonwebtoken')>('jsonwebtoken');
      const auth = await vi.importActual<typeof import('../services/auth')>('../services/auth');

      const wrongToken = jwt.sign(
        { sub: 'user-abc', email: 'a@b.com', aud: 'authenticated' },
        'wrong-secret',
        { expiresIn: '15m' },
      );

      expect(() => auth.verifyAccessToken(wrongToken)).toThrow();
    });

    it('rejects a token with wrong audience', async () => {
      const jwt = await vi.importActual<typeof import('jsonwebtoken')>('jsonwebtoken');
      const auth = await vi.importActual<typeof import('../services/auth')>('../services/auth');

      const wrongAudToken = jwt.sign(
        { sub: 'user-abc', email: 'a@b.com', aud: 'admin' },
        TEST_SECRET,
        { expiresIn: '15m' },
      );

      expect(() => auth.verifyAccessToken(wrongAudToken)).toThrow();
    });

    it('throws when SUPABASE_JWT_SECRET is missing', async () => {
      const originalSecret = process.env.SUPABASE_JWT_SECRET;
      delete process.env.SUPABASE_JWT_SECRET;

      const auth = await vi.importActual<typeof import('../services/auth')>('../services/auth');

      expect(() => auth.signAccessToken('user-abc', 'a@b.com')).toThrow(
        'SUPABASE_JWT_SECRET is not defined',
      );

      process.env.SUPABASE_JWT_SECRET = originalSecret;
    });
  });

  describe('Refresh Tokens', () => {
    it('generates a 64-character hex token with bcrypt hash and salt', async () => {
      const auth = await vi.importActual<typeof import('../services/auth')>('../services/auth');

      const { token, hash, salt } = auth.generateRefreshToken();

      expect(token).toHaveLength(64);
      expect(/^[0-9a-f]{64}$/.test(token)).toBe(true);
      expect(hash).toBeDefined();
      expect(hash).not.toBe(token);
      expect(hash).toMatch(/^\$2[aby]?\$/);
      expect(salt).toBeDefined();
      expect(salt).toMatch(/^\$2[aby]?\$/);
    });

    it('produces unique tokens on each call', async () => {
      const auth = await vi.importActual<typeof import('../services/auth')>('../services/auth');

      const r1 = auth.generateRefreshToken();
      const r2 = auth.generateRefreshToken();

      expect(r1.token).not.toBe(r2.token);
      expect(r1.hash).not.toBe(r2.hash);
    });

    it('hashToken produces deterministic hashes with the same salt', async () => {
      const auth = await vi.importActual<typeof import('../services/auth')>('../services/auth');
      const bcrypt = await vi.importActual<typeof import('bcryptjs')>('bcryptjs');
      const salt = bcrypt.genSaltSync(10);

      const h1 = auth.hashToken('my-token', salt);
      const h2 = auth.hashToken('my-token', salt);

      expect(h1).toBe(h2);
      expect(h1).toHaveLength(60);
    });

    it('hashToken produces different hashes without a fixed salt', async () => {
      const auth = await vi.importActual<typeof import('../services/auth')>('../services/auth');

      const h1 = auth.hashToken('my-token');
      const h2 = auth.hashToken('my-token');

      expect(h1).not.toBe(h2);
    });
  });

  describe('Password Hashing', () => {
    it('hashes and verifies a password correctly', async () => {
      const auth = await vi.importActual<typeof import('../services/auth')>('../services/auth');

      const hash = await auth.hashPassword('MySecurePass123');
      expect(hash).not.toBe('MySecurePass123');
      expect(await auth.comparePassword('MySecurePass123', hash)).toBe(true);
    });

    it('rejects an incorrect password', async () => {
      const auth = await vi.importActual<typeof import('../services/auth')>('../services/auth');

      const hash = await auth.hashPassword('MySecurePass123');
      expect(await auth.comparePassword('WrongPassword', hash)).toBe(false);
    });

    it('produces unique hashes for the same input (salting)', async () => {
      const auth = await vi.importActual<typeof import('../services/auth')>('../services/auth');

      const h1 = await auth.hashPassword('SamePassword');
      const h2 = await auth.hashPassword('SamePassword');

      expect(h1).not.toBe(h2);
    });
  });
});

// =========================================================================
// Authenticate Middleware Tests
// =========================================================================

describe('Authenticate Middleware', () => {
  const TEST_SECRET = 'test-supabase-jwt-secret-for-unit-tests';
  let originalEnv: string | undefined;

  beforeAll(() => {
    originalEnv = process.env.SUPABASE_JWT_SECRET;
    process.env.SUPABASE_JWT_SECRET = TEST_SECRET;
  });

  afterAll(() => {
    if (originalEnv !== undefined) {
      process.env.SUPABASE_JWT_SECRET = originalEnv;
    } else {
      delete process.env.SUPABASE_JWT_SECRET;
    }
  });

  const middlewareApp = express();
  middlewareApp.use(cookieParser());
  middlewareApp.use(express.json());
  middlewareApp.get('/protected', authenticate, (req: Request, res: Response) => {
    res.json({ user: req.user });
  });

  // failing 
  it('passes through with a valid access token cookie', async () => {
    const auth = await vi.importActual<typeof import('../services/auth')>('../services/auth');

    const token = auth.signAccessToken('user-123', 'test@example.com');

    const res = await request(middlewareApp)
      .get('/protected')
      .set('Cookie', [`access_token=${token}`]);

    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({
      id: 'user-123',
      email: 'test@example.com',
    });
  });

  it('returns 401 when no cookies are provided', async () => {
    const res = await request(middlewareApp).get('/protected');

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Authentication required');
  });

  it('returns 401 when access_token cookie is missing', async () => {
    const res = await request(middlewareApp)
      .get('/protected')
      .set('Cookie', ['other_cookie=value']);

    expect(res.status).toBe(401);
  });

  it('returns 401 when access token is invalid', async () => {
    const res = await request(middlewareApp)
      .get('/protected')
      .set('Cookie', ['access_token=invalid.token.here']);

    expect(res.status).toBe(401);
  });

  //failing 
  it('sets req.user with correct id and email from valid token', async () => {
    const auth = await vi.importActual<typeof import('../services/auth')>('../services/auth');

    const token = auth.signAccessToken('user-456', 'bob@example.com');

    const res = await request(middlewareApp)
      .get('/protected')
      .set('Cookie', [`access_token=${token}`]);

    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe('user-456');
    expect(res.body.user.email).toBe('bob@example.com');
  });
});

// =========================================================================
// UserResponseDTO Tests
// =========================================================================

describe('UserResponseDTO', () => {
  it('maps a raw DB user to a safe DTO without sensitive fields', async () => {
    const { UserResponseDTO } = await vi.importActual<typeof import('../../dtos/UserResponseDTO')>('../../dtos/UserResponseDTO');

    const rawUser = {
      id: 'user-id',
      user_name: 'TestUser',
      email: 'test@example.com',
      created_at: new Date('2025-06-15T10:00:00Z'),
      user_tag: 'testuser#0001',
      image_url: 'https://example.com/img.png',
      is_verified: true,
      last_login: new Date(),
      password: 'should-not-be-exposed',
      refresh_token_hash: 'should-not-be-exposed',
    };

    const dto = UserResponseDTO.mapUser(rawUser);

    expect(dto.id).toBe('user-id');
    expect(dto.user_name).toBe('TestUser');
    expect(dto.email).toBe('test@example.com');
    expect(dto.user_tag).toBe('testuser#0001');
    expect(dto.created_at).toBe('2025-06-15T10:00:00.000Z');

    expect((dto as Record<string, unknown>).password).toBeUndefined();
    expect((dto as Record<string, unknown>).refresh_token_hash).toBeUndefined();
    expect((dto as Record<string, unknown>).is_verified).toBeUndefined();
    expect((dto as Record<string, unknown>).image_url).toBeUndefined();
  });

  it('converts Date objects to ISO strings', async () => {
    const { UserResponseDTO } = await vi.importActual<typeof import('../../dtos/UserResponseDTO')>('../../dtos/UserResponseDTO');

    const dto = new UserResponseDTO({
      id: 'id',
      user_name: 'name',
      email: 'e@e.com',
      created_at: new Date('2025-03-01'),
      user_tag: 'name#0001',
    });

    expect(typeof dto.created_at).toBe('string');
    expect(dto.created_at).toBe('2025-03-01T00:00:00.000Z');
  });

  it('passes through ISO string dates unchanged', async () => {
    const { UserResponseDTO } = await vi.importActual<typeof import('../../dtos/UserResponseDTO')>('../../dtos/UserResponseDTO');

    const dto = new UserResponseDTO({
      id: 'id',
      user_name: 'name',
      email: 'e@e.com',
      created_at: '2025-03-01T12:00:00.000Z',
      user_tag: 'name#0001',
    });

    expect(dto.created_at).toBe('2025-03-01T12:00:00.000Z');
  });
});
