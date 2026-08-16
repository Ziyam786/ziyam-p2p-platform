'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Navbar from '../../../components/Navbar';
import Footer from '../../../components/Footer';
import { useAuth } from '../../../lib/auth-context';
import { supabase } from '../../../lib/supabase';
import { ApiError } from '../../../lib/api';

function CallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { loginWithSupabase } = useAuth();
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function finish() {
      if (!supabase) {
        setError('Google sign-in is not set up on this deployment yet.');
        return;
      }

      // The SDK parses the access token out of the URL fragment Supabase
      // redirected back with and stores it in-memory — may need a tick to
      // settle after the redirect before getSession() reflects it.
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (!active) return;
      if (sessionError || !data.session) {
        setError('Google sign-in did not complete. Please try again.');
        return;
      }

      try {
        const user = await loginWithSupabase(data.session.access_token);
        if (!active) return;
        const redirect = searchParams.get('redirect');
        if (redirect) router.push(redirect);
        else if (user.role === 'SELF_HOST' || user.role === 'FLEET_OPERATOR') router.push('/host/dashboard');
        else if (user.role === 'ADMIN') router.push('/admin/dashboard');
        else router.push('/account');
      } catch (err) {
        if (!active) return;
        if (err instanceof ApiError && err.code === 'NO_ACCOUNT') {
          setError('No Ziyam account is linked to that Google email yet. Please sign up first, then Google sign-in will work for future logins.');
        } else {
          setError(err instanceof ApiError ? err.message : 'Google sign-in failed. Please try again.');
        }
      }
    }

    finish();
    return () => {
      active = false;
    };
  }, [loginWithSupabase, router, searchParams]);

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Navbar />
      <div className="max-w-md mx-auto px-4 pt-32 pb-24 text-center">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
          {error ? (
            <>
              <p className="text-red-600 text-sm mb-4">{error}</p>
              <a href="/login" className="text-amber-500 font-semibold text-sm hover:underline">Back to login</a>
            </>
          ) : (
            <p className="text-gray-500 text-sm">Finishing Google sign-in…</p>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
}

export default function LoginCallbackPage() {
  return (
    <Suspense fallback={null}>
      <CallbackInner />
    </Suspense>
  );
}
