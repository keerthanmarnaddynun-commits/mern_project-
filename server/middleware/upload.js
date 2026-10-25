const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure disk storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

// Strict file filter: only allow image/jpeg, image/png, image/webp
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedMimeTypes.includes(file.mimetype) && allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, and WebP images are allowed.'));
  }
};

// Strict limits: 5MB file size limit
const limits = {
  fileSize: 5 * 1024 * 1024, // 5MB
};

const upload = multer({
  storage,
  limits,
  fileFilter,
});

/**
 * Middleware wrapper that catches Multer errors (file size limits, invalid file types)
 * and returns a clean 400 Bad Request with a JSON error message instead of crashing
 * or returning a raw HTML stack trace.
 */
const uploadSingle = (fieldName = 'image') => {
  return (req, res, next) => {
    upload.single(fieldName)(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ message: 'File size exceeds 5MB limit' });
          }
          return res.status(400).json({ message: `Upload error: ${err.message}` });
        }
        return res.status(400).json({ message: err.message || 'Invalid file upload' });
      }
      next();
    });
  };
};

/**
 * Express error handling middleware for Multer errors
 */
const multerErrorHandler = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'File size exceeds 5MB limit' });
    }
    return res.status(400).json({ message: `Upload error: ${err.message}` });
  } else if (err && err.message && err.message.includes('Invalid file type')) {
    return res.status(400).json({ message: err.message });
  }
  next(err);
};

module.exports = upload;
module.exports.upload = upload;
module.exports.uploadSingle = uploadSingle;
module.exports.multerErrorHandler = multerErrorHandler;
