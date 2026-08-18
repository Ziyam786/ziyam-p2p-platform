import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
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
    timeout: 20000,
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
    req_id: uuidv4(),
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
    req_id: uuidv4(),
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
    req_id: uuidv4(),
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
    req_id: uuidv4(),
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
    req_id: uuidv4(),
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
    req_id: uuidv4(),
    doc1_type: 'image',
    doc2_type: 'image',
    img1_base64: img1Base64,
    img2_base64: img2Base64,
  });
  return res.data;
}

/** Fetches an already-uploaded file (local disk or an absolute URL, e.g. Firebase Storage) and returns its base64 content. */
export async function fetchDocAsBase64(urlOrPath: string): Promise<string> {
  if (/^https?:\/\//i.test(urlOrPath)) {
    const res = await axios.get(urlOrPath, { responseType: 'arraybuffer' });
    return Buffer.from(res.data).toString('base64');
  }
  const fs = await import('fs/promises');
  const path = await import('path');
  const filename = path.basename(urlOrPath);
  const filePath = path.join(config.uploadDir, filename);
  const buf = await fs.readFile(filePath);
  return buf.toString('base64');
}
