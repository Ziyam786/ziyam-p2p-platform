import axios from 'axios';
import FormData from 'form-data';
import { config } from '../config';

/**
 * Setu (bridge.setu.co) — DigiLocker KYC (OAuth-style consent redirect) and
 * Aadhaar eSign, both served off the same "data" gateway base URL.
 * Docs: https://docs.setu.co/data/digilocker/quickstart, /data/esign/quickstart
 */

function assertConfigured() {
  if (!config.setu.clientId || !config.setu.clientSecret) {
    throw new Error('Setu client id/secret are not configured (SETU_CLIENT_ID / SETU_CLIENT_SECRET)');
  }
}

function client(productInstanceId: string) {
  return axios.create({
    baseURL: config.setu.baseUrl,
    headers: {
      'x-client-id': config.setu.clientId,
      'x-client-secret': config.setu.clientSecret,
      'x-product-instance-id': productInstanceId,
    },
  });
}

/* ── DigiLocker KYC ───────────────────────────────────────────────────── */

export interface DigilockerRequest {
  id: string;
  url: string;
  validUpto: string;
}

export interface DigilockerStatus {
  status: 'unauthenticated' | 'authenticated';
  digilockerId?: string;
  name?: string;
}

export const digilockerApi = {
  async createRequest(redirectUrl: string): Promise<DigilockerRequest> {
    assertConfigured();
    if (!config.setu.digilockerProductInstanceId) throw new Error('SETU_DIGILOCKER_PRODUCT_INSTANCE_ID is not configured');
    const res = await client(config.setu.digilockerProductInstanceId).post('/api/digilocker/', { redirectUrl });
    return { id: res.data.id, url: res.data.url, validUpto: res.data.validUpto };
  },

  async getStatus(requestId: string): Promise<DigilockerStatus> {
    const res = await client(config.setu.digilockerProductInstanceId).get(`/api/digilocker/${requestId}/status`);
    return { status: res.data.status, digilockerId: res.data.digilockerId, name: res.data.name };
  },

  async fetchAadhaar(requestId: string): Promise<{ name: string; dob?: string; gender?: string; address?: string }> {
    const res = await client(config.setu.digilockerProductInstanceId).get(`/api/digilocker/${requestId}/aadhaar`);
    return { name: res.data.name, dob: res.data.dob, gender: res.data.gender, address: res.data.address };
  },
};

/* ── Aadhaar eSign ────────────────────────────────────────────────────── */

export interface EsignSigner {
  identifier: string; // email or phone the signer will authenticate with
  displayName: string;
}

export const esignApi = {
  async uploadDocument(pdfBuffer: Buffer, name: string): Promise<{ documentId: string }> {
    assertConfigured();
    if (!config.setu.esignProductInstanceId) throw new Error('SETU_ESIGN_PRODUCT_INSTANCE_ID is not configured');
    const form = new FormData();
    form.append('name', name);
    form.append('files', pdfBuffer, { filename: `${name}.pdf`, contentType: 'application/pdf' });
    const res = await client(config.setu.esignProductInstanceId).post('/api/documents', form, { headers: form.getHeaders() });
    return { documentId: res.data.id };
  },

  async createSignatureRequest(documentId: string, signers: EsignSigner[], redirectUrl: string): Promise<{ id: string }> {
    const res = await client(config.setu.esignProductInstanceId).post('/api/signature', {
      documentId,
      signers: signers.map((s) => ({ identifier: s.identifier, displayName: s.displayName })),
      signature: { pages: [1] },
      redirectUrl,
    });
    return { id: res.data.id };
  },

  async getStatus(signatureRequestId: string): Promise<{ status: string }> {
    const res = await client(config.setu.esignProductInstanceId).get(`/api/signature/${signatureRequestId}`);
    return { status: res.data.status };
  },

  async getDownloadUrl(signatureRequestId: string): Promise<{ downloadUrl: string; validUpto: string }> {
    const res = await client(config.setu.esignProductInstanceId).get(`/api/signature/${signatureRequestId}/download/`);
    return { downloadUrl: res.data.downloadUrl, validUpto: res.data.validUpto };
  },
};

export function isSetuConfigured(): boolean {
  return Boolean(config.setu.clientId && config.setu.clientSecret);
}
