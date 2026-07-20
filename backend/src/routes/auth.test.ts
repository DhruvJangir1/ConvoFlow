import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import cookieParser from 'cookie-parser';

// 1. Hoisted mock objects
const { mockPrisma, mockSupabase, mockAuthService, mockSendUserVerificationCode, mockSetVerificationCode, mockClearAuthCookies, mockSetAuthCookies, mockCreateNewSupabaseAuthUser, mockCreateNewSupabaseUser, mockTrackAuthAttempt } = vi.hoisted(() => {
  const mockPrisma = {
    users: {
      findFirst: vi.fn().mockResolvedValue(null),
      count: vi.fn().mockResolvedValue(0),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  };

  const mockSupabase = {
    auth: {
      admin: {
        createUser: vi.fn(),
        deleteUser: vi.fn().mockResolvedValue({}),
      },
    },
  };

  const mockAuthService = {
    hashPassword: vi.fn().mockResolvedValue('hashed_password'),
    comparePassword: vi.fn(),
    signAccessToken: vi.fn().mockReturnValue('access_token'),
    verifyAccessToken: vi.fn(),
    generateRefreshToken: vi.fn().mockReturnValue({ token: 'rt', hash: 'rh', salt: 'rs' }),
    hashToken: vi.fn().mockReturnValue('hashed_token'),
    REFRESH_TOKEN_EXPIRY_MS: 2_592_000,
    rotateRefreshToken: vi.fn(),
    rotateRefreshTokenWithLock: vi.fn(),
  };

  const mockSendUserVerificationCode = vi.fn().mockResolvedValue(undefined);
  const mockSetVerificationCode = vi.fn();
  const mockClearAuthCookies = vi.fn();
  const mockSetAuthCookies = vi.fn();
  const mockCreateNewSupabaseAuthUser = vi.fn().mockResolvedValue({ success: true, userId: 'u1' });
  const mockCreateNewSupabaseUser = vi.fn().mockResolvedValue({ id: 'u1', user_name: 'test', email: 't@ex.com', created_at: new Date().toISOString(), user_tag: 'test#0001' });
  const mockTrackAuthAttempt = vi.fn().mockResolvedValue(true);

  return { mockPrisma, mockSupabase, mockAuthService, mockSendUserVerificationCode, mockSetVerificationCode, mockClearAuthCookies, mockSetAuthCookies, mockCreateNewSupabaseAuthUser, mockCreateNewSupabaseUser, mockTrackAuthAttempt };
});

// 2. Mock modules (hoisted to top of file by vitest)
vi.mock('../lib/connectionPoolClient.js', () => ({ prisma: mockPrisma }));
vi.mock('../services/auth.js', () => mockAuthService);
vi.mock('../services/authVerificaiton.js', () => ({ sendUserVerificationCode: mockSendUserVerificationCode, setAuthCookies: mockSetAuthCookies }));
vi.mock('../services/verificationStore.js', () => ({ setVerificationCode: mockSetVerificationCode }));
vi.mock('../services/authCookieSessions.js', () => ({ clearAuthCookies: mockClearAuthCookies, setAuthCookies: mockSetAuthCookies }));
vi.mock('./supabaseAuth.js', () => ({ createNewSupabaseAuthUser: mockCreateNewSupabaseAuthUser, createNewSupabaseUser: mockCreateNewSupabaseUser }));
vi.mock('../services/rateLimiter.js', () => ({ trackAuthAttempt: mockTrackAuthAttempt }));
vi.mock('../supabase/admin.js', () => ({ getAdminClient: vi.fn(() => mockSupabase) }));
vi.mock('dotenv', () => ({ default: { config: vi.fn() } }));
vi.mock('../supabase/supabaseS3Client.js', () => ({ s3Client: {}, S3_BUCKET_NAME: 'test-bucket' }));

// 3. Import router AFTER mocks
import AuthRouter from './auth';

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/auth', AuthRouter);

describe('Auth Endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockTrackAuthAttempt.mockResolvedValue(true);
    mockCreateNewSupabaseAuthUser.mockResolvedValue({ success: true, userId: 'u1' });
    mockCreateNewSupabaseUser.mockResolvedValue({ id: 'u1', user_name: 'test', email: 't@ex.com', created_at: new Date().toISOString(), user_tag: 'test#0001' });
    mockSendUserVerificationCode.mockResolvedValue(undefined);
    mockPrisma.users.findFirst.mockResolvedValue(null);
    mockPrisma.users.count.mockResolvedValue(0);
    mockAuthService.signAccessToken.mockReturnValue('access_token');
    mockAuthService.generateRefreshToken.mockReturnValue({ token: 'rt', hash: 'rh', salt: 'rs' });
    mockAuthService.hashPassword.mockResolvedValue('hashed_password');
  });

  // =========================================================================
  // Signup
  // =========================================================================

  describe('POST /auth/EmailVerificaitonRouter/signup', () => {
    it('creates a user and sends a verification email', async () => {
      const res = await request(app)
        .post('/auth/EmailVerificaitonRouter/signup')
        .send({ user_name: 'test', email: 't@ex.com', password: 'password123' });

      expect(res.status).toBe(201);
      expect(res.body.message).toBe('verification_sent');
    });

    it('fails if fields are missing', async () => {
      const res = await request(app)
        .post('/auth/EmailVerificaitonRouter/signup')
        .send({ email: '', password: '' });

      expect(res.status).toBe(400);
    });
  });

  // =========================================================================
  // Login
  // =========================================================================

  describe('POST /auth/EmailVerificaitonRouter/login', () => {
    it('logs in a verified user', async () => {
      mockPrisma.users.findFirst
        .mockResolvedValueOnce({ id: 'u1', password: 'hashed_password', is_verified: true, user_name: 'test', email: 't@ex.com', image_url: null, created_at: new Date().toISOString(), user_tag: 'test#0001' });
      mockAuthService.comparePassword.mockResolvedValue(true);

      const res = await request(app)
        .post('/auth/EmailVerificaitonRouter/login')
        .send({ email: 't@ex.com', password: 'password123' });

      expect(res.status).toBe(200);
      expect(res.body.user).toBeDefined();
    });

    it('returns empty body when user is not found', async () => {
      mockPrisma.users.findFirst.mockResolvedValue(null);

      const res = await request(app)
        .post('/auth/EmailVerificaitonRouter/login')
        .send({ email: 'wrong@ex.com', password: 'wrong' });

      expect(res.status).toBe(200);
      expect(res.body.user).toBeUndefined();
    });
  });

  // =========================================================================
  // Refresh
  // =========================================================================

  describe('POST /auth/TokenVerificationRouter/refresh', () => {
    it('issues new tokens given a valid refresh cookie', async () => {
      mockAuthService.rotateRefreshTokenWithLock.mockResolvedValue({
        accessToken: 'new_access',
        refreshToken: 'new_refresh',
        refreshSalt: 'new_salt',
        user: { id: 'u1', email: 't@ex.com' },
      });

      const res = await request(app)
        .post('/auth/TokenVerificationRouter/refresh')
        .set('Cookie', ['refresh_token=valid_token', 'user_id=u1']);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Tokens refreshed');
    });
  });

  // =========================================================================
  // Logout
  // =========================================================================

  describe('POST /auth/EmailVerificaitonRouter/logout', () => {
    it('clears active sessions', async () => {
      const res = await request(app).post('/auth/EmailVerificaitonRouter/logout');
      expect(res.status).toBe(200);
    });
  });

  // =========================================================================
  // Session
  // =========================================================================

  describe('GET /auth/TokenVerificationRouter/session', () => {
    it('returns user data if session is valid', async () => {
      mockAuthService.verifyAccessToken.mockReturnValue({ sub: 'test_user_id', email: 't@ex.com' });
      mockPrisma.users.findFirst.mockResolvedValue({ id: 'test_user_id', email: 't@ex.com' });

      const res = await request(app)
        .get('/auth/TokenVerificationRouter/session')
        .set('Cookie', ['access_token=valid_token']);

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe('t@ex.com');
    });
  });
});
