const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const INVALID_IMAGE_MESSAGE = 'Invalid image file. Only JPEG, PNG, and WebP images are allowed.';
const MAX_WIDTH = 2000;

const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

async function detectFileType(buffer) {
  const { fileTypeFromBuffer } = await import('file-type');
  return fileTypeFromBuffer(buffer);
}

async function processImageBuffer(buffer) {
  const fileType = await detectFileType(buffer);
  if (!fileType || !ALLOWED_MIME_TYPES.has(fileType.mime)) {
    const err = new Error(INVALID_IMAGE_MESSAGE);
    err.statusCode = 400;
    throw err;
  }

  const image = sharp(buffer, { failOnError: true, sequentialRead: true });
  const metadata = await image.metadata();

  let pipeline = sharp(buffer, { failOnError: true }).rotate();
  if (metadata.width && metadata.width > MAX_WIDTH) {
    pipeline = pipeline.resize({
      width: MAX_WIDTH,
      withoutEnlargement: true,
    });
  }

  // Re-encode to WebP and strip EXIF/ICC by omitting withMetadata()
  return pipeline.webp({ quality: 80, effort: 4 }).toBuffer();
}

const processUploadedImage = async (req, res, next) => {
  try {
    if (!req.file || !req.file.buffer) {
      return next();
    }

    const processed = await processImageBuffer(req.file.buffer);
    const filename = `${crypto.randomUUID()}.webp`;
    const destPath = path.join(uploadDir, filename);

    await fs.promises.writeFile(destPath, processed);

    req.file.filename = filename;
    req.file.path = destPath;
    req.file.mimetype = 'image/webp';
    req.file.size = processed.length;
    req.file.buffer = undefined;

    return next();
  } catch (error) {
    console.error('[imageProcessor]', error.message);
    return res.status(400).json({ message: INVALID_IMAGE_MESSAGE });
  }
};

module.exports = {
  processUploadedImage,
  processImageBuffer,
  uploadDir,
};
