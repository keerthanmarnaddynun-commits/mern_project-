process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_lostfound_super_secure';

const jwt = require('jsonwebtoken');
const request = require('supertest');

// Mock database connection before importing app
jest.mock('../config/db', () => jest.fn().mockResolvedValue(true));

// Mock Mongoose to prevent actual database connections and avoid hanging handles
jest.mock('mongoose', () => {
  const actualMongoose = jest.requireActual('mongoose');
  return {
    ...actualMongoose,
    connect: jest.fn().mockResolvedValue(true),
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
jest.mock('../models/Activity', () => ({
  create: jest.fn().mockResolvedValue({}),
}));

const User = require('../models/User');
const Item = require('../models/Item');
const Claim = require('../models/Claim');
const app = require('../server');

describe('Security & Access Control Integration Tests', () => {
  // Valid MongoDB ObjectIds
  const userAId = '507f1f77bcf86cd799439011';
  const userBId = '507f1f77bcf86cd799439012';
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
    toObject: () => ({
      _id: userAId,
      name: 'Alice Student',
      email: 'alice@campus.edu',
      role: 'user',
      department: 'Computer Science',
    }),
  };

  const mockUserB = {
    _id: userBId,
    name: 'Bob Scholar',
    email: 'bob@campus.edu',
    role: 'user',
    department: 'Physics',
    toObject: () => ({
      _id: userBId,
      name: 'Bob Scholar',
      email: 'bob@campus.edu',
      role: 'user',
      department: 'Physics',
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
  let adminToken;

  // HttpOnly Cookie strings
  let userACookie;
  let userBCookie;
  let adminCookie;

  beforeAll(() => {
    const secret = process.env.JWT_SECRET;

    userAToken = jwt.sign({ userId: userAId }, secret, { expiresIn: '1h' });
    userBToken = jwt.sign({ userId: userBId }, secret, { expiresIn: '1h' });
    adminToken = jwt.sign(
      { email: 'admin@campus.edu', role: 'admin' },
      secret,
      { expiresIn: '1h' }
    );

    userACookie = `token=${userAToken}`;
    userBCookie = `token=${userBToken}`;
    adminCookie = `token=${adminToken}`;
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock behavior for User.findById
    User.findById.mockImplementation((id) => {
      const idStr = id ? id.toString() : '';
      if (idStr === userAId) return Promise.resolve(mockUserA);
      if (idStr === userBId) return Promise.resolve(mockUserB);
      if (idStr === adminId) return Promise.resolve(mockAdminUser);
      return Promise.resolve(null);
    });

    // Default mock behavior for User.findOne (returns null for bad login attempts)
    User.findOne.mockReturnValue({
      select: jest.fn().mockResolvedValue(null),
    });

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
        .send({ title: 'Tampered Title by User A' });

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toMatch(/not authorized to modify this record/i);
    });

    it('should return 403 Forbidden when User A attempts to DELETE an Item owned by User B', async () => {
      const response = await request(app)
        .delete(`/api/items/${itemBId}`)
        .set('Cookie', [userACookie]);

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toMatch(/not authorized to modify this record/i);
    });

    it('should return 403 Forbidden when User A attempts to DELETE a Claim owned by User B', async () => {
      const response = await request(app)
        .delete(`/api/claims/${claimBId}`)
        .set('Cookie', [userACookie]);

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toMatch(/not authorized to modify this record/i);
    });

    it('should return 200 OK when an Admin modifies User B item (admin bypasses BOLA)', async () => {
      const response = await request(app)
        .patch(`/api/items/${itemBId}`)
        .set('Cookie', [adminCookie])
        .send({ title: 'Admin Authorized Modification' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('_id', itemBId);
    });

    it('should return 200 OK when an Admin deletes User B item (admin bypasses BOLA)', async () => {
      const response = await request(app)
        .delete(`/api/items/${itemBId}`)
        .set('Cookie', [adminCookie]);

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
});
