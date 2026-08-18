import fs from 'fs/promises';
import path from 'path';
import { config } from '../config';
import { isStorageConfigured, getStorageBucket } from '../services/firebaseAdmin';

const OBJECT_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,200}$/;

function invalidFile(): never {
  const err = new Error('Invalid file URL') as Error & { status?: number };
  err.status = 400;
  throw err;
}

/**
 * Bytes of a file this app previously saved. HTTPS locations must be a
 * single object in our Firebase bucket (downloaded via the Admin SDK, not
 * HTTP). Relative /uploads paths are read from local disk. Callers never
 * get a generic server-side fetch of a user-supplied URL.
 */
export async function readSavedUploadBytes(urlOrPath: string): Promise<Buffer> {
  if (/^https?:\/\//i.test(urlOrPath)) {
    if (!isStorageConfigured()) invalidFile();
    const bucketName = config.firebase.storageBucket;
    let parsed: URL;
    try {
      parsed = new URL(urlOrPath);
    } catch {
      invalidFile();
    }
    if (parsed.protocol !== 'https:' || parsed.hostname !== 'storage.googleapis.com' || parsed.port) {
      invalidFile();
    }
    const segments = parsed.pathname.split('/').filter(Boolean);
    const objectName = segments.length === 2 && segments[0] === bucketName ? segments[1] : '';
    if (!OBJECT_NAME.test(objectName)) invalidFile();
    const [buf] = await getStorageBucket().file(objectName).download();
    return buf;
  }

  const resolvedUploadDir = path.resolve(config.uploadDir);
  const objectName = path.basename(urlOrPath);
  if (!OBJECT_NAME.test(objectName)) invalidFile();
  const absolutePath = path.resolve(resolvedUploadDir, objectName);
  if (absolutePath !== resolvedUploadDir && !absolutePath.startsWith(resolvedUploadDir + path.sep)) {
    invalidFile();
  }
  return fs.readFile(absolutePath);
}
