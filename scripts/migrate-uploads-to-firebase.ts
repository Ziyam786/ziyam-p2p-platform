/**
 * One-time migration: uploads every file currently sitting in the local
 * uploads directory (config.uploadDir) to Firebase Storage, then rewrites
 * every DB reference to that file's old /uploads/<filename> URL to the new
 * absolute Firebase Storage URL.
 *
 * Safe by construction: only touches string fields whose value literally
 * starts with "/uploads/" (an unambiguous signal it's ours, not an external
 * URL like a Setu eSign download link) — anything else is left untouched.
 * Does NOT delete local files; keep them as a backup for a week or two
 * before removing config.uploadDir, in case anything needs re-checking.
 *
 * Run manually, once, against the production DB:
 *   npx ts-node scripts/migrate-uploads-to-firebase.ts
 * (or `npx tsx` if ts-node isn't installed) — never run automatically as
 * part of a deploy; this is a deliberate, supervised one-time operation.
 */
import fs from 'fs';
import path from 'path';
import { PrismaClient, Prisma } from '@prisma/client';
import { config } from '../src/backend/config';
import { isStorageConfigured, getStorageBucket } from '../src/backend/services/firebaseAdmin';

const prisma = new PrismaClient();

const MIME_BY_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
};

async function uploadAllLocalFiles(): Promise<Map<string, string>> {
  const bucket = getStorageBucket();
  const filenames = fs.readdirSync(config.uploadDir).filter((f) => fs.statSync(path.join(config.uploadDir, f)).isFile());
  const map = new Map<string, string>();

  for (const filename of filenames) {
    const ext = path.extname(filename).toLowerCase();
    const mimetype = MIME_BY_EXT[ext];
    if (!mimetype) {
      console.warn(`[SKIP] ${filename} — unrecognized extension`);
      continue;
    }
    const buffer = fs.readFileSync(path.join(config.uploadDir, filename));
    const file = bucket.file(filename);
    await file.save(buffer, { contentType: mimetype, public: true });
    map.set(filename, file.publicUrl());
    console.log(`[UPLOADED] ${filename} -> ${file.publicUrl()}`);
  }
  return map;
}

function rewriteIfLocal(value: string | null | undefined, map: Map<string, string>): string | undefined {
  if (!value || !value.startsWith('/uploads/')) return undefined; // undefined = "no change needed"
  const filename = path.basename(value);
  const newUrl = map.get(filename);
  if (!newUrl) {
    console.warn(`[ORPHAN] DB references ${value} but no local file was found/uploaded for it`);
    return undefined;
  }
  return newUrl;
}

async function migrateUserFields(map: Map<string, string>) {
  const users = await prisma.user.findMany({
    select: { id: true, avatarUrl: true, kycDocUrl: true, signatureUrl: true, selfieUrl: true, partnerAgreementWetSignedUrl: true },
  });
  for (const u of users) {
    const data: Prisma.UserUpdateInput = {};
    const avatarUrl = rewriteIfLocal(u.avatarUrl, map);
    const kycDocUrl = rewriteIfLocal(u.kycDocUrl, map);
    const signatureUrl = rewriteIfLocal(u.signatureUrl, map);
    const selfieUrl = rewriteIfLocal(u.selfieUrl, map);
    const partnerAgreementWetSignedUrl = rewriteIfLocal(u.partnerAgreementWetSignedUrl, map);
    if (avatarUrl) data.avatarUrl = avatarUrl;
    if (kycDocUrl) data.kycDocUrl = kycDocUrl;
    if (signatureUrl) data.signatureUrl = signatureUrl;
    if (selfieUrl) data.selfieUrl = selfieUrl;
    if (partnerAgreementWetSignedUrl) data.partnerAgreementWetSignedUrl = partnerAgreementWetSignedUrl;
    if (Object.keys(data).length > 0) {
      await prisma.user.update({ where: { id: u.id }, data });
      console.log(`[DB] User ${u.id} updated`, data);
    }
  }
}

async function migrateCarFields(map: Map<string, string>) {
  const cars = await prisma.car.findMany({
    select: { id: true, rcDocUrl: true, pollutionCertUrl: true, insuranceDocUrl: true, fleetAgreementWetSignedUrl: true, images: true, originalImages: true },
  });
  for (const c of cars) {
    const data: Prisma.CarUpdateInput = {};
    const rcDocUrl = rewriteIfLocal(c.rcDocUrl, map);
    const pollutionCertUrl = rewriteIfLocal(c.pollutionCertUrl, map);
    const insuranceDocUrl = rewriteIfLocal(c.insuranceDocUrl, map);
    const fleetAgreementWetSignedUrl = rewriteIfLocal(c.fleetAgreementWetSignedUrl, map);
    if (rcDocUrl) data.rcDocUrl = rcDocUrl;
    if (pollutionCertUrl) data.pollutionCertUrl = pollutionCertUrl;
    if (insuranceDocUrl) data.insuranceDocUrl = insuranceDocUrl;
    if (fleetAgreementWetSignedUrl) data.fleetAgreementWetSignedUrl = fleetAgreementWetSignedUrl;

    const newImages = c.images.map((img) => rewriteIfLocal(img, map) ?? img);
    const newOriginalImages = c.originalImages.map((img) => rewriteIfLocal(img, map) ?? img);
    if (JSON.stringify(newImages) !== JSON.stringify(c.images)) data.images = newImages;
    if (JSON.stringify(newOriginalImages) !== JSON.stringify(c.originalImages)) data.originalImages = newOriginalImages;

    if (Object.keys(data).length > 0) {
      await prisma.car.update({ where: { id: c.id }, data });
      console.log(`[DB] Car ${c.id} updated`, Object.keys(data));
    }
  }
}

async function migrateConditionPhotos(map: Map<string, string>) {
  const photos = await prisma.bookingConditionPhoto.findMany({ select: { id: true, url: true } });
  for (const p of photos) {
    const newUrl = rewriteIfLocal(p.url, map);
    if (newUrl) {
      await prisma.bookingConditionPhoto.update({ where: { id: p.id }, data: { url: newUrl } });
      console.log(`[DB] BookingConditionPhoto ${p.id} updated`);
    }
  }
}

async function main() {
  if (!isStorageConfigured()) {
    console.error('Firebase Storage is not configured (FIREBASE_SERVICE_ACCOUNT_JSON / FIREBASE_STORAGE_BUCKET) — nothing to migrate to.');
    process.exit(1);
  }
  if (!fs.existsSync(config.uploadDir)) {
    console.error(`Upload directory ${config.uploadDir} does not exist — nothing to migrate.`);
    process.exit(1);
  }

  console.log(`Uploading local files from ${config.uploadDir} to Firebase Storage...`);
  const map = await uploadAllLocalFiles();
  console.log(`Uploaded ${map.size} files. Rewriting DB references...`);

  await migrateUserFields(map);
  await migrateCarFields(map);
  await migrateConditionPhotos(map);

  console.log('Done. Local files were NOT deleted — keep them as a backup for a week or two, then remove config.uploadDir manually once you\'ve spot-checked that migrated URLs load correctly.');
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
