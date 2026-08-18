import axios from 'axios';
import path from 'path';
import fs from 'fs/promises';
import { randomUUID } from 'crypto';
import { config } from '../config';

/**
 * Arya.ai (Aurionpro) document verification — three separate products under
 * ping.arya.ai, each with its own token. Real, documented contract (not
 * guessed): { token } header, { req_id, doc_base64, ... } body, a top-level
 * `success` boolean + `error_message` on failure. Their per-doc-type
 * `extracted_data`/`entities` response shape isn't itemized in the docs, so
 * callers store it as-is rather than assuming named sub-fields exist.
 */

const BASE_URL = 'https://ping.arya.ai/api';

function client(token: string) {
  return axios.create({
    baseURL: BASE_URL,
    headers: { token, 'content-type': 'application/json' },
    timeout: 30000,
  });
}

export function isKycExtractionConfigured(): boolean {
  return Boolean(config.arya.kycToken);
}

export function isRcVerificationConfigured(): boolean {
  return Boolean(config.arya.rcToken);
}

export function isImageQualityConfigured(): boolean {
  return Boolean(config.arya.imageQualityToken);
}

export interface AryaKycResult {
  req_id: string;
  success: boolean;
  doc_type?: string;
  error_message?: string;
  extracted_data?: Record<string, unknown>;
  image_quality?: string;
  verify_data?: Record<string, unknown>;
}

/** PAN / Aadhaar / Voter ID / Passport / Driving Licence extraction+verification. */
export async function extractKycDocument(docBase64: string, docType: 'image' | 'pdf' = 'image'): Promise<AryaKycResult> {
  if (!isKycExtractionConfigured()) throw new Error('Arya KYC extraction is not configured (ARYA_KYC_TOKEN)');
  const res = await client(config.arya.kycToken).post('/v2/kyc', {
    doc_type: docType,
    doc_base64: docBase64,
    req_id: randomUUID(),
  });
  return res.data;
}

export interface AryaRcResult {
  req_id: string;
  success: boolean;
  doc_type?: string;
  rc_no?: string;
  data?: string;
  entities?: Record<string, unknown>;
  error_message?: string;
  verify_data?: Record<string, unknown>;
}

/** Vehicle Registration Certificate extraction+verification — returns the extracted rc_no for cross-checking against the host-entered registration number. */
export async function extractRcDocument(docBase64: string): Promise<AryaRcResult> {
  if (!isRcVerificationConfigured()) throw new Error('Arya RC verification is not configured (ARYA_RC_TOKEN)');
  const res = await client(config.arya.rcToken).post('/v1/rc', {
    doc_base64: docBase64,
    req_id: randomUUID(),
  });
  return res.data;
}

export interface AryaImageQualityResult {
  req_id: string;
  success: boolean;
  error_message?: string;
  document_QC?: Record<string, unknown>;
}

/** Pre-check before spending a call on extraction — rejects blurry/blank/unreadable photos. */
export async function checkImageQuality(docBase64: string): Promise<AryaImageQualityResult> {
  if (!isImageQualityConfigured()) throw new Error('Arya image quality check is not configured (ARYA_IMAGE_QUALITY_TOKEN)');
  const res = await client(config.arya.imageQualityToken).post('/v1/image-quality-checker', {
    req_id: randomUUID(),
    doc_base64: docBase64,
    brightness: true,
    blur: true,
    word_presence: true,
    noise: true,
    blank_page: true,
  });
  return res.data;
}

export function isLivenessConfigured(): boolean {
  return Boolean(config.arya.livenessToken);
}
export function isDeepfakeConfigured(): boolean {
  return Boolean(config.arya.deepfakeToken);
}
export function isFaceMatchConfigured(): boolean {
  return Boolean(config.arya.faceMatchToken);
}

export function isAadhaarMaskConfigured(): boolean {
  return Boolean(config.arya.aadhaarMaskToken);
}

export function isCyberThreatConfigured(): boolean {
  return Boolean(config.arya.cyberThreatToken);
}

