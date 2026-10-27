process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_lostfound_super_secure';
process.env.ADMIN_EMAIL = 'admin@campus.edu';
process.env.ADMIN_PASSWORD = 'AdminPassword123!';
process.env.FRONTEND_URL = 'http://localhost:5173';

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const sharp = require('sharp');
const request = require('supertest');

// Mock database connection before importing app
jest.mock('../../server/config/db', () => jest.fn().mockResolvedValue(true));

// In-memory AuditLog collection store
const auditLogsStore = [];

// Mock Mongoose connection & sessions
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

// Mock AuditLog with live in-memory storage
jest.mock('../../server/models/AuditLog', () => ({
  create: jest.fn(async (doc) => {
    const saved = {
      _id: 'audit_' + (auditLogsStore.length + 1),
      createdAt: new Date(),
      ...doc,
    };
    auditLogsStore.push(saved);
    return saved;
  }),
  find: jest.fn((filter = {}) => {
    let results = [...auditLogsStore];
    if (filter.category) {
      results = results.filter((l) => l.category === filter.category);
    }
    if (filter.severity) {
      results = results.filter((l) => l.severity === filter.severity);
    }
    if (filter.action) {
      results = results.filter((l) => l.action === filter.action);
    }
    return {
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockImplementation((skipVal) => {
        const skipped = results.slice(skipVal);
        return {
          limit: jest.fn().mockImplementation((limitVal) => {
            const limited = skipped.slice(0, limitVal);
            return {
              lean: jest.fn().mockResolvedValue(limited),
            };
          }),
        };
      }),
    };
  }),
  countDocuments: jest.fn(async () => auditLogsStore.length),
}));

// Mock other models
jest.mock('../../server/models/User');
jest.mock('../../server/models/Item');
jest.mock('../../server/models/Claim');
jest.mock('../../server/models/Dispute');
jest.mock('../../server/models/Notification');
jest.mock('../../server/models/Activity', () => ({
  create: jest.fn().mockResolvedValue({}),
  updateMany: jest.fn().mockResolvedValue({}),
}));

const User = require('../../server/models/User');
const Item = require('../../server/models/Item');
const Claim = require('../../server/models/Claim');
const Dispute = require('../../server/models/Dispute');
const Notification = require('../../server/models/Notification');
const Activity = require('../../server/models/Activity');
const AuditLog = require('../../server/models/AuditLog');
const app = require('../../server/server');

