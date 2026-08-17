import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import { requireAuth } from '../middleware/auth';

const router = Router();

fs.mkdirSync(config.uploadDir, { recursive: true });

// file.mimetype is the client-declared Content-Type — trivially spoofable,
// so it's only used to pick the allowlist bucket, never trusted for the
// saved filename's extension (a spoofed "image/jpeg" upload with an
// evil.html original filename must not end up saved as <uuid>.html) or as
// proof the bytes are actually what they claim (see verifyFileContent below).
const MIME_EXTENSION: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, config.uploadDir),
  filename: (_req, file, cb) => cb(null, `${uuidv4()}${MIME_EXTENSION[file.mimetype] ?? ''}`),
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!MIME_EXTENSION[file.mimetype]) {
      cb(new Error('Only JPEG, PNG, WebP images or PDF files are allowed'));
      return;
    }
    cb(null, true);
  },
});

// Checks the file's actual bytes match what its declared mimetype claimed —
// a declared Content-Type is just a client-supplied header, not proof of
// content. Images are re-parsed with sharp (throws on anything that isn't a
// genuinely decodable image); PDFs are checked for the real %PDF- magic
// header. Deletes the file and returns false on any mismatch.
async function verifyFileContent(filePath: string, mimetype: string): Promise<boolean> {
  try {
    if (mimetype === 'application/pdf') {
      const head = Buffer.alloc(5);
      const fd = fs.openSync(filePath, 'r');
      fs.readSync(fd, head, 0, 5, 0);
      fs.closeSync(fd);
      return head.toString('ascii') === '%PDF-';
    }
    const metadata = await sharp(filePath).metadata();
    return Boolean(metadata.format);
  } catch {
    return false;
  }
}

// Used for car photos, RC/insurance/PUC documents, KYC selfies, and
// signatures — hosts and guests upload the actual file rather than pasting a
// URL. Returns a relative /uploads/<file> path, served statically by server.ts.
router.post('/uploads', requireAuth, (req: Request, res: Response) => {
  upload.single('file')(req, res, async (err: any) => {
    if (err) return res.status(400).json({ error: err.message ?? 'Upload failed' });
    if (!req.file) return res.status(400).json({ error: 'No file provided' });

    const valid = await verifyFileContent(req.file.path, req.file.mimetype);
    if (!valid) {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({ error: 'File content does not match its declared type.' });
    }

    res.json({ success: true, data: { url: `/uploads/${req.file.filename}` } });
  });
});

const EPS = 1e-6;

function isFraction(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n >= -EPS && n <= 1 + EPS;
}

// Manually blurs a host-drawn rectangle (license plate) on an already-uploaded
// car photo. Coordinates are fractional [0,1] relative to the image's own
// pixel dimensions — resolution-independent regardless of how large the
// image was rendered in the browser. Writes a NEW file rather than
// overwriting the original, since Car.originalImages must keep the
// untouched original around for admin verification against registrationNo.
router.post('/uploads/blur-region', requireAuth, async (req: Request, res: Response) => {
  const { url, x, y, width, height } = req.body ?? {};

  if (typeof url !== 'string' || !url) {
    return res.status(400).json({ error: 'url is required' });
  }

  // Resolve the /uploads/<file> URL back to an absolute path the same way
  // multer's diskStorage writes it, and reject any attempt to escape uploadDir.
  const filename = path.basename(url);
  const resolvedUploadDir = path.resolve(config.uploadDir);
  const absolutePath = path.resolve(resolvedUploadDir, filename);
  if (absolutePath !== resolvedUploadDir && !absolutePath.startsWith(resolvedUploadDir + path.sep)) {
    return res.status(400).json({ error: 'Invalid file path' });
  }
  if (!fs.existsSync(absolutePath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  if (![x, y, width, height].every(isFraction)) {
    return res.status(400).json({ error: 'x, y, width, and height must all be numbers in [0, 1]' });
  }
  if (width <= 0 || height <= 0) {
    return res.status(400).json({ error: 'width and height must be greater than 0' });
  }
  if (x + width > 1 + EPS || y + height > 1 + EPS) {
    return res.status(400).json({ error: 'Region must lie within the image: x + width and y + height must each be <= 1' });
  }

  try {
    const metadata = await sharp(absolutePath).metadata();
    const imgWidth = metadata.width;
    const imgHeight = metadata.height;
    if (!imgWidth || !imgHeight) {
      return res.status(400).json({ error: 'Could not read image dimensions' });
    }

    const left = Math.min(imgWidth - 1, Math.max(0, Math.round(x * imgWidth)));
    const top = Math.min(imgHeight - 1, Math.max(0, Math.round(y * imgHeight)));
    const regionWidth = Math.min(imgWidth - left, Math.max(1, Math.round(width * imgWidth)));
    const regionHeight = Math.min(imgHeight - top, Math.max(1, Math.round(height * imgHeight)));

    // 1-2. Extract the plate region and blur it heavily (sigma 25 — strong
    // enough that no plate character stays legible, not just a soft blur).
    const blurredRegion = await sharp(absolutePath)
      .extract({ left, top, width: regionWidth, height: regionHeight })
      .blur(25)
      .toBuffer();

    // 3-4. Composite the blurred region back onto a FRESH read of the full
    // original image, then write to a brand-new file — the original on disk
    // (referenced by Car.originalImages) is never touched.
    const ext = path.extname(filename).toLowerCase() || '.jpg';
    const newFilename = `${uuidv4()}${ext}`;
    const newAbsolutePath = path.join(resolvedUploadDir, newFilename);

    await sharp(absolutePath)
      .composite([{ input: blurredRegion, left, top }])
      .toFile(newAbsolutePath);

    res.json({ success: true, data: { url: `/uploads/${newFilename}` } });
  } catch (err: any) {
    console.error('[UPLOADS] blur-region failed:', err.message);
    res.status(500).json({ error: 'Failed to process image' });
  }
});

export default router;
