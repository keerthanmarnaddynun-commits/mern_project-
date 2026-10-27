const express = require('express');
const cors = require('cors');
require('dotenv').config();

if (process.env.NODE_ENV === 'test' && !process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'test_jwt_secret_lostfound_super_secure';
}

if (!process.env.JWT_SECRET || String(process.env.JWT_SECRET).trim() === '') {
  console.error(
    '\n[FATAL] JWT_SECRET is missing or empty.\n' +
      'Add JWT_SECRET to your server .env file (use a long random string, e.g. openssl rand -hex 32).\n'
  );
  process.exit(1);
}

const connectDB = require('./config/db');

// Security packages
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const path = require('path');
const { validateOriginAndCsrf, getAllowedOrigins } = require('./middleware/csrf');
const errorHandler = require('./middleware/errorHandler');
const { isWhitelistedIp } = require('./middleware/rateLimiters');

// Route imports
const authRoutes = require('./routes/authRoutes');
const itemRoutes = require('./routes/itemRoutes');
const claimRoutes = require('./routes/claimRoutes');
const userRoutes = require('./routes/userRoutes');
const adminRoutes = require('./routes/adminRoutes');
const publicRoutes = require('./routes/publicRoutes');
const disputeRoutes = require('./routes/disputeRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const uploadRoutes = require('./routes/uploadRoutes');

const app = express();

// Disable X-Powered-By header
app.disable('x-powered-by');

// Trust only the first hop (e.g., Render/Railway reverse proxy) to prevent X-Forwarded-For IP spoofing.
app.set('trust proxy', 1);

const isProduction = process.env.NODE_ENV === 'production';

// Mount Helmet early in the middleware chain with environment-aware CSP and security headers
app.use(
  helmet({
    contentSecurityPolicy: isProduction
      ? {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", 'data:'],
            connectSrc: ["'self'"],
            objectSrc: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
            frameAncestors: ["'none'"],
          },
        }
      : {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:', 'blob:'],
            connectSrc: ["'self'", 'ws:', 'http://localhost:*', 'http://127.0.0.1:*'],
            objectSrc: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
            frameAncestors: ["'none'"],
          },
        },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    hsts: isProduction
      ? {
          maxAge: 31536000,
          includeSubDomains: true,
          preload: false,
        }
      : false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    xContentTypeOptions: true,
  })
);

// Additional explicit security headers: Permissions-Policy (disabling camera, microphone, geolocation)
app.use((req, res, next) => {
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

// Connect Database
if (process.env.NODE_ENV !== 'test') {
  connectDB();
}

// Body Parser Middleware
app.use(express.json());

// Cookie Parser Middleware
app.use(cookieParser());

// Comprehensive NoSQL injection protection (validates and rejects forbidden operators & prototype pollution)
const { mongoSanitizeMiddleware } = require('./utils/sanitizeMongoInput');
app.use(mongoSanitizeMiddleware({ mode: 'validateStrict' }));


// ============================================================================
// CORS CONFIGURATION
// ============================================================================
// SECURITY NOTICE:
// Suffix matching (e.g., `origin.endsWith('.vercel.app')`) and wildcard matching
// are strictly forbidden. Any user can deploy an arbitrary app to Vercel (e.g.,
// https://attacker-app.vercel.app). When `credentials: true` is enabled, suffix
// matching allows any attacker-controlled Vercel subdomain to send authenticated
// cross-origin requests, exfiltrate cookies/JWTs, and perform actions as users/admins.
//
// Access-Control-Allow-Origin: * is also forbidden with credentials.
// Only explicit, exact-match origins are permitted.
// ============================================================================

const allowedOrigins = getAllowedOrigins();

const auditLogger = require('./utils/auditLogger');

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (such as server-to-server, curl, or mobile apps)
      if (!origin) {
        return callback(null, true);
      }

      // Strict exact-match verification against explicit allow-list
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      auditLogger.log({
        action: 'CORS_REQUEST_BLOCKED',
        category: 'SECURITY',
        severity: 'WARNING',
        outcome: 'BLOCKED',
        metadata: { origin },
      });

      // Reject unauthorized origins cleanly without leaking internal details
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
    exposedHeaders: ['RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset', 'Retry-After'],
    optionsSuccessStatus: 204,
  })
);

app.use('/api', validateOriginAndCsrf);

// Rate limiters are registered after CORS so 429 JSON bodies keep
// Access-Control-Allow-Origin and the browser can show the API message
// instead of a generic CORS failure.
const rateLimitAuditHandler = (actionName) => (req, res, next, options) => {
  auditLogger.log({
    req,
    action: actionName,
    category: 'SECURITY',
    severity: 'WARNING',
    outcome: 'BLOCKED',
    statusCode: options.statusCode || 429,
    metadata: {
      message: options.message?.message || options.message,
    },
  });
  return res.status(options.statusCode).json(options.message);
};

const rateLimitHeaders = {
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitAuditHandler('RATE_LIMIT_EXCEEDED'),
};

// Rate limiting: 100 req per 15 min globally across /api
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  ...rateLimitHeaders,
  skip: isWhitelistedIp,
  message: {
    message: 'Too many requests from this IP, please try again after 15 minutes',
  },
});

// Stricter rate limiting for login: 5 req per 15 min
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  ...rateLimitHeaders,
  handler: rateLimitAuditHandler('LOGIN_RATE_LIMIT_EXCEEDED'),
  message: {
    message: 'Too many login attempts from this IP, please try again after 15 minutes',
  },
});

app.use('/api', globalLimiter);
app.use('/api/users/login', loginLimiter);
app.use('/api/auth/login', loginLimiter);
app.use('/api/admin/login', loginLimiter);

app.use((req, res, next) => {
  console.log(req.method, req.url);
  next();
});

// Static uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  setHeaders: (res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'");
  },
}));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/claims', claimRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/disputes', disputeRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/upload', uploadRoutes);

// Test route
app.get('/', (req, res) => {
  res.send('API Running');
});

// Centralized error handling middleware mounted after all routes
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

if (process.env.NODE_ENV !== 'test' && require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;