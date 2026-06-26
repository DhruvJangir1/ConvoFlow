import { test, expect, describe } from 'vitest';
import bcrypt from 'bcryptjs';
import { 
  hashPassword, 
  comparePassword, 
  signAccessToken, 
  verifyAccessToken, 
  generateRefreshToken, 
  hashToken 
} from './auth';

describe('Authentication Utilities', () => {
  const mockPassword = 'SuperSecretPassword123';
  const mockUserId = 'user-123-abc';
  const mockEmail = 'test@example.com';

  // =========================================================================
  // 1. Password Hashing Tests
  // =========================================================================
  describe('Password Hashing', () => {
    test('should successfully hash and compare a valid password', async () => {
      const hash = await hashPassword(mockPassword);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(mockPassword); // Plaintext check

      const isValid = await comparePassword(mockPassword, hash);
      expect(isValid).toBe(true);
    });

    test('should reject an incorrect password', async () => {
      const hash = await hashPassword(mockPassword);
      const isValid = await comparePassword('wrong-password', hash);
      
      expect(isValid).toBe(false);
    });

    test('should produce unique hashes for identical inputs due to salting', async () => {
      const hash1 = await hashPassword(mockPassword);
      const hash2 = await hashPassword(mockPassword);

      expect(hash1).not.toBe(hash2);
    });
  });

  // =========================================================================
  // 2. Access Token (JWT) Tests
  // =========================================================================
  describe('Access Tokens (JWT)', () => {
    test('should sign and successfully verify an access token', () => {
      const token = signAccessToken(mockUserId, mockEmail);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      const payload = verifyAccessToken(token);
      expect(payload.sub).toBe(mockUserId);
      expect(payload.email).toBe(mockEmail);
      expect(payload.aud).toBe('authenticated');
    });

    test('should fail verification if the token is tampered with', () => {
      const token = signAccessToken(mockUserId, mockEmail);
      const tamperedToken = token + 'malicious_data';

      expect(() => verifyAccessToken(tamperedToken)).toThrow();
    });
  });

  // =========================================================================
  // 3. Refresh Token & Token Hashing Tests
  // =========================================================================
  describe('Refresh Tokens', () => {
    test('should generate a 48-byte hex token and its bcrypt hash', () => {
      const { token, hash, salt } = generateRefreshToken();

      // 48 bytes in hex format results in a 96-character string
      expect(token).toHaveLength(96); 
      expect(hash).toBeDefined();
      expect(hash).not.toBe(token);
      expect(salt).toBeDefined();
    });

    test('should deterministically hash a token with same salt', () => {
      const token = 'sample-token-string';
      const salt = bcrypt.genSaltSync(10);
      const hash1 = hashToken(token, salt);
      const hash2 = hashToken(token, salt);

      // Same salt must produce same hash
      expect(hash1).toBe(hash2);
      // bcrypt hash is 60 characters long
      expect(hash1).toHaveLength(60); 
    });

    test('should produce different hashes without salt (random salt each call)', () => {
      const token = 'sample-token-string';
      const hash1 = hashToken(token);
      const hash2 = hashToken(token);

      // Random salt makes each hash unique
      expect(hash1).not.toBe(hash2);
    });
  });
});