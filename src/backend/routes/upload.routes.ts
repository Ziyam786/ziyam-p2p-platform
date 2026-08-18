import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import axios from 'axios';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import { requireAuth } from '../middleware/auth';
import { isStorageConfigured, getStorageBucket } from '../services/firebaseAdmin';

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

// Buffered in memory, not written to local disk first — the destination
// (Firebase Storage, or local disk as a fallback when it's not configured)
// is decided after content verification, not before.
const upload = multer({
  storage: multer.memoryStorage(),
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
// genuinely decodable image); PDFs are checked for the real %PDF- magic header.
async function verifyFileContent(buffer: Buffer, mimetype: string): Promise<boolean> {
  try {
    if (mimetype === 'application/pdf') {
      return buffer.subarray(0, 5).toString('ascii') === '%PDF-';
    }
    const metadata = await sharp(buffer).metadata();
    return Boolean(metadata.format);
  } catch {
    return false;
  }
}

/**
 * Saves a verified file buffer and returns its URL. Firebase Storage when
 * configured (absolute, CDN-backed public URL); local disk otherwise, same
 * relative /uploads/<file> path (served by server.ts's express.static) this
 * app used before the Storage migration — a deliberate fallback, not a
 * removed feature, so uploads still work in local dev without Firebase creds.
 */
async function saveFile(buffer: Buffer, mimetype: string): Promise<string> {
  const filename = `${uuidv4()}${MIME_EXTENSION[mimetype] ?? ''}`;
  if (isStorageConfigured()) {
    const file = getStorageBucket().file(filename);
    await file.save(buffer, { contentType: mimetype, public: true });
    return file.publicUrl();
  }
  await fs.promises.writeFile(path.join(config.uploadDir, filename), buffer);
  return `/uploads/${filename}`;
}

/**
 * Fetches the bytes of an already-saved upload, whichever backend it lives
 * on — a relative /uploads/<file> path (files saved before the Storage
 * migration, or saved locally because Storage wasn't configured) is read
 * straight off disk.
 *
 * `url` is client-supplied (POST /uploads/blur-region's body), so the HTTPS
 * branch is an allowlist, not a generic fetch: only a URL that already
 * points at OUR OWN Firebase Storage bucket is permitted. Anything looser
 * is SSRF — a caller could otherwise hand the server an internal or
 * cloud-metadata URL and have it fetched server-side. Host is checked via
 * the parsed URL's `.hostname` (immune to userinfo/`@`-tricks and IDN
 * lookalikes, unlike a substring test on the raw string), and the path
 * check runs after WHATWG URL normalization so a `..`-segment can't escape
 * the bucket prefix. Redirects are disabled so a 3xx can't be used to hop
 * off the allowlisted host after the check has already passed.
 */
async function fetchSavedFileBuffer(url: string): Promise<Buffer> {
  if (/^https?:\/\//i.test(url)) {
    const bucketName = isStorageConfigured() ? config.firebase.storageBucket : null;
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new Error('Invalid file URL');
    }
    if (!bucketName || parsed.protocol !== 'https:' || parsed.hostname !== 'storage.googleapis.com' || !parsed.pathname.startsWith(`/${bucketName}/`)) {
      throw new Error('Invalid file URL');
    }
    const res = await axios.get(url, { responseType: 'arraybuffer', maxRedirects: 0, timeout: 15_000 });
    return Buffer.from(res.data);
  }
  const resolvedUploadDir = path.resolve(config.uploadDir);
  const absolutePath = path.resolve(resolvedUploadDir, path.basename(url));
  if (absolutePath !== resolvedUploadDir && !absolutePath.startsWith(resolvedUploadDir + path.sep)) {
    throw new Error('Invalid file path');
  }
  return fs.promises.readFile(absolutePath);
}

// Used for car photos, RC/insurance/PUC documents, KYC selfies, and
// signatures — hosts and guests upload the actual file rather than pasting a URL.
router.post('/uploads', requireAuth, (req: Request, res: Response) => {
  upload.single('file')(req, res, async (err: any) => {
    if (err) return res.status(400).json({ error: err.message ?? 'Upload failed' });
    if (!req.file) return res.status(400).json({ error: 'No file provided' });

    const valid = await verifyFileContent(req.file.buffer, req.file.mimetype);
    if (!valid) {
      return res.status(400).json({ error: 'File content does not match its declared type.' });
    }

    try {
      const url = await saveFile(req.file.buffer, req.file.mimetype);
      res.json({ success: true, data: { url } });
    } catch (saveErr: any) {
      console.error('[UPLOADS] save failed:', saveErr.message);
      res.status(502).json({ error: 'Could not save the uploaded file right now. Please try again.' });
    }
  });
});

const EPS = 1e-6;

function isFraction(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n >= -EPS && n <= 1 + EPS;
}

// Manually blurs a host-drawn rectangle (license plate) on an already-uploaded
// car photo. Coordinates are fractional [0,1] relative to the image's own
// pixel dimensions — resolution-independent regardless of how large the
// image was rendered in the browser. Saves a NEW file rather than
// overwriting the original, since Car.originalImages must keep the
// untouched original around for admin verification against registrationNo.
router.post('/uploads/blur-region', requireAuth, async (req: Request, res: Response) => {
  const { url, x, y, width, height } = req.body ?? {};

  if (typeof url !== 'string' || !url) {
    return res.status(400).json({ error: 'url is required' });
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
    const original = await fetchSavedFileBuffer(url);
    const metadata = await sharp(original).metadata();
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
    const blurredRegion = await sharp(original).extract({ left, top, width: regionWidth, height: regionHeight }).blur(25).toBuffer();

    // 3-4. Composite the blurred region back onto a FRESH decode of the full
    // original image, then save as a brand-new file — the original is never touched.
    const composited = await sharp(original)
      .composite([{ input: blurredRegion, left, top }])
      .toBuffer();

    const mimetype = metadata.format === 'png' ? 'image/png' : metadata.format === 'webp' ? 'image/webp' : 'image/jpeg';
    const newUrl = await saveFile(composited, mimetype);
    res.json({ success: true, data: { url: newUrl } });
  } catch (err: any) {
    console.error('[UPLOADS] blur-region failed:', err.message);
    res.status(500).json({ error: 'Failed to process image' });
  }
});

export default router;
