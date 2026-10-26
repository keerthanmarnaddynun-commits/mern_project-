process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_lostfound_super_secure';

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const request = require('supertest');

// Mock database connection before importing app
jest.mock('../config/db', () => jest.fn().mockResolvedValue(true));

// Mock Mongoose to prevent actual database connections and avoid hanging handles
jest.mock('mongoose', () => {
  const actualMongoose = jest.requireActual('mongoose');
  const mockSession = {
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    abortTransaction: jest.fn(),
    endSession: jest.fn().mockResolvedValue(true),
    withTransaction: jest.fn(async (cb) => cb()),
  };
  return {
    ...actualMongoose,
    connect: jest.fn().mockResolvedValue(true),
    startSession: jest.fn().mockResolvedValue(mockSession),
    mockSessionInstance: mockSession,
    connection: {
      ...actualMongoose.connection,
      close: jest.fn().mockResolvedValue(true),
      readyState: 1,
      on: jest.fn(),
      once: jest.fn(),
    },
  };
});

// Mock Mongoose models to isolate tests from database state
jest.mock('../models/User');
jest.mock('../models/Item');
jest.mock('../models/Claim');
jest.mock('../models/Dispute');
jest.mock('../models/Notification');
jest.mock('../models/Activity', () => ({
  create: jest.fn().mockResolvedValue({}),
  updateMany: jest.fn().mockResolvedValue({}),
}));

const User = require('../models/User');
const Item = require('../models/Item');
const Claim = require('../models/Claim');
const Dispute = require('../models/Dispute');
const Notification = require('../models/Notification');
const Activity = require('../models/Activity');
const mongoose = require('mongoose');
const app = require('../server');

