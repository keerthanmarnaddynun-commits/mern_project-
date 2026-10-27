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
  try {
    const { fileTypeFromBuffer } = await import('file-type');
    return await fileTypeFromBuffer(buffer);
  } catch (error) {
    if (!buffer || !Buffer.isBuffer(buffer) || buffer.length < 4) {
      return null;
    }
    // JPEG: FF D8 FF
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return { mime: 'image/jpeg', ext: 'jpg' };
    }
    // PNG: 89 50 4E 47
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
      return { mime: 'image/png', ext: 'png' };
    }
    // WebP: RIFF .... WEBP
    if (
      buffer.length >= 12 &&
      buffer[0] === 0x52 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x46 &&
      buffer.toString('utf8', 8, 12) === 'WEBP'
    ) {
      return { mime: 'image/webp', ext: 'webp' };
    }
    return null;
  }
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