export interface AryaAadhaarMaskResult {
  status: boolean;
  masked_aadhar?: string;
  error_message?: string;
  source?: string;
  number_of_pages?: number;
  doc_type?: string;
}

function stripBase64Payload(value: string): string {
  const comma = value.indexOf(',');
  return comma >= 0 && /^data:/i.test(value) ? value.slice(comma + 1) : value;
}

/** Redacts the Aadhaar number on a document photo. Extraction should run on the original; persist only this masked copy. */
export async function maskAadhaarDocument(docBase64: string, docType: 'image' | 'pdf' = 'image'): Promise<AryaAadhaarMaskResult> {
  if (!isAadhaarMaskConfigured()) throw new Error('Arya Aadhaar mask is not configured (ARYA_AADHAAR_MASK_TOKEN)');
  const res = await client(config.arya.aadhaarMaskToken).post('/v1/aadhaar-mask', {
    doc_type: docType,
    doc_base64: docBase64,
    req_id: randomUUID(),
  });
  return res.data;
}

export function maskedAadhaarBuffer(result: AryaAadhaarMaskResult): Buffer | undefined {
  if (!result.status || typeof result.masked_aadhar !== 'string' || result.masked_aadhar.length === 0) return undefined;
  return Buffer.from(stripBase64Payload(result.masked_aadhar), 'base64');
}

export interface AryaCyberThreatResult {
  req_id?: string;
  success: boolean;
  data?: Record<string, unknown>;
  error_message?: string;
}

/** URL reputation check before fetching a caller-supplied document URL. */
export async function checkCyberThreat(url: string): Promise<AryaCyberThreatResult> {
  if (!isCyberThreatConfigured()) throw new Error('Arya cyber threat detection is not configured (ARYA_CYBER_THREAT_TOKEN)');
  const res = await client(config.arya.cyberThreatToken).post('/v1/cyber-threat-detection', {
    url,
    req_id: randomUUID(),
  });
  return res.data;
}

export function isLikelyAadhaarKyc(result: AryaKycResult): boolean {
  return /aadhaar|aadhar|uidai/.test(JSON.stringify(result).toLowerCase());
}

function cyberThreatLooksUnsafe(result: AryaCyberThreatResult): boolean {
  if (!result.success) return true;
  const blob = JSON.stringify(result.data ?? {}).toLowerCase();
  if (/"safe"\s*:\s*false/.test(blob)) return true;
  if (/"malicious"\s*:\s*true/.test(blob)) return true;
  if (/"is_threat"\s*:\s*true/.test(blob)) return true;
  if (/"phishing"\s*:\s*true/.test(blob)) return true;
  if (/"unsafe"\s*:\s*true/.test(blob)) return true;
  return false;
}

/**
 * Optional URL scan: if ARYA_CYBER_THREAT_TOKEN is set, reject unsafe
 * document URLs before we fetch them. No-ops when unconfigured.
 */
export async function assertSafeDocumentUrl(url: string): Promise<void> {
  if (!isCyberThreatConfigured()) return;
  const threat = await checkCyberThreat(url);
  if (cyberThreatLooksUnsafe(threat)) {
    const err = new Error(threat.error_message || 'That document URL failed our security check. Upload the file instead.') as Error & { status?: number };
    err.status = 422;
    throw err;
  }
}

export interface AryaLivenessResult {
  req_id: string;
  success: boolean;
  doc_type?: string;
  error_message?: string;
  doc_json?: Record<string, unknown>;
}

/** Confirms a selfie is a live photo of a real person, not a photo-of-a-photo/screen replay. */
export async function checkLiveness(docBase64: string): Promise<AryaLivenessResult> {
  if (!isLivenessConfigured()) throw new Error('Arya liveness check is not configured (ARYA_LIVENESS_TOKEN)');
  const res = await client(config.arya.livenessToken).post('/v1/liveness', {
    req_id: randomUUID(),
    doc_base64: docBase64,
  });
  return res.data;
}

export interface AryaDeepfakeResult {
  req_id: string;
  success: boolean;
  doc_type?: string;
  error_message?: string;
  result?: string;
}

