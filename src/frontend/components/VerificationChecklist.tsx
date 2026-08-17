'use client';

import React, { useState } from 'react';
import { usersApi } from '../lib/api';
import { useToast } from './Toast';
import { useAuth } from '../lib/auth-context';

export default function VerificationChecklist() {
  const { user, refresh } = useAuth();
  const { show } = useToast();
  const [editing, setEditing] = useState<'signature' | 'selfie' | 'phone' | null>(null);
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);

  if (!user) return null;

  async function save(field: 'signatureUrl' | 'selfieUrl' | 'alternatePhoneNumber') {
    setSaving(true);
    try {
      await usersApi.update({ [field]: value });
      await refresh();
      show('Saved', 'success');
      setEditing(null);
      setValue('');
    } catch (err: any) {
      show(err.message ?? 'Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  }

  const items: { key: 'signature' | 'selfie' | 'phone'; icon: string; label: string; done: boolean; field: 'signatureUrl' | 'selfieUrl' | 'alternatePhoneNumber'; placeholder: string }[] = [
    { key: 'signature', icon: '✍️', label: 'Add Signature', done: Boolean(user.signatureUrl), field: 'signatureUrl', placeholder: 'https://... (signature image)' },
    { key: 'selfie', icon: '🤳', label: 'Add Selfie', done: Boolean(user.selfieUrl), field: 'selfieUrl', placeholder: 'https://... (selfie photo)' },
    { key: 'phone', icon: '📞', label: 'Add Alternative Number', done: Boolean(user.alternatePhoneNumber), field: 'alternatePhoneNumber', placeholder: '+91 90000 00000' },
  ];

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6">
      <h2 className="font-bold text-gray-900 mb-1">Verification Checklist</h2>
      <p className="text-xs text-gray-500 mb-4">Completing these builds trust with lessees/hosts and is required for lease agreements.</p>

      <div className="space-y-2">
        <ChecklistRow icon="🪪" label="Aadhaar Verification" done={user.isKycVerified} href="/account/kyc" />
        <ChecklistRow icon="📧" label="Email Verification" done sub={user.email} />

        {items.map((item) => (
          <div key={item.key}>
            <ChecklistRow
              icon={item.icon}
              label={item.label}
              done={item.done}
              onClick={() => {
                setEditing(item.key);
                setValue('');
              }}
            />
            {editing === item.key && (
              <div className="flex gap-2 mt-2 mb-1 pl-11">
                <input
                  autoFocus
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder={item.placeholder}
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
                <button disabled={saving || !value} onClick={() => save(item.field)} className="text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white px-4 rounded-lg transition disabled:opacity-50">
                  Save
                </button>
                <button onClick={() => setEditing(null)} className="text-xs font-semibold text-gray-400 px-2">Cancel</button>
              </div>
            )}
          </div>
        ))}

        <ChecklistRow icon="🏦" label="Bank Details" done={Boolean(user.bankAccountVerified)} sub={user.bankAccountVerified ? undefined : 'Scroll down to verify'} />
      </div>
    </div>
  );
}

function ChecklistRow({ icon, label, done, sub, href, onClick }: { icon: string; label: string; done: boolean; sub?: string; href?: string; onClick?: () => void }) {
  const content = (
    <div className="flex items-center gap-3 py-2.5 px-1 rounded-lg hover:bg-gray-50 transition cursor-pointer">
      <span className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-sm shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800">{label}</p>
        {sub && <p className="text-xs text-gray-400 truncate">{sub}</p>}
      </div>
      {done ? (
        <span className="w-5 h-5 rounded-full bg-emerald-500 text-white text-xs flex items-center justify-center shrink-0">✓</span>
      ) : (
        <span className="text-xs font-semibold text-amber-500 shrink-0">Add</span>
      )}
    </div>
  );
  if (href) return <a href={href}>{content}</a>;
  return <button type="button" onClick={onClick} className="w-full text-left">{content}</button>;
}
