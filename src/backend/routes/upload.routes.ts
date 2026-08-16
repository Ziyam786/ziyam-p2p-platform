import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import { requireAuth } from '../middleware/auth';

const router = Router();

fs.mkdirSync(config.uploadDir, { recursive: true });

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, config.uploadDir),
  filename: (_req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname).toLowerCase()}`),
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      cb(new Error('Only JPEG, PNG, WebP images or PDF files are allowed'));
      return;
    }
    cb(null, true);
  },
});

// Used for car photos, RC/insurance/PUC documents, KYC selfies, and
// signatures — hosts and guests upload the actual file rather than pasting a
// URL. Returns a relative /uploads/<file> path, served statically by server.ts.
router.post('/uploads', requireAuth, (req: Request, res: Response) => {
  upload.single('file')(req, res, (err: any) => {
    if (err) return res.status(400).json({ error: err.message ?? 'Upload failed' });
    if (!req.file) return res.status(400).json({ error: 'No file provided' });
    res.json({ success: true, data: { url: `/uploads/${req.file.filename}` } });
  });
});

export default router;
