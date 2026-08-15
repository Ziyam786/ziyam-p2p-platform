'use client';

import React, { useState } from 'react';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import ProtectedRoute from '../../components/ProtectedRoute';
import { useAuth } from '../../lib/auth-context';
import { useToast } from '../../components/Toast';
import { usersApi } from '../../lib/api';

function AccountInner() {
  const { user, refresh } = useAuth();
  const { show } = useToast();
  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [saving, setSaving] = useState(false);

  if (!user) return null;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await usersApi.update({ fullName, bio });
      await refresh();
      show('Profile updated', 'success');
    } catch (err: any) {
      show(err.message ?? 'Failed to update profile', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 pt-28 pb-20">
        <h1 className="text-2xl font-extrabold text-gray-900 mb-1">My Account</h1>
        <p className="text-gray-500 text-sm mb-8">Manage your profile and account settings</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <a href="/account/trips" className="bg-white rounded-2xl p-5 border border-gray-100 hover:border-amber-300 transition">
            <span className="text-2xl">🧳</span>
            <p className="font-semibold text-gray-900 mt-2">My Trips</p>
            <p className="text-xs text-gray-500 mt-1">View bookings and history</p>
          </a>
          <a href="/account/kyc" className="bg-white rounded-2xl p-5 border border-gray-100 hover:border-amber-300 transition">
            <span className="text-2xl">📋</span>
            <p className="font-semibold text-gray-900 mt-2">KYC Verification</p>
            <p className="text-xs text-gray-500 mt-1">
              {user.isKycVerified ? 'Verified ✓' : 'Not verified — required to book'}
            </p>
          </a>
          {(user.role === 'SELF_HOST' || user.role === 'FLEET_OPERATOR') && (
            <a href="/host/dashboard" className="bg-white rounded-2xl p-5 border border-gray-100 hover:border-amber-300 transition">
              <span className="text-2xl">🚘</span>
              <p className="font-semibold text-gray-900 mt-2">Host Dashboard</p>
              <p className="text-xs text-gray-500 mt-1">Manage your listings & earnings</p>
            </a>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h2 className="font-bold text-gray-900 mb-4">Profile Details</h2>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Full Name</label>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Email</label>
                <input disabled value={user.email} className="w-full border border-gray-100 bg-gray-50 rounded-xl px-4 py-2.5 text-sm text-gray-500" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Phone Number</label>
              <input disabled value={user.phoneNumber} className="w-full border border-gray-100 bg-gray-50 rounded-xl px-4 py-2.5 text-sm text-gray-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Bio</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                placeholder="Tell other renters/hosts a bit about yourself"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="btn-gradient disabled:!bg-none disabled:bg-gray-300 disabled:!shadow-none text-white font-bold px-6 py-2.5 rounded-xl transition text-sm"
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </form>
        </div>
      </div>
      <Footer />
    </div>
  );
}

export default function AccountPage() {
  return (
    <ProtectedRoute>
      <AccountInner />
    </ProtectedRoute>
  );
}
