const express = require('express');
const router = express.Router();
const path = require('path');
const { protect } = require('../middleware/authMiddleware');
const { uploadSingle } = require('../middleware/upload');

// POST /api/upload
// Securely upload an image (max 5MB, JPEG/PNG/WebP only)
router.post('/', protect, uploadSingle('image'), (req, res) => {
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