describe('Security & Access Control Integration Tests', () => {
  // Valid MongoDB ObjectIds
  const userAId = '507f1f77bcf86cd799439011';
  const userBId = '507f1f77bcf86cd799439012';
  const unverifiedUserId = '507f1f77bcf86cd799439099';
  const adminId = '000000000000000000000000';
  const itemBId = '507f1f77bcf86cd799439021';
  const claimBId = '507f1f77bcf86cd799439031';

  // Mock User documents
  const mockUserA = {
    _id: userAId,
    name: 'Alice Student',
    email: 'alice@campus.edu',
    role: 'user',
    department: 'Computer Science',
    tokenVersion: 0,
    isVerified: true,
    password: '$2a$10$abcdefghijklmnopqrstuu',
    save: jest.fn().mockResolvedValue(true),
    toObject: () => ({
      _id: userAId,
      name: 'Alice Student',
      email: 'alice@campus.edu',
      role: 'user',
      department: 'Computer Science',
      tokenVersion: 0,
      isVerified: true,
    }),
  };

  const mockUserB = {
    _id: userBId,
    name: 'Bob Scholar',
    email: 'bob@campus.edu',
    role: 'user',
    department: 'Physics',
    tokenVersion: 0,
    isVerified: true,
    password: '$2a$10$abcdefghijklmnopqrstuu',
    save: jest.fn().mockResolvedValue(true),
    toObject: () => ({
      _id: userBId,
      name: 'Bob Scholar',
      email: 'bob@campus.edu',
      role: 'user',
      department: 'Physics',
      tokenVersion: 0,
      isVerified: true,
    }),
  };

  const mockUserUnverified = {
    _id: unverifiedUserId,
    name: 'Unverified Student',
    email: 'unverified@campus.edu',
    role: 'user',
    department: 'Biology',
    tokenVersion: 0,
    isVerified: false,
    password: '$2a$10$abcdefghijklmnopqrstuu',
    save: jest.fn().mockResolvedValue(true),
    toObject: () => ({
      _id: unverifiedUserId,
      name: 'Unverified Student',
      email: 'unverified@campus.edu',
      role: 'user',
      department: 'Biology',
      tokenVersion: 0,
      isVerified: false,
    }),
  };

  const mockAdminUser = {
    _id: adminId,
    name: 'System Admin',
    email: 'admin@campus.edu',
    role: 'admin',
    department: null,
    toObject: () => ({
      _id: adminId,
      name: 'System Admin',
      email: 'admin@campus.edu',
      role: 'admin',
      department: null,
    }),
  };

  // Mock Item owned by User B
  const mockItemB = {
    _id: itemBId,
    title: 'Water Bottle',
    description: 'Blue insulated water bottle found in library',
    category: 'Personal Belongings',
    type: 'found',
    location: 'Campus Library 2nd Floor',
    date_occurred: '2026-10-24',
    contact_email: 'bob@campus.edu',
    contact_phone: null,
    postedBy: userBId,
    status: 'pending',
    is_resolved: false,
    custodyStatus: 'not_handed_over',
    save: jest.fn().mockResolvedValue(true),
    deleteOne: jest.fn().mockResolvedValue({ acknowledged: true, deletedCount: 1 }),
  };

  // Mock Claim submitted by User B
  const mockClaimB = {
    _id: claimBId,
    itemId: itemBId,
    lostItemId: '507f1f77bcf86cd799439041',
    claimant: userBId,
    status: 'pending',
    save: jest.fn().mockResolvedValue(true),
    deleteOne: jest.fn().mockResolvedValue({ acknowledged: true, deletedCount: 1 }),
  };

  // Generated JWT tokens
  let userAToken;
  let userBToken;
  let unverifiedToken;
  let adminToken;

  // HttpOnly Cookie strings
  let userACookie;
  let userBCookie;
  let unverifiedCookie;
  let adminCookie;
  let csrfToken;

  beforeAll(() => {
    const secret = process.env.JWT_SECRET;

    userAToken = jwt.sign({ id: userAId, userId: userAId, role: 'user', tokenVersion: 0 }, secret, { expiresIn: '1h' });
    userBToken = jwt.sign({ id: userBId, userId: userBId, role: 'user', tokenVersion: 0 }, secret, { expiresIn: '1h' });
    unverifiedToken = jwt.sign({ id: unverifiedUserId, userId: unverifiedUserId, role: 'user', tokenVersion: 0 }, secret, { expiresIn: '1h' });
    adminToken = jwt.sign(
      { email: 'admin@campus.edu', role: 'admin' },
      secret,
      { expiresIn: '1h' }
    );

    csrfToken = crypto.randomBytes(32).toString('hex');
    userACookie = `token=${userAToken}; csrfToken=${csrfToken}`;
    userBCookie = `token=${userBToken}; csrfToken=${csrfToken}`;
    unverifiedCookie = `token=${unverifiedToken}; csrfToken=${csrfToken}`;
    adminCookie = `token=${adminToken}; csrfToken=${csrfToken}`;
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock behavior for User.findById
    User.findById.mockImplementation((id) => {
      const idStr = id ? id.toString() : '';
      let doc = null;
      if (idStr === userAId) doc = mockUserA;
      else if (idStr === userBId) doc = mockUserB;
      else if (idStr === unverifiedUserId) doc = mockUserUnverified;
      else if (idStr === adminId) doc = mockAdminUser;

      const p = Promise.resolve(doc);
      p.select = jest.fn().mockResolvedValue(doc);
      return p;
    });

    User.findByIdAndUpdate = jest.fn().mockImplementation((id, update) => {
      return Promise.resolve(mockUserA);
    });

    User.findByIdAndDelete = jest.fn().mockResolvedValue(mockUserA);

    // Default mock behavior for User.findOne (returns null for bad login attempts)
    User.findOne.mockReturnValue({
      select: jest.fn().mockResolvedValue(null),
    });

    // Default mock behavior for Item
    Item.find = jest.fn().mockResolvedValue([]);
    Item.deleteMany = jest.fn().mockResolvedValue({ acknowledged: true });
    Claim.deleteMany = jest.fn().mockResolvedValue({ acknowledged: true });

    // Default mock behavior for Item.findById
    Item.findById.mockImplementation((id) => {
      const idStr = id ? id.toString() : '';
      if (idStr === itemBId) {
        return Promise.resolve({
          ...mockItemB,
          save: jest.fn().mockResolvedValue(true),
          deleteOne: jest.fn().mockResolvedValue({ acknowledged: true, deletedCount: 1 }),
        });
      }
      return Promise.resolve(null);
    });

    // Default mock behavior for Claim.findById
    Claim.findById.mockImplementation((id) => {
      const idStr = id ? id.toString() : '';
      if (idStr === claimBId) {
        return Promise.resolve({
          ...mockClaimB,
          save: jest.fn().mockResolvedValue(true),
          deleteOne: jest.fn().mockResolvedValue({ acknowledged: true, deletedCount: 1 }),
        });
      }
      return Promise.resolve(null);
    });
  });

  afterAll(async () => {
    jest.restoreAllMocks();
  });

  // =========================================================================
  // Test Suite 1: Authentication (HttpOnly Cookies)
  // =========================================================================
  describe('Test Suite 1: Authentication (HttpOnly Cookies)', () => {
    it('should reject access with 401 Unauthorized when no token cookie is provided', async () => {
      const response = await request(app)
        .get('/api/auth/me');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toMatch(/not authorized/i);
    });

    it('should grant access with 200 OK when a valid token cookie is provided', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Cookie', [userACookie]);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('email', 'alice@campus.edu');
      expect(response.body).toHaveProperty('name', 'Alice Student');
    });
  });

  // =========================================================================
  // Test Suite 2: Broken Object Level Authorization (BOLA)
  // =========================================================================
  describe('Test Suite 2: Broken Object Level Authorization (BOLA)', () => {
    it('should return 403 Forbidden when User A attempts to PATCH an Item owned by User B', async () => {
      const response = await request(app)
        .patch(`/api/items/${itemBId}`)
        .set('Cookie', [userACookie])
        .set('X-CSRF-Token', csrfToken)
        .send({ title: 'Tampered Title by User A' });

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toMatch(/not authorized to modify this record/i);
    });

    it('should return 403 Forbidden when User A attempts to DELETE an Item owned by User B', async () => {
      const response = await request(app)
        .delete(`/api/items/${itemBId}`)
        .set('Cookie', [userACookie])
        .set('X-CSRF-Token', csrfToken);

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toMatch(/not authorized to modify this record/i);
    });

    it('should return 403 Forbidden when User A attempts to DELETE a Claim owned by User B', async () => {
      const response = await request(app)
        .delete(`/api/claims/${claimBId}`)
        .set('Cookie', [userACookie])
        .set('X-CSRF-Token', csrfToken);

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toMatch(/not authorized to modify this record/i);
    });

    it('should return 200 OK when an Admin modifies User B item (admin bypasses BOLA)', async () => {
      const response = await request(app)
        .patch(`/api/items/${itemBId}`)
        .set('Cookie', [adminCookie])
        .set('X-CSRF-Token', csrfToken)
        .send({ title: 'Admin Authorized Modification' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('_id', itemBId);
    });

    it('should return 200 OK when an Admin deletes User B item (admin bypasses BOLA)', async () => {
      const response = await request(app)
        .delete(`/api/items/${itemBId}`)
        .set('Cookie', [adminCookie])
        .set('X-CSRF-Token', csrfToken);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Item deleted successfully');
    });
  });

  // =========================================================================
  // Test Suite 3: Rate Limiting
  // =========================================================================
  describe('Test Suite 3: Rate Limiting', () => {
    it('should allow first 5 login attempts and block the 6th with 429 Too Many Requests from the same IP', async () => {
      const mockIp = '198.51.100.42'; // Dedicated RFC 5737 TEST-NET-2 IP address for isolation

      for (let attempt = 1; attempt <= 6; attempt++) {
        const response = await request(app)
          .post('/api/users/login')
          .set('X-Forwarded-For', mockIp)
          .send({
            email: 'unauthorized_attempt@campus.edu',
            password: 'incorrectPassword123',
          });

        if (attempt <= 5) {
          // Standard failure response (401 Unauthorized for invalid credentials)
          expect(response.status).not.toBe(429);
          expect(response.status).toBe(401);
          expect(response.body).toHaveProperty('message', 'Invalid email or password');
        } else {
          // 6th attempt must be rate-limited by loginLimiter (max: 5)
          expect(response.status).toBe(429);
          expect(response.body).toHaveProperty(
            'message',
            'Too many login attempts from this IP, please try again after 15 minutes'
          );
        }
      }
    });
  });

  // =========================================================================
  // Test Suite 4: Security Headers & Helmet Configuration
  // =========================================================================
  describe('Test Suite 4: Security Headers & Helmet Configuration', () => {
    it('should set strict security headers and disable X-Powered-By', async () => {
      const response = await request(app).get('/');

      expect(response.status).toBe(200);
      expect(response.headers['x-powered-by']).toBeUndefined();
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
      expect(response.headers['permissions-policy']).toBe('camera=(), microphone=(), geolocation=()');
      expect(response.headers['cross-origin-resource-policy']).toBe('cross-origin');
      expect(response.headers['content-security-policy']).toBeDefined();
      expect(response.headers['content-security-policy']).toContain("default-src 'self'");
      // HSTS must only be enabled in production; in test/dev it should not be present
      expect(response.headers['strict-transport-security']).toBeUndefined();
    });

    it('should return malformed JSON syntax error with status 400', async () => {
      const response = await request(app)
        .post('/api/users/login')
        .set('Content-Type', 'application/json')
        .send('{"invalidJson: ');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', 'Malformed request body.');
    });
  });

  // =========================================================================
  // Test Suite 5: Centralized Error Handling & Leak Prevention
  // =========================================================================
  describe('Test Suite 5: Centralized Error Handling', () => {
    const errorHandler = require('../middleware/errorHandler');

    const mockRes = () => {
      const res = {};
      res.statusCode = 200;
      res.headersSent = false;
      res.status = jest.fn().mockImplementation((code) => {
        res.statusCode = code;
        return res;
      });
      res.json = jest.fn().mockImplementation((data) => {
        res.body = data;
        return res;
      });
      return res;
    };

    it('should delegate to next(err) if headers are already sent', () => {
      const next = jest.fn();
      const res = mockRes();
      res.headersSent = true;
      const err = new Error('Header error');

      errorHandler(err, {}, res, next);
      expect(next).toHaveBeenCalledWith(err);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should handle Multer LIMIT_FILE_SIZE error with 413 and safe message', () => {
      const next = jest.fn();
      const res = mockRes();
      const err = new Error('File too large');
      err.code = 'LIMIT_FILE_SIZE';

      errorHandler(err, { method: 'POST', url: '/api/upload' }, res, next);
      expect(res.status).toHaveBeenCalledWith(413);
      expect(res.body).toHaveProperty('message', 'File too large. Maximum size is 5MB.');
    });

    it('should handle Mongoose CastError with 400 and safe message', () => {
      const next = jest.fn();
      const res = mockRes();
      const err = new Error('Cast to ObjectId failed for value "invalid" at path "_id"');
      err.name = 'CastError';

      errorHandler(err, { method: 'GET', url: '/api/items/invalid' }, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.body).toHaveProperty('message', 'Invalid request input.');
    });

    it('should handle Mongoose ValidationError with 400 and safe message', () => {
      const next = jest.fn();
      const res = mockRes();
      const err = new Error('Item validation failed: title: Path `title` is required.');
      err.name = 'ValidationError';

      errorHandler(err, { method: 'POST', url: '/api/items' }, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.body).toHaveProperty('message', 'Invalid request input.');
    });

    it('should handle Mongo duplicate key error (11000) with 400 and safe message', () => {
      const next = jest.fn();
      const res = mockRes();
      const err = new Error('E11000 duplicate key error collection: test.users index: email_1 dup key: { email: "alice@campus.edu" }');
      err.code = 11000;

      errorHandler(err, { method: 'POST', url: '/api/users/register' }, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.body).toHaveProperty('message', 'Resource already exists.');
    });

    it('should never leak stack traces or internal details in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const next = jest.fn();
      const res = mockRes();
      const err = new Error('Fatal database connection failed at mongodb://admin:secret@cluster0.db.net/prod');
      err.stack = 'Error: Fatal database connection\n    at internal/db.js:42:15';

      errorHandler(err, { method: 'GET', url: '/api/items' }, res, next);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.body).toEqual({ message: 'Internal server error' });
      expect(res.body.stack).toBeUndefined();
      expect(res.body.error).toBeUndefined();

      process.env.NODE_ENV = originalEnv;
    });

    it('should securely log errors server-side without leaking sensitive tokens or passwords', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const next = jest.fn();
      const res = mockRes();
      const err = new Error('Database query failure');
      const req = {
        method: 'POST',
        url: '/api/users/login',
        ip: '127.0.0.1',
        query: { token: 'secret_jwt_token', name: 'Alice' },
        params: { password: 'myPassword123' },
      };

      errorHandler(err, req, res, next);

      expect(consoleSpy).toHaveBeenCalled();
      const loggedData = consoleSpy.mock.calls[0][1];
      expect(loggedData.query.token).toBe('[REDACTED]');
      expect(loggedData.params.password).toBe('[REDACTED]');
      expect(loggedData.query.name).toBe('Alice');

      consoleSpy.mockRestore();
    });
  });

  // =========================================================================
  // Test Suite 6: Server-side JWT Revocation with tokenVersion
  // =========================================================================
  describe('Test Suite 6: Server-side JWT Revocation (tokenVersion)', () => {
    it('should reject request with 401 when tokenVersion in token does not match user tokenVersion in DB', async () => {
      // Token has tokenVersion: 0, but user in DB has tokenVersion: 1 (e.g. after logout or password change)
      const userWithRevokedSession = {
        ...mockUserA,
        tokenVersion: 1,
      };

      User.findById.mockImplementationOnce(() => {
        const p = Promise.resolve(userWithRevokedSession);
        p.select = jest.fn().mockResolvedValue(userWithRevokedSession);
        return p;
      });

      const response = await request(app)
        .get('/api/auth/me')
        .set('Cookie', [userACookie]);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty(
        'message',
        'Session expired or invalid. Please log in again.'
      );
    });

    it('should reject request with 401 if user does not exist in DB regardless of token payload', async () => {
      User.findById.mockImplementationOnce(() => {
        const p = Promise.resolve(null);
        p.select = jest.fn().mockResolvedValue(null);
        return p;
      });

      const response = await request(app)
        .get('/api/auth/me')
        .set('Cookie', [userACookie]);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty(
        'message',
        'Session expired or invalid. Please log in again.'
      );
    });

    it('should atomically increment tokenVersion on logout and clear cookies even if token is expired', async () => {
      const expiredToken = jwt.sign(
        { id: userAId, userId: userAId, role: 'user', tokenVersion: 0 },
        process.env.JWT_SECRET,
        { expiresIn: '-10s' }
      );

      const response = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', [`token=${expiredToken}`]);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Logged out successfully');

      // Verify User.findByIdAndUpdate was called to increment tokenVersion
      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        userAId,
        { $inc: { tokenVersion: 1 } }
      );

      // Verify cookies are cleared
      const setCookieHeaders = response.headers['set-cookie'] || [];
      const tokenCookieCleared = setCookieHeaders.some((header) =>
        header.includes('token=;') || header.includes('token=') && header.includes('Expires=')
      );
      expect(tokenCookieCleared).toBe(true);
    });

    it('should atomically increment tokenVersion on password change', async () => {
      const bcrypt = require('bcryptjs');
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);

      const response = await request(app)
        .post('/api/users/change-password')
        .set('Cookie', [userACookie])
        .set('X-CSRF-Token', csrfToken)
        .send({
          currentPassword: 'currentPassword123',
          newPassword: 'newSecurePassword456!',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Password changed successfully');

      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        userAId,
        expect.objectContaining({
          $inc: { tokenVersion: 1 },
        })
      );

      bcrypt.compare.mockRestore();
    });

    it('should stage email change in pendingEmail with verification token when currentPassword is verified', async () => {
      const bcrypt = require('bcryptjs');
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);

      User.findOne.mockReturnValueOnce(null); // No collision with other email

      const response = await request(app)
        .patch('/api/users/me')
        .set('Cookie', [userACookie])
        .set('X-CSRF-Token', csrfToken)
        .send({
          email: 'alice_new_email@campus.edu',
          currentPassword: 'currentPassword123',
        });

      expect(response.status).toBe(200);

      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        userAId,
        expect.objectContaining({
          $set: expect.objectContaining({
            pendingEmail: 'alice_new_email@campus.edu',
            pendingEmailToken: expect.any(String),
          }),
        }),
        expect.anything()
      );

      bcrypt.compare.mockRestore();
    });

    it('should atomically increment tokenVersion on account deletion', async () => {
      const bcrypt = require('bcryptjs');
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);

      const response = await request(app)
        .delete('/api/users/me')
        .set('Cookie', [userACookie])
        .set('X-CSRF-Token', csrfToken)
        .send({
          confirmDelete: true,
          currentPassword: 'currentPassword123',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Account deleted successfully');

      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        userAId,
        { $inc: { tokenVersion: 1 } },
        expect.anything()
      );
      expect(User.findByIdAndDelete).toHaveBeenCalledWith(userAId, expect.anything());

      bcrypt.compare.mockRestore();
    });
  });

  describe('Test Suite 7: Email Verification & Privilege Enforcement', () => {
    it('should register user as unverified with hashed token and safe response', async () => {
      User.findOne.mockResolvedValueOnce(null); // No existing email
      const fakeCreatedUser = {
        _id: '507f1f77bcf86cd799439088',
        name: 'New Student',
        email: 'newstudent@campus.edu',
        role: 'user',
        isVerified: false,
        tokenVersion: 0,
        department: 'Science',
      };
      User.create = jest.fn().mockResolvedValue(fakeCreatedUser);

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'New Student',
          email: 'newstudent@campus.edu',
          password: 'Password123!',
          department: 'Science',
        });

      expect(response.status).toBe(201);
      expect(response.body.user).toHaveProperty('isVerified', false);
      expect(response.body.user).not.toHaveProperty('emailVerificationToken');
      expect(response.body.user).not.toHaveProperty('emailVerificationTokenExpires');

      // Verify token in DB was stored as a SHA-256 hash
      expect(User.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'newstudent@campus.edu',
          isVerified: false,
          emailVerificationToken: expect.stringMatching(/^[a-f0-9]{64}$/),
          emailVerificationTokenExpires: expect.any(Date),
        })
      );
    });

    it('should block unverified user from creating items with 403 and verification message', async () => {
      const response = await request(app)
        .post('/api/items')
        .set('Cookie', [unverifiedCookie])
        .set('X-CSRF-Token', csrfToken)
        .send({
          title: 'Lost Backpack',
          description: 'Black backpack left in math building',
          category: 'Personal Belongings',
          type: 'lost',
          location: 'Math Building Room 101',
          date_occurred: '2026-10-25',
        });

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty(
        'message',
        'Please verify your email address before performing this action.'
      );
    });

    it('should block unverified user from submitting claims with 403', async () => {
      const response = await request(app)
        .post(`/api/claims/${itemBId}`)
        .set('Cookie', [unverifiedCookie])
        .set('X-CSRF-Token', csrfToken)
        .send({
          lostItemId: '507f1f77bcf86cd799439041',
        });

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty(
        'message',
        'Please verify your email address before performing this action.'
      );
    });

    it('should block unverified user from uploading images with 403', async () => {
      const response = await request(app)
        .post('/api/upload')
        .set('Cookie', [unverifiedCookie])
        .set('X-CSRF-Token', csrfToken);

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty(
        'message',
        'Please verify your email address before performing this action.'
      );
    });

    it('should allow verified user to create items', async () => {
      Item.create = jest.fn().mockResolvedValue({
        _id: '507f1f77bcf86cd799439090',
        title: 'Found Keys',
        postedBy: userAId,
      });

      const response = await request(app)
        .post('/api/items')
        .set('Cookie', [userACookie])
        .set('X-CSRF-Token', csrfToken)
        .send({
          title: 'Found Keys',
          description: 'Set of 3 keys found near fountain',
          category: 'Keys',
          type: 'found',
          location: 'Campus Fountain',
          date_occurred: '2026-10-25',
          contact_email: 'alice@campus.edu',
        });

      expect(response.status).toBe(201);
    });

    it('should allow admin to bypass email verification on privileged actions', async () => {
      Item.create = jest.fn().mockResolvedValue({
        _id: '507f1f77bcf86cd799439091',
        title: 'Admin Created Item',
        postedBy: adminId,
      });

      const response = await request(app)
        .post('/api/items')
        .set('Cookie', [adminCookie])
        .set('X-CSRF-Token', csrfToken)
        .send({
          title: 'Admin Created Item',
          description: 'Official notice item',
          category: 'Other',
          type: 'found',
          location: 'Admin Office',
          date_occurred: '2026-10-25',
          contact_email: 'admin@campus.edu',
        });

      expect(response.status).toBe(201);
    });

    it('should verify email with valid token and clear token fields', async () => {
      const rawToken = crypto.randomBytes(32).toString('hex');
      const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

      const userToVerify = {
        _id: unverifiedUserId,
        email: 'unverified@campus.edu',
        isVerified: false,
        emailVerificationToken: hashedToken,
        emailVerificationTokenExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
        save: jest.fn().mockResolvedValue(true),
      };

      User.findOne.mockReturnValueOnce({
        select: jest.fn().mockResolvedValue(userToVerify),
      });

      const response = await request(app)
        .get(`/api/auth/verify-email?token=${rawToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('isVerified', true);
      expect(userToVerify.isVerified).toBe(true);
      expect(userToVerify.emailVerificationToken).toBeNull();
      expect(userToVerify.emailVerificationTokenExpires).toBeNull();
      expect(userToVerify.save).toHaveBeenCalled();
    });

    it('should reject verification with an expired token', async () => {
      const rawToken = crypto.randomBytes(32).toString('hex');
      const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

      const expiredUser = {
        _id: unverifiedUserId,
        email: 'unverified@campus.edu',
        isVerified: false,
        emailVerificationToken: hashedToken,
        emailVerificationTokenExpires: new Date(Date.now() - 1000), // Expired
        save: jest.fn().mockResolvedValue(true),
      };

      User.findOne.mockReturnValueOnce({
        select: jest.fn().mockResolvedValue(expiredUser),
      });

      const response = await request(app)
        .get(`/api/auth/verify-email?token=${rawToken}`);

      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(/expired/i);
    });

    it('should reject verification with a malformed token', async () => {
      const response = await request(app)
        .get('/api/auth/verify-email?token=not-a-valid-hex-token');

      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(/invalid or malformed/i);
    });

    it('should reject verification with a nonexistent or already used token', async () => {
      const rawToken = crypto.randomBytes(32).toString('hex');

      User.findOne.mockReturnValueOnce({
        select: jest.fn().mockResolvedValue(null),
      });

      const response = await request(app)
        .get(`/api/auth/verify-email?token=${rawToken}`);

      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(/invalid or expired/i);
    });

    it('should reject resend-verification when user is already verified', async () => {
      const response = await request(app)
        .post('/api/auth/resend-verification')
        .set('Cookie', [userACookie])
        .set('X-CSRF-Token', csrfToken);

      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(/already verified/i);
    });

    it('should resend verification email for unverified user and save new hashed token', async () => {
      mockUserUnverified.isVerified = false;
      mockUserUnverified.emailVerificationToken = null;
      mockUserUnverified.save = jest.fn().mockResolvedValue(true);

      const response = await request(app)
        .post('/api/auth/resend-verification')
        .set('Cookie', [unverifiedCookie])
        .set('X-CSRF-Token', csrfToken);

      expect(response.status).toBe(200);
      expect(response.body.message).toMatch(/verification email sent/i);
      expect(mockUserUnverified.emailVerificationToken).toMatch(/^[a-f0-9]{64}$/);
      expect(mockUserUnverified.save).toHaveBeenCalled();
    });

    it('should promote pendingEmail and increment tokenVersion when verifying email change', async () => {
      const rawToken = crypto.randomBytes(32).toString('hex');
      const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

      const userWithPendingEmail = {
        _id: userAId,
        email: 'alice@campus.edu',
        pendingEmail: 'alice_new@campus.edu',
        pendingEmailToken: hashedToken,
        pendingEmailTokenExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
        tokenVersion: 0,
        isVerified: true,
        save: jest.fn().mockResolvedValue(true),
      };

      User.findOne.mockReturnValueOnce({
        select: jest.fn().mockResolvedValue(userWithPendingEmail),
      });

      const response = await request(app)
        .post('/api/auth/verify-email')
        .send({ token: rawToken });

      expect(response.status).toBe(200);
      expect(response.body.message).toMatch(/email updated and verified successfully/i);
      expect(userWithPendingEmail.email).toBe('alice_new@campus.edu');
      expect(userWithPendingEmail.pendingEmail).toBeNull();
      expect(userWithPendingEmail.pendingEmailToken).toBeNull();
      expect(userWithPendingEmail.pendingEmailTokenExpires).toBeNull();
      expect(userWithPendingEmail.tokenVersion).toBe(1); // Revokes old sessions
      expect(userWithPendingEmail.save).toHaveBeenCalled();
    });
  });

  describe('Test Suite 8: Transactional Cascade Account Deletion', () => {
    const fs = require('fs');

    beforeEach(() => {
      Item.find.mockReturnValue({
        session: jest.fn().mockResolvedValue([
          {
            _id: itemBId,
            title: 'Lost Backpack',
            image_url: '/uploads/backpack-uuid-123.webp',
            postedBy: userAId,
          },
        ]),
      });
      Dispute.find.mockReturnValue({
        session: jest.fn().mockResolvedValue([
          {
            _id: '507f1f77bcf86cd799439055',
            itemId: itemBId,
            challengerId: userAId,
          },
        ]),
      });
      Dispute.countDocuments.mockReturnValue({
        session: jest.fn().mockResolvedValue(0),
      });
      Dispute.deleteMany.mockResolvedValue({ deletedCount: 1 });
      Claim.deleteMany.mockResolvedValue({ deletedCount: 1 });
      Notification.deleteMany.mockResolvedValue({ deletedCount: 1 });
      Activity.updateMany.mockResolvedValue({ modifiedCount: 1 });
      Item.deleteMany.mockResolvedValue({ deletedCount: 1 });
      Item.findByIdAndUpdate.mockResolvedValue({});
      User.findByIdAndUpdate.mockResolvedValue({});
      User.findByIdAndDelete.mockResolvedValue({});
    });

    it('should successfully execute transactional cascade deletion and remove upload files', async () => {
      const bcrypt = require('bcryptjs');
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);
      const unlinkSpy = jest.spyOn(fs.promises, 'unlink').mockResolvedValue();

      const response = await request(app)
        .delete('/api/users/me')
        .set('Cookie', [userACookie])
        .set('X-CSRF-Token', csrfToken)
        .send({
          confirmDelete: true,
          currentPassword: 'currentPassword123',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Account deleted successfully');

      // Verify transaction session was started and ended
      expect(mongoose.startSession).toHaveBeenCalled();

      // Verify cascade operations received the session
      expect(Claim.deleteMany).toHaveBeenCalledWith({ claimant: userAId }, expect.objectContaining({ session: expect.anything() }));
      expect(Dispute.deleteMany).toHaveBeenCalledWith({ _id: { $in: expect.any(Array) } }, expect.objectContaining({ session: expect.anything() }));
      expect(Notification.deleteMany).toHaveBeenCalledWith(expect.any(Object), expect.objectContaining({ session: expect.anything() }));
      expect(Activity.updateMany).toHaveBeenCalledWith(
        { userId: userAId },
        expect.objectContaining({
          $set: expect.objectContaining({
            userId: null,
            actorName: 'Deleted User',
          }),
        }),
        expect.objectContaining({ session: expect.anything() })
      );
      expect(Item.deleteMany).toHaveBeenCalledWith({ postedBy: userAId }, expect.objectContaining({ session: expect.anything() }));
      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(userAId, { $inc: { tokenVersion: 1 } }, expect.objectContaining({ session: expect.anything() }));
      expect(User.findByIdAndDelete).toHaveBeenCalledWith(userAId, expect.objectContaining({ session: expect.anything() }));

      // Verify physical upload file was unlinked post-commit
      expect(unlinkSpy).toHaveBeenCalledWith(expect.stringContaining('backpack-uuid-123.webp'));

      bcrypt.compare.mockRestore();
      unlinkSpy.mockRestore();
    });

    it('should roll back cleanly and not delete physical files if transaction fails', async () => {
      const bcrypt = require('bcryptjs');
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);
      const unlinkSpy = jest.spyOn(fs.promises, 'unlink').mockResolvedValue();

      // Simulate database failure during transaction
      Claim.deleteMany.mockRejectedValueOnce(new Error('Simulated DB write conflict'));

      const response = await request(app)
        .delete('/api/users/me')
        .set('Cookie', [userACookie])
        .set('X-CSRF-Token', csrfToken)
        .send({
          confirmDelete: true,
          currentPassword: 'currentPassword123',
        });

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', 'Account deletion failed. Please try again.');

      // CRITICAL: File unlink must NOT be called if transaction failed
      expect(unlinkSpy).not.toHaveBeenCalled();

      bcrypt.compare.mockRestore();
      unlinkSpy.mockRestore();
    });

    it('should reject unauthenticated deletion request with 401', async () => {
      const response = await request(app)
        .delete('/api/users/me')
        .set('Cookie', [`csrfToken=${csrfToken}`])
        .set('X-CSRF-Token', csrfToken)
        .send({
          confirmDelete: true,
          currentPassword: 'currentPassword123',
        });

      expect(response.status).toBe(401);
    });

    it('should reject deletion when confirmDelete is not true with 400', async () => {
      const response = await request(app)
        .delete('/api/users/me')
        .set('Cookie', [userACookie])
        .set('X-CSRF-Token', csrfToken)
        .send({
          confirmDelete: false,
          currentPassword: 'currentPassword123',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', 'Account deletion must be confirmed.');
    });

    it('should reject deletion when current password is wrong with 401', async () => {
      const bcrypt = require('bcryptjs');
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false);

      const response = await request(app)
        .delete('/api/users/me')
        .set('Cookie', [userACookie])
        .set('X-CSRF-Token', csrfToken)
        .send({
          confirmDelete: true,
          currentPassword: 'wrongPassword',
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('message', 'Incorrect current password.');

      bcrypt.compare.mockRestore();
    });

    it('should reject deletion request without valid CSRF token with 403', async () => {
      const response = await request(app)
        .delete('/api/users/me')
        .set('Cookie', [userACookie])
        .send({
          confirmDelete: true,
          currentPassword: 'currentPassword123',
        });

      expect(response.status).toBe(403);
    });
  });
});

