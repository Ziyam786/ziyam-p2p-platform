import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import { randomUUID } from 'crypto';
import { config } from '../config';
import { requireAuth } from '../middleware/auth';
import { isStorageConfigured, getStorageBucket } from '../services/firebaseAdmin';
import { isAadhaarMaskConfigured, maskAadhaarDocument, maskedAadhaarBuffer } from '../services/aryaVerificationService';
import { readSavedUploadBytes } from '../utils/savedUpload';

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
export async function saveFile(buffer: Buffer, mimetype: string): Promise<string> {
  const filename = `${randomUUID()}${MIME_EXTENSION[mimetype] ?? ''}`;
  if (isStorageConfigured()) {
    const file = getStorageBucket().file(filename);
    await file.save(buffer, { contentType: mimetype, public: true });
    return file.publicUrl();
  }
  await fs.promises.writeFile(path.join(config.uploadDir, filename), buffer);
  return `/uploads/${filename}`;
}

async function fetchSavedFileBuffer(url: string): Promise<Buffer> {
  return readSavedUploadBytes(url);
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

/** Agent walk-in + ops: mask Aadhaar digits via Arya, then persist only the masked image. */
router.post('/uploads/aadhaar-mask', requireAuth, (req: Request, res: Response) => {
  upload.single('file')(req, res, async (err: any) => {
    if (err) return res.status(400).json({ error: err.message ?? 'Upload failed' });
    if (!req.file) return res.status(400).json({ error: 'No file provided' });
    if (req.file.mimetype === 'application/pdf') {
      return res.status(400).json({ error: 'Upload a photo of the Aadhaar, not a PDF' });
    }
    if (!isAadhaarMaskConfigured()) {
      return res.status(503).json({ error: 'Aadhaar masking is not configured yet (ARYA_AADHAAR_MASK_TOKEN)' });
    }

    const valid = await verifyFileContent(req.file.buffer, req.file.mimetype);
    if (!valid) {
      return res.status(400).json({ error: 'File content does not match its declared type.' });
    }

    try {
      const masked = await maskAadhaarDocument(req.file.buffer.toString('base64'), 'image');
      const buf = maskedAadhaarBuffer(masked);
      if (!buf) {
        return res.status(422).json({ error: masked.error_message || 'Could not mask that Aadhaar photo — try a clearer, well-lit shot.' });
      }
      const url = await saveFile(buf, 'image/jpeg');
      res.json({ success: true, data: { url } });
    } catch (maskErr: any) {
      console.error('[UPLOADS] aadhaar-mask failed:', maskErr.response?.data ?? maskErr.message);
      res.status(502).json({ error: 'Could not mask the Aadhaar photo right now. Please try again.' });
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
    if (err.status === 400) return res.status(400).json({ error: err.message });
    console.error('[UPLOADS] blur-region failed:', err.message);
    res.status(500).json({ error: 'Failed to process image' });
  }
});

export default router;
