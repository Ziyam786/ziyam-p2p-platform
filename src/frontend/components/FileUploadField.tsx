'use client';

import React, { useRef, useState } from 'react';
import Image from 'next/image';
import { uploadsApi, ApiError } from '../lib/api';

interface FileUploadFieldProps {
  label: string;
  value: string;
  onChange: (url: string) => void;
  accept?: string;
  kind?: 'image' | 'document';
}

/** Uploads the actual file (car photo, RC/insurance/PUC doc, selfie, signature)
 * instead of asking the host/guest to paste a URL. Renders a thumbnail/status
 * once uploaded and stores just the resulting URL, same as before. */
export default function FileUploadField({ label, value, onChange, accept = 'image/jpeg,image/png,image/webp,application/pdf', kind = 'image' }: FileUploadFieldProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      const { url } = await uploadsApi.upload(file);
      onChange(url);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  const isPdf = value.toLowerCase().endsWith('.pdf');

  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">{label}</label>
      <div className="flex items-center gap-3">
        {value ? (
          kind === 'image' && !isPdf ? (
            <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200 shrink-0">
              <Image src={value} alt={label} fill sizes="64px" className="object-cover" />
            </div>
          ) : (
            <a href={value} target="_blank" rel="noreferrer" className="w-16 h-16 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center text-2xl">
              📄
            </a>
          )
        ) : (
          <div className="w-16 h-16 rounded-lg border border-dashed border-gray-300 flex items-center justify-center text-gray-300 text-2xl">
            {kind === 'image' ? '🖼️' : '📄'}
          </div>
        )}

        <div className="flex-1">
          <input ref={inputRef} type="file" accept={accept} onChange={handleFile} className="hidden" id={`upload-${label}`} disabled={uploading} />
          <label
            htmlFor={`upload-${label}`}
            className={`inline-block text-xs font-semibold px-3 py-2 rounded-lg border cursor-pointer transition ${
              uploading ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-wait' : 'border-amber-500 text-amber-600 hover:bg-amber-50'
            }`}
          >
            {uploading ? 'Uploading…' : value ? 'Replace file' : 'Upload file'}
          </label>
          {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
        </div>
      </div>
    </div>
  );
}