describe('End-to-End (E2E) Security Verification Suite', () => {
  const userAId = '507f1f77bcf86cd799439011';
  const userBId = '507f1f77bcf86cd799439012';
  const unverifiedUserId = '507f1f77bcf86cd799439099';
  const adminId = '000000000000000000000000';
  const itemAId = '507f1f77bcf86cd799439021';
  const itemBId = '507f1f77bcf86cd799439022';

  const defaultPasswordHash = bcrypt.hashSync('Password123!', 10);

  // In-memory user state
  let mockUserA;
  let mockUserB;
  let mockUserUnverified;
  let mockAdminUser;

  // In-memory item state
  let mockItemA;
  let mockItemB;

  // Tokens & Cookies
  let userAToken;
  let userBToken;
  let unverifiedToken;
  let adminToken;
  let csrfToken;
  let userACookie;
  let userBCookie;
  let unverifiedCookie;
  let adminCookie;

  beforeAll(() => {
    csrfToken = crypto.randomBytes(32).toString('hex');
    const secret = process.env.JWT_SECRET;

    userAToken = jwt.sign({ id: userAId, userId: userAId, role: 'user', tokenVersion: 0 }, secret, { expiresIn: '1h' });
    userBToken = jwt.sign({ id: userBId, userId: userBId, role: 'user', tokenVersion: 0 }, secret, { expiresIn: '1h' });
    unverifiedToken = jwt.sign({ id: unverifiedUserId, userId: unverifiedUserId, role: 'user', tokenVersion: 0 }, secret, { expiresIn: '1h' });
    adminToken = jwt.sign({ id: adminId, userId: adminId, email: 'admin@campus.edu', role: 'admin', tokenVersion: 0 }, secret, { expiresIn: '1h' });

    userACookie = `token=${userAToken}; csrfToken=${csrfToken}`;
    userBCookie = `token=${userBToken}; csrfToken=${csrfToken}`;
    unverifiedCookie = `token=${unverifiedToken}; csrfToken=${csrfToken}`;
    adminCookie = `token=${adminToken}; csrfToken=${csrfToken}`;
  });

  beforeEach(() => {
    // Reset mock user objects
    mockUserA = {
      _id: userAId,
      name: 'Student A',
      email: 'studenta@campus.edu',
      role: 'user',
      isVerified: true,
      tokenVersion: 0,
      password: defaultPasswordHash,
      save: jest.fn().mockResolvedValue(true),
      toObject: () => ({ ...mockUserA }),
    };

    mockUserB = {
      _id: userBId,
      name: 'Student B',
      email: 'studentb@campus.edu',
      role: 'user',
      isVerified: true,
      tokenVersion: 0,
      password: defaultPasswordHash,
      save: jest.fn().mockResolvedValue(true),
      toObject: () => ({ ...mockUserB }),
    };

    mockUserUnverified = {
      _id: unverifiedUserId,
      name: 'Unverified Student',
      email: 'unverified@campus.edu',
      role: 'user',
      isVerified: false,
      tokenVersion: 0,
      password: defaultPasswordHash,
      save: jest.fn().mockResolvedValue(true),
      toObject: () => ({ ...mockUserUnverified }),
    };

    mockAdminUser = {
      _id: adminId,
      name: 'System Admin',
      email: 'admin@campus.edu',
      role: 'admin',
      isVerified: true,
      tokenVersion: 0,
      password: defaultPasswordHash,
      save: jest.fn().mockResolvedValue(true),
      toObject: () => ({ ...mockAdminUser }),
    };

    mockItemA = {
      _id: itemAId,
      title: 'Student A Backpack',
      description: 'Black backpack with laptop',
      category: 'Electronics',
      type: 'found',
      location: 'Library 1st Floor',
      date_occurred: '2026-10-25',
      contact_email: 'studenta@campus.edu',
      postedBy: userAId,
      status: 'pending',
      custodyStatus: 'not_handed_over',
      is_resolved: false,
      save: jest.fn().mockResolvedValue(true),
      deleteOne: jest.fn().mockResolvedValue({ acknowledged: true, deletedCount: 1 }),
      toObject: () => ({ ...mockItemA }),
    };

    mockItemB = {
      _id: itemBId,
      title: 'Student B Hydroflask',
      description: 'Blue insulated bottle',
      category: 'Personal Belongings',
      type: 'found',
      location: 'Cafeteria',
      date_occurred: '2026-10-26',
      contact_email: 'studentb@campus.edu',
      postedBy: userBId,
      status: 'pending',
      custodyStatus: 'not_handed_over',
      is_resolved: false,
      save: jest.fn().mockResolvedValue(true),
      deleteOne: jest.fn().mockResolvedValue({ acknowledged: true, deletedCount: 1 }),
      toObject: () => ({ ...mockItemB }),
    };

    // Set up model find implementations
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

    User.findOne.mockImplementation((query) => {
      const email = query?.email;
      let doc = null;
      if (email === 'studenta@campus.edu') doc = mockUserA;
      else if (email === 'studentb@campus.edu') doc = mockUserB;
      else if (email === 'unverified@campus.edu') doc = mockUserUnverified;
      else if (email === 'admin@campus.edu') doc = mockAdminUser;

      const p = Promise.resolve(doc);
      p.select = jest.fn().mockResolvedValue(doc);
      return p;
    });

    Item.findById.mockImplementation((id) => {
      const idStr = id ? id.toString() : '';
      let doc = null;
      if (idStr === itemAId) doc = mockItemA;
      else if (idStr === itemBId) doc = mockItemB;

      const p = Promise.resolve(doc);
      p.session = jest.fn().mockResolvedValue(doc);
      return p;
    });
  });

  // ==========================================================================
  // PHASE 1: HTTP Hardening, CORS & Public PII Boundaries
  // ==========================================================================
  describe('PHASE 1: HTTP Hardening, CORS & Public PII Boundaries', () => {
    it('1.1 should set strict Helmet headers and remove X-Powered-By', async () => {
      const res = await request(app).get('/api/public/stats');

      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers).toHaveProperty('content-security-policy');
      expect(res.headers['x-powered-by']).toBeUndefined();
    });

    it('1.2 should block unauthorized CORS origin and log CORS_REQUEST_BLOCKED', async () => {
      const res = await request(app)
        .get('/api/public/stats')
        .set('Origin', 'https://evil-attacker.example.com');

      // Rejected by CORS callback
      expect([403, 500]).toContain(res.status);
      const corsLog = auditLogsStore.find((l) => l.action === 'CORS_REQUEST_BLOCKED');
      expect(corsLog).toBeDefined();
      expect(corsLog.category).toBe('SECURITY');
      expect(corsLog.outcome).toBe('BLOCKED');
      expect(corsLog.metadata.origin).toBe('https://evil-attacker.example.com');
    });

    it('1.3 should verify PII projection on public endpoints and enforce pagination cap', async () => {
      Item.find.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockImplementation((limitVal) => {
          expect(limitVal).toBeLessThanOrEqual(100);
          return Promise.resolve([
            {
              _id: itemAId,
              title: 'Student A Backpack',
              category: 'Electronics',
              type: 'found',
              location: 'Library',
            },
          ]);
        }),
      });

      const res = await request(app).get('/api/items?limit=999999');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);

      // Verify no PII fields leaked
      res.body.forEach((item) => {
        expect(item.password).toBeUndefined();
        expect(item.tokenVersion).toBeUndefined();
        expect(item.verificationToken).toBeUndefined();
        expect(item.resetPasswordToken).toBeUndefined();
        expect(item.contact_email).toBeUndefined();
      });
    });
  });

  // ==========================================================================
  // PHASE 2: Layer Interception — CSRF + NoSQL Injection + ObjectId Validation
  // ==========================================================================
  describe('PHASE 2: Layer Interception — CSRF + NoSQL Injection + ObjectId Validation', () => {
    it('2.1 should verify CSRF passes but mongoSanitizeMiddleware blocks NoSQL injection payloads', async () => {
      const payloads = [
        JSON.stringify({ email: { $gt: '' }, password: { $ne: '' } }),
        JSON.stringify({ email: 'studenta@campus.edu', $where: 'return true' }),
        '{"__proto__": {"role": "admin"}, "email": "studenta@campus.edu", "password": "Password123!"}',
      ];

      for (const rawPayload of payloads) {
        const res = await request(app)
          .post('/api/auth/login')
          .set('Origin', 'http://localhost:5173')
          .set('Content-Type', 'application/json')
          .send(rawPayload);

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('message', 'Invalid request input.');
      }

      // Query string injection
      const queryRes = await request(app)
        .get('/api/items?status[$ne]=lost')
        .set('Origin', 'http://localhost:5173');

      expect(queryRes.status).toBe(400);
      expect(queryRes.body).toHaveProperty('message', 'Invalid request input.');
    });

    it('2.2 should reject malformed ObjectIds with 400 Bad Request without leaking stack traces', async () => {
      // 1. GET /api/items/12345-malformed
      const itemRes = await request(app)
        .get('/api/items/12345-malformed')
        .set('Cookie', [userACookie]);
      expect(itemRes.status).toBe(400);
      expect(itemRes.body).toHaveProperty('message');
      expect(itemRes.body.message).toMatch(/Invalid ID/i);
      expect(itemRes.body.stack).toBeUndefined();

      // 2. PATCH /api/claims/not-an-object-id/approve (Admin authenticated + valid CSRF)
      const claimRes = await request(app)
        .patch('/api/claims/not-an-object-id/approve')
        .set('Cookie', [adminCookie])
        .set('X-CSRF-Token', csrfToken)
        .set('Origin', 'http://localhost:5173');
      expect(claimRes.status).toBe(400);
      expect(claimRes.body).toHaveProperty('message');
      expect(claimRes.body.message).toMatch(/Invalid ID/i);
      expect(claimRes.body.stack).toBeUndefined();

      // 3. PATCH /api/notifications/bad-id/read (User authenticated + valid CSRF)
      const notifRes = await request(app)
        .patch('/api/notifications/bad-id/read')
        .set('Cookie', [userACookie])
        .set('X-CSRF-Token', csrfToken)
        .set('Origin', 'http://localhost:5173');
      expect(notifRes.status).toBe(400);
      expect(notifRes.body).toHaveProperty('message');
      expect(notifRes.body.message).toMatch(/Invalid ID/i);
      expect(notifRes.body.stack).toBeUndefined();
    });

    it('2.3 should safely escape special regex characters in search query', async () => {
      Item.find.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]),
      });

      const res = await request(app)
        .get('/api/items')
        .query({ search: '.*(a+)+$' });

      expect(res.status).toBe(200);
    });
  });

  // ==========================================================================
  // PHASE 3: Transport Security, CSRF & Origin Validation
  // ==========================================================================
  describe('PHASE 3: Transport Security, CSRF & Origin Validation', () => {
  it('3.1 should authenticate user and set JWT in HttpOnly SameSite=Strict cookie', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'studenta@campus.edu',
          password: 'Password123!',
        });

      expect(res.status).toBe(200);
      const setCookie = res.headers['set-cookie'];
      expect(setCookie).toBeDefined();

      const tokenCookie = setCookie.find((c) => c.startsWith('token='));
      expect(tokenCookie).toBeDefined();
      expect(tokenCookie).toMatch(/HttpOnly/i);
      expect(tokenCookie).toMatch(/SameSite=Strict/i);
    });

    it('3.2 should block state-changing requests when CSRF token is missing, mismatched, or from untrusted origin', async () => {
      // Missing X-CSRF-Token header
      const missingRes = await request(app)
        .post('/api/items')
        .set('Cookie', [userACookie])
        .set('Origin', 'http://localhost:5173')
        .send({ title: 'New Item' });

      expect(missingRes.status).toBe(403);

      // Mismatched X-CSRF-Token header
      const mismatchRes = await request(app)
        .post('/api/items')
        .set('Cookie', [userACookie])
        .set('Origin', 'http://localhost:5173')
        .set('X-CSRF-Token', 'wrong-csrf-token-12345')
        .send({ title: 'New Item' });

      expect(mismatchRes.status).toBe(403);

      // Untrusted Referer header
      const originRes = await request(app)
        .post('/api/items')
        .set('Cookie', [userACookie])
        .set('Referer', 'https://malicious-origin.com/attack')
        .set('X-CSRF-Token', csrfToken)
        .send({ title: 'New Item' });

      expect(originRes.status).toBe(403);

      // Verify CSRF_VALIDATION_FAILED logged
      const csrfLogs = auditLogsStore.filter((l) => l.action === 'CSRF_VALIDATION_FAILED');
      expect(csrfLogs.length).toBeGreaterThanOrEqual(3);
    });
  });

  // ==========================================================================
  // PHASE 4: Identity Gatekeeping, Re-Authentication & Token Revocation
  // ==========================================================================
  describe('PHASE 4: Identity Gatekeeping, Re-Authentication & Token Revocation', () => {
    it('4.1 should block unverified user from creating items with 403 UNVERIFIED_EMAIL_BLOCKED', async () => {
      const res = await request(app)
        .post('/api/items')
        .set('Cookie', [unverifiedCookie])
        .set('X-CSRF-Token', csrfToken)
        .set('Origin', 'http://localhost:5173')
        .send({ title: 'Keys' });

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/verify your email/i);

      const unverifiedLog = auditLogsStore.find((l) => l.action === 'UNVERIFIED_EMAIL_BLOCKED');
      expect(unverifiedLog).toBeDefined();
      expect(unverifiedLog.actorId.toString()).toBe(unverifiedUserId);
    });

    it('4.2 should reject profile updates/deletions without valid currentPassword', async () => {
      // Without currentPassword
      const noPassRes = await request(app)
        .put('/api/users/profile')
        .set('Cookie', [userACookie])
        .set('X-CSRF-Token', csrfToken)
        .set('Origin', 'http://localhost:5173')
        .send({ email: 'newemail@campus.edu' });

      expect(noPassRes.status).toBe(400);

      // With wrong currentPassword
      const wrongPassRes = await request(app)
        .put('/api/users/profile')
        .set('Cookie', [userACookie])
        .set('X-CSRF-Token', csrfToken)
        .set('Origin', 'http://localhost:5173')
        .send({ email: 'newemail@campus.edu', currentPassword: 'WrongPassword999!' });

      expect(wrongPassRes.status).toBe(401);
    });

    it('4.3 should increment tokenVersion on password change and reject old JWT cookie', async () => {
      User.findByIdAndUpdate.mockImplementationOnce((id, update) => {
        if (update?.$inc?.tokenVersion) {
          mockUserA.tokenVersion += update.$inc.tokenVersion;
        }
        return Promise.resolve(mockUserA);
      });

      const changeRes = await request(app)
        .post('/api/users/change-password')
        .set('Cookie', [userACookie])
        .set('X-CSRF-Token', csrfToken)
        .set('Origin', 'http://localhost:5173')
        .send({
          currentPassword: 'Password123!',
          newPassword: 'NewSecurePassword456!',
        });

      expect(changeRes.status).toBe(200);
      expect(mockUserA.tokenVersion).toBe(1);

      // Replay OLD JWT cookie (tokenVersion: 0) on protected route
      const replayRes = await request(app)
        .get('/api/users/profile')
        .set('Cookie', [userACookie]);

      expect(replayRes.status).toBe(401);
      expect(replayRes.body.message).toMatch(/session expired or invalid/i);
    });
  });

  // ==========================================================================
  // PHASE 5: Access Control Matrix (Ownership / IDOR & Role Escalation)
  // ==========================================================================
  describe('PHASE 5: Access Control Matrix (Ownership / IDOR & Role Escalation)', () => {
    it('5.1 should prevent Horizontal Privilege Escalation (Student B modifying/deleting Student A item)', async () => {
      // Student B attempts to modify Student A's item
      const patchRes = await request(app)
        .patch(`/api/items/${itemAId}`)
        .set('Cookie', [userBCookie])
        .set('X-CSRF-Token', csrfToken)
        .set('Origin', 'http://localhost:5173')
        .send({ title: 'Hijacked Title' });

      expect(patchRes.status).toBe(403);
      expect(patchRes.body.message).toMatch(/not authorized/i);

      // Student B attempts to delete Student A's item
      const deleteRes = await request(app)
        .delete(`/api/items/${itemAId}`)
        .set('Cookie', [userBCookie])
        .set('X-CSRF-Token', csrfToken)
        .set('Origin', 'http://localhost:5173');

      expect(deleteRes.status).toBe(403);
      expect(deleteRes.body.message).toMatch(/not authorized/i);
    });

    it('5.2 should prevent Vertical Privilege Escalation (Student A accessing Admin/Faculty routes)', async () => {
      // Student A attempts to access admin claims
      const claimsRes = await request(app)
        .get('/api/admin/claims')
        .set('Cookie', [userACookie]);

      expect(claimsRes.status).toBe(403);

      // Student A attempts to access admin audit logs
      const auditRes = await request(app)
        .get('/api/admin/audit-logs')
        .set('Cookie', [userACookie]);

      expect(auditRes.status).toBe(403);

      // Student A attempts to resolve dispute (requires admin/faculty role)
      const disputeRes = await request(app)
        .patch('/api/disputes/507f1f77bcf86cd799439091/resolve')
        .set('Cookie', [userACookie])
        .set('X-CSRF-Token', csrfToken)
        .set('Origin', 'http://localhost:5173')
        .send({ action: 'approve' });

      expect(disputeRes.status).toBe(403);

      const adminDeniedLog = auditLogsStore.find((l) => l.action === 'ADMIN_ACCESS_DENIED');
      expect(adminDeniedLog).toBeDefined();

      const roleDeniedLog = auditLogsStore.find((l) => l.action === 'ROLE_AUTHORIZATION_DENIED');
      expect(roleDeniedLog).toBeDefined();
    });
  });

  // ==========================================================================
  // PHASE 6: Magic-Byte Upload Security & Transactional Cascade Integrity
  // ==========================================================================
  describe('PHASE 6: Magic-Byte Upload Security & Transactional Cascade Integrity', () => {
    it('6.1 should reject spoofed PHP script and accept valid image magic bytes', async () => {
      // 1. Spoofed PHP shell with .jpg extension
      const fakePhpScript = Buffer.from('<?php system($_GET["cmd"]); ?>');
      const badUploadRes = await request(app)
        .post('/api/upload')
        .set('Cookie', [userACookie])
        .set('X-CSRF-Token', csrfToken)
        .set('Origin', 'http://localhost:5173')
        .attach('image', fakePhpScript, 'found_wallet.jpg');

      expect(badUploadRes.status).toBe(400);
      expect(badUploadRes.body.message).toMatch(/Invalid image file/i);

      // 2. Valid image generated via Sharp
      const validJpeg = await sharp({
        create: {
          width: 10,
          height: 10,
          channels: 3,
          background: { r: 255, g: 0, b: 0 },
        },
      })
        .jpeg()
        .toBuffer();

      const goodUploadRes = await request(app)
        .post('/api/upload')
        .set('Cookie', [userACookie])
        .set('X-CSRF-Token', csrfToken)
        .set('Origin', 'http://localhost:5173')
        .attach('image', validJpeg, 'photo.jpg');

      expect(goodUploadRes.status).toBe(200);
      expect(goodUploadRes.body).toHaveProperty('url');
    });

    it('6.2 should execute transactional cascade account deletion cleanly with audit event', async () => {
      Item.find.mockReturnValueOnce(Promise.resolve([]));
      Claim.deleteMany.mockResolvedValue({ acknowledged: true, deletedCount: 0 });
      Dispute.find.mockReturnValueOnce(Promise.resolve([]));
      Notification.deleteMany.mockResolvedValue({ acknowledged: true, deletedCount: 0 });
      User.findByIdAndUpdate.mockResolvedValue(mockUserA);
      User.findByIdAndDelete.mockResolvedValue(mockUserA);

      const deleteRes = await request(app)
        .delete('/api/users/profile')
        .set('Cookie', [userACookie])
        .set('X-CSRF-Token', csrfToken)
        .set('Origin', 'http://localhost:5173')
        .send({
          confirmDelete: true,
          currentPassword: 'Password123!',
        });

      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.message).toMatch(/Account deleted successfully/i);

      const deleteLog = auditLogsStore.find((l) => l.action === 'USER_ACCOUNT_DELETED');
      expect(deleteLog).toBeDefined();
      expect(deleteLog.actorId.toString()).toBe(userAId);
    });
  });

  // ==========================================================================
  // PHASE 7: Rate Limiting & Master Audit Log Verification
  // ==========================================================================
  describe('PHASE 7: Rate Limiting & Master Audit Log Verification', () => {
    it('7.1 should block excessive requests with 429 Too Many Requests and log LOGIN_RATE_LIMIT_EXCEEDED', async () => {
      let lastRes;
      // Login rate limiter threshold is 5 requests per 15 minutes
      for (let i = 0; i < 6; i++) {
        lastRes = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'rate-limit-test@campus.edu',
            password: 'AnyPassword123!',
          });
      }

      expect(lastRes.status).toBe(429);
      expect(lastRes.body.message).toMatch(/too many login attempts/i);

      const rateLimitLog = auditLogsStore.find((l) => l.action === 'LOGIN_RATE_LIMIT_EXCEEDED');
      expect(rateLimitLog).toBeDefined();
      expect(rateLimitLog.statusCode).toBe(429);
    });

    it('7.2 should allow admin to view master audit logs and assert zero sensitive keys in metadata', async () => {
      const res = await request(app)
        .get('/api/admin/audit-logs?limit=100')
        .set('Cookie', [adminCookie]);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('logs');
      expect(Array.isArray(res.body.logs)).toBe(true);
      expect(res.body.logs.length).toBeGreaterThan(0);

      // Verify all required key security audit actions were recorded across phases
      const recordedActions = new Set(auditLogsStore.map((l) => l.action));
      expect(recordedActions.has('CSRF_VALIDATION_FAILED')).toBe(true);
      expect(recordedActions.has('UNVERIFIED_EMAIL_BLOCKED')).toBe(true);
      expect(recordedActions.has('ADMIN_ACCESS_DENIED')).toBe(true);
      expect(recordedActions.has('USER_PASSWORD_CHANGED')).toBe(true);
      expect(recordedActions.has('USER_ACCOUNT_DELETED')).toBe(true);
      expect(recordedActions.has('LOGIN_RATE_LIMIT_EXCEEDED')).toBe(true);

      // Strict metadata inspection: Zero credential leaks allowed across entire collection
      const FORBIDDEN_METADATA_KEYS = [
        'password',
        'currentPassword',
        'newPassword',
        'token',
        'jwt',
        'csrfToken',
        'cookie',
      ];

      function assertNoSensitiveKeys(obj, path = '') {
        if (!obj || typeof obj !== 'object') return;
        for (const [key, val] of Object.entries(obj)) {
          const currentPath = path ? `${path}.${key}` : key;
          expect(FORBIDDEN_METADATA_KEYS).not.toContain(key.toLowerCase());
          if (val && typeof val === 'object') {
            assertNoSensitiveKeys(val, currentPath);
          }
        }
      }

      auditLogsStore.forEach((log) => {
        assertNoSensitiveKeys(log.metadata);
      });
    });
  });
});
