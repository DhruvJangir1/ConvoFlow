import { describe, it, expect, vi, beforeEach } from 'vitest';
import express, { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import cookieParser from 'cookie-parser';

// 1. Setup Mock Objects
const mockAdminChain = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  maybeSingle: vi.fn(),
  insert: vi.fn().mockReturnThis(),
  single: vi.fn(),
  update: vi.fn().mockReturnThis(),
  gte: vi.fn().mockReturnThis(),
};

const mockSupabase = {
  from: vi.fn().mockReturnValue(mockAdminChain),
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
  generateRefreshToken: vi.fn().mockReturnValue({ token: 'rt', hash: 'rh' }),
  hashToken: vi.fn().mockReturnValue('hashed_token'),
  REFRESH_TOKEN_EXPIRY_MS: 86400000,
};

const mockResend = {
  emails: {
    send: vi.fn().mockResolvedValue({ id: 'email_id' }),
  },
};

// 2. Link Vitest to your files
vi.mock('../supabase/admin.js', () => ({ default: mockSupabase }));
vi.mock('../services/auth', () => mockAuthService);
vi.mock('resend', () => ({ Resend: vi.fn(() => mockResend) }));
vi.mock('../middleware/authenticate.js', () => ({
  authenticate: (req: Request, res: Response, next: NextFunction) => {
    req.user = { id: 'test_user_id', email: 't@ex.com' };
    next();
  },
}));

// Import the router AFTER defining the mocks above
import AuthRouter from './auth';

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/auth', AuthRouter);

describe('Auth Endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /auth/signup', () => {
    it('creates a user and sends a verification email', async () => {
      mockAdminChain.maybeSingle.mockResolvedValue({ data: null, error: null });
      mockSupabase.auth.admin.createUser.mockResolvedValue({ data: { id: 'u1', email: 't@ex.com' }, error: null });

      const res = await request(app)
        .post('/auth/signup')
        .send({ user_name: 'test', email: 't@ex.com', password: 'password123' });

      expect(res.status).toBe(201);
      expect(res.body.message).toBe('verification_sent');
    });

    it('fails if fields are missing', async () => {
      const res = await request(app)
        .post('/auth/signup')
        .send({ email: '', password: '' });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /auth/login', () => {
    it('logs in a verified user', async () => {
      mockAdminChain.maybeSingle.mockResolvedValue({
        data: { id: 'u1', password: 'hashed_password', is_verified: true },
        error: null,
      });
      mockAuthService.comparePassword.mockResolvedValue(true);

      const res = await request(app)
        .post('/auth/login')
        .send({ email: 't@ex.com', password: 'password123' });

      expect(res.status).toBe(200);
      expect(res.body.user).toBeDefined();
    });

    it('rejects incorrect credentials', async () => {
      mockAdminChain.maybeSingle.mockResolvedValue({ data: null, error: null });

      const res = await request(app)
        .post('/auth/login')
        .send({ email: 'wrong@ex.com', password: 'wrong' });

      expect(res.status).toBe(401);
    });
  });

  describe('POST /auth/refresh', () => {
    it('issues new tokens given a valid refresh cookie', async () => {
      mockAdminChain.maybeSingle.mockResolvedValue({ data: { id: 'u1' }, error: null });

      const res = await request(app)
        .post('/auth/refresh')
        .set('Cookie', ['refresh_token=valid_token']);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('減Tokens refreshed');
    });
  });

  describe('POST /auth/logout', () => {
    it('clears active sessions', async () => {
      const res = await request(app).post('/auth/logout');
      expect(res.status).toBe(200);
    });
  });

  describe('GET /auth/session', () => {
    it('returns user data if session is valid', async () => {
      mockAdminChain.single.mockResolvedValue({ data: { id: 'test_user_id', email: 't@ex.com' }, error: null });

      const res = await request(app).get('/auth/session');
      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe('t@ex.com');
    });
  });
});