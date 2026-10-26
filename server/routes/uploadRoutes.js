const express = require('express');
const router = express.Router();
const { protect, requireVerifiedEmail } = require('../middleware/authMiddleware');
const { uploadSingle } = require('../middleware/upload');
const { processUploadedImage } = require('../middleware/imageProcessor');
const { uploadLimiter } = require('../middleware/rateLimiters');

// POST /api/upload
// Auth → verified check → limiter → memory Multer → magic-byte check + Sharp re-encode → handler
router.post('/', protect, requireVerifiedEmail, uploadLimiter, uploadSingle('image'), processUploadedImage, (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded. Please provide an image file.' });
  }

  const imageUrl = `/uploads/${req.file.filename}`;
  return res.status(200).json({
    message: 'File uploaded successfully',
    url: imageUrl,
    filename: req.file.filename,
    mimetype: req.file.mimetype,
    size: req.file.size,
  });
});

module.exports = router;
