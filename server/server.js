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
const mongoSanitize = require('express-mongo-sanitize');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const path = require('path');
const { multerErrorHandler } = require('./middleware/upload');

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

app.set('trust proxy', 1);

// Connect Database
if (process.env.NODE_ENV !== 'test') {
  connectDB();
}

// Body Parser Middleware
app.use(express.json());

// Cookie Parser Middleware
app.use(cookieParser());

// Strip NoSQL injection operators ($gt, etc.)
app.use((req, res, next) => {
  ['body', 'params', 'headers', 'query'].forEach((key) => {
    if (req[key]) {
      mongoSanitize.sanitize(req[key]);
    }
  });
  next();
});

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174'
];

app.use(cors({
  origin: function (origin, callback) {
    if (
      !origin ||
      allowedOrigins.includes(origin) ||
      origin.endsWith('.vercel.app')
    ) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting: 100 req per 15 min globally across /api
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: 'Too many requests from this IP, please try again after 15 minutes',
  },
});

// Stricter rate limiting for login: 5 req per 15 min
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
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
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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

// Multer error handling middleware (returns clean 400 JSON instead of HTML error pages)
app.use(multerErrorHandler);

// Test route
app.get('/', (req, res) => {
  res.send('API Running');
});

const PORT = process.env.PORT || 5000;

if (process.env.NODE_ENV !== 'test' && require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;