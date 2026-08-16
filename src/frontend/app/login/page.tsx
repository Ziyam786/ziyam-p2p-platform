'use client';

import React, { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import { useAuth } from '../../lib/auth-context';
import { ApiError } from '../../lib/api';
import { isSupabaseConfigured, getSupabaseClient } from '../../lib/supabase';

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, requestLoginOtp, loginWithOtp } = useAuth();

  const [mode, setMode] = useState<'PASSWORD' | 'OTP'>('PASSWORD');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpInfo, setOtpInfo] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function afterLogin(user: { role: string }) {
    const redirect = searchParams.get('redirect');
    if (redirect) router.push(redirect);
    else if (user.role === 'SELF_HOST' || user.role === 'FLEET_OPERATOR') router.push('/host/dashboard');
    else if (user.role === 'ADMIN') router.push('/admin/dashboard');
    else router.push('/account');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(email, password);
      afterLogin(user);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setOtpInfo('');
    setLoading(true);
    try {
      const { devCode } = await requestLoginOtp(phoneNumber);
      setOtpSent(true);
      // devCode only ever comes back outside production — no SMS provider is
      // wired up yet, so this is how the code reaches you during testing.
      setOtpInfo(devCode ? `Dev mode — no SMS sent yet. Your code is ${devCode}.` : 'If that phone number has an account, a code has been sent.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send code. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await loginWithOtp(phoneNumber, otpCode);
      afterLogin(user);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Invalid or expired code.');
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    const supabase = await getSupabaseClient();
    if (!supabase) return;
    setError('');
    const callbackUrl = new URL('/login/callback', window.location.origin);
    const redirect = searchParams.get('redirect');
    if (redirect) callbackUrl.searchParams.set('redirect', redirect);
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: callbackUrl.toString() },
    });
    if (oauthError) setError(oauthError.message);
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Navbar />
      <div className="max-w-md mx-auto px-4 pt-32 pb-24">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
          <h1 className="text-2xl font-extrabold text-gray-900 mb-1">Welcome back</h1>
          <p className="text-gray-500 text-sm mb-6">Log in to book cars or manage your listings</p>

          <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6">
            <button
              type="button"
              onClick={() => { setMode('PASSWORD'); setError(''); }}
              className={`flex-1 text-sm font-semibold py-2 rounded-lg transition ${mode === 'PASSWORD' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
            >
              Password
            </button>
            <button
              type="button"
              onClick={() => { setMode('OTP'); setError(''); }}
              className={`flex-1 text-sm font-semibold py-2 rounded-lg transition ${mode === 'OTP' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
            >
              OTP Login
            </button>
          </div>

          {error && <div className="bg-red-50 text-red-600 text-sm rounded-xl px-4 py-3 mb-4">{error}</div>}
          {otpInfo && <div className="bg-amber-50 text-amber-700 text-sm rounded-xl px-4 py-3 mb-4">{otpInfo}</div>}

          {mode === 'PASSWORD' ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  placeholder="••••••••"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full btn-gradient disabled:!bg-none disabled:bg-gray-300 disabled:!shadow-none text-white font-bold py-3 rounded-xl transition"
              >
                {loading ? 'Logging in…' : 'Log In'}
              </button>
            </form>
          ) : (
            <form onSubmit={otpSent ? handleVerifyOtp : handleSendOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Phone Number</label>
                <input
                  type="tel"
                  required
                  disabled={otpSent}
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:bg-gray-50 disabled:text-gray-500"
                  placeholder="+91 98765 43210"
                />
              </div>
              {otpSent && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">6-Digit Code</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    autoFocus
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm tracking-[0.3em] focus:outline-none focus:ring-2 focus:ring-amber-400"
                    placeholder="000000"
                  />
                </div>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full btn-gradient disabled:!bg-none disabled:bg-gray-300 disabled:!shadow-none text-white font-bold py-3 rounded-xl transition"
              >
                {loading ? 'Please wait…' : otpSent ? 'Verify & Log In' : 'Send Code'}
              </button>
              {otpSent && (
                <button
                  type="button"
                  onClick={() => { setOtpSent(false); setOtpCode(''); setOtpInfo(''); setError(''); }}
                  className="w-full text-center text-xs text-gray-500 hover:text-gray-700 underline"
                >
                  Use a different number
                </button>
              )}
            </form>
          )}

          {isSupabaseConfigured() && (
            <>
              <div className="flex items-center gap-3 my-6">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-xs text-gray-400 font-medium">OR</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>
              <button
                type="button"
                onClick={handleGoogleLogin}
                className="w-full flex items-center justify-center gap-2.5 border border-gray-200 rounded-xl py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47a5.54 5.54 0 0 1-2.4 3.63v3.02h3.88c2.27-2.09 3.57-5.17 3.57-8.84Z" />
                  <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.95-2.9l-3.88-3.02c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.26v3.11A12 12 0 0 0 12 24Z" />
                  <path fill="#FBBC05" d="M5.27 14.27a7.2 7.2 0 0 1 0-4.54V6.62H1.26a12 12 0 0 0 0 10.76l4.01-3.11Z" />
                  <path fill="#EA4335" d="M12 4.77c1.76 0 3.34.6 4.59 1.79l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.26 6.62l4.01 3.11C6.22 6.88 8.87 4.77 12 4.77Z" />
                </svg>
                Continue with Google
              </button>
            </>
          )}

          <p className="text-center text-sm text-gray-500 mt-6">
            New to Ziyam? <a href="/signup" className="text-amber-500 font-semibold hover:underline">Create an account</a>
          </p>
        </div>
      </div>
      <Footer />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
