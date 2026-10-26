const multer = require('multer');
const path = require('path');

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
  const ext = path.extname(file.originalname || '').toLowerCase();

  if (allowedMimeTypes.includes(file.mimetype) && allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid image file. Only JPEG, PNG, and WebP images are allowed.'));
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
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
        return res.status(400).json({
          message: err.message || 'Invalid image file. Only JPEG, PNG, and WebP images are allowed.',
        });
      }
      next();
    });
  };
};

const multerErrorHandler = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'File size exceeds 5MB limit' });
    }
    return res.status(400).json({ message: `Upload error: ${err.message}` });
  }
  if (err && err.message && err.message.includes('Invalid image file')) {
    return res.status(400).json({ message: err.message });
  }
  next(err);
};

module.exports = upload;
module.exports.upload = upload;
module.exports.uploadSingle = uploadSingle;
module.exports.multerErrorHandler = multerErrorHandler;