/** Flags AI-generated/manipulated selfie images. */
export async function checkDeepfake(docBase64: string, docType: 'image' | 'video' = 'image'): Promise<AryaDeepfakeResult> {
  if (!isDeepfakeConfigured()) throw new Error('Arya deepfake detection is not configured (ARYA_DEEPFAKE_TOKEN)');
  const res = await client(config.arya.deepfakeToken).post('/v1/deepfake-detection/image', {
    req_id: randomUUID(),
    doc_base64: docBase64,
    doc_type: docType,
    isIOS: false,
    orientation: 0,
  });
  return res.data;
}

export interface AryaFaceMatchResult {
  req_id: string;
  success: boolean;
  error_message?: string;
  score?: number;
  match?: boolean;
}

/** Compares two face photos (e.g. a selfie against a driving-license photo) to confirm the same person. */
export async function verifyFaceMatch(img1Base64: string, img2Base64: string): Promise<AryaFaceMatchResult> {
  if (!isFaceMatchConfigured()) throw new Error('Arya face match is not configured (ARYA_FACE_MATCH_TOKEN)');
  const res = await client(config.arya.faceMatchToken).post('/v1/verifyFace', {
    req_id: randomUUID(),
    doc1_type: 'image',
    doc2_type: 'image',
    img1_base64: img1Base64,
    img2_base64: img2Base64,
  });
  return res.data;
}

/** Pulls a human name out of Arya's loosely-typed extraction payload. */
export function pickExtractedName(result: AryaKycResult): string | undefined {
  const pools: unknown[] = [result.extracted_data, result.verify_data, result];
  for (const pool of pools) {
    if (!pool || typeof pool !== 'object') continue;
    const rec = pool as Record<string, unknown>;
    for (const key of Object.keys(rec)) {
      if (!/name/i.test(key) || /file|doc|type|error|req/i.test(key)) continue;
      const value = rec[key];
      if (typeof value === 'string' && value.trim().length > 1) return value.trim();
    }
  }
  return undefined;
}

/**
 * Optional pre-check: if ARYA_IMAGE_QUALITY_TOKEN is set, reject blurry/blank
 * photos before spending a KYC/RC extraction call. No-ops when unconfigured.
 */
export async function assertReadableDocument(docBase64: string): Promise<void> {
  if (!isImageQualityConfigured()) return;
  const qc = await checkImageQuality(docBase64);
  if (!qc.success) {
    const err = new Error(qc.error_message || 'That photo is too blurry or unreadable. Please retake it in good light.') as Error & { status?: number };
    err.status = 422;
    throw err;
  }
}

/** Fetches an already-uploaded file (local disk or our Firebase Storage bucket) and returns its base64 content. */
export async function fetchDocAsBase64(urlOrPath: string): Promise<string> {
  if (/^https?:\/\//i.test(urlOrPath)) {
    const bucketName = config.firebase.storageBucket || null;
    let parsed: URL;
    try {
      parsed = new URL(urlOrPath);
    } catch {
      const err = new Error('Invalid file URL') as Error & { status?: number };
      err.status = 400;
      throw err;
    }
    if (!bucketName || parsed.protocol !== 'https:' || parsed.hostname !== 'storage.googleapis.com' || !parsed.pathname.startsWith(`/${bucketName}/`)) {
      const err = new Error('Invalid file URL') as Error & { status?: number };
      err.status = 400;
      throw err;
    }
    const safeUrl = `${parsed.protocol}//${parsed.host}${parsed.pathname}${parsed.search}`;
    const res = await axios.get(safeUrl, { responseType: 'arraybuffer', maxRedirects: 0, timeout: 15_000 });
    return Buffer.from(res.data).toString('base64');
  }
  const resolvedUploadDir = path.resolve(config.uploadDir);
  const absolutePath = path.resolve(resolvedUploadDir, path.basename(urlOrPath));
  if (absolutePath !== resolvedUploadDir && !absolutePath.startsWith(resolvedUploadDir + path.sep)) {
    const err = new Error('Invalid file path') as Error & { status?: number };
    err.status = 400;
    throw err;
  }
  const buf = await fs.readFile(absolutePath);
  return buf.toString('base64');
}
