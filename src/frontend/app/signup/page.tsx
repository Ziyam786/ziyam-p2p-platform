'use client';

import React, { useState } from 'react';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import { register } from '../../lib/auth';

export default function SignupPage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'CUSTOMER' | 'SELF_HOST'>('CUSTOMER');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register({ fullName, email, phoneNumber, password, role });
      window.location.href = role === 'SELF_HOST' ? '/host/dashboard' : '/user/dashboard';
    } catch (err: any) {
      setError(err.message || 'Signup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <Navbar />
      
      <main className="flex-1 flex items-center justify-center pt-24 pb-16 px-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100 max-w-md w-full">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-extrabold text-gray-900 mb-2">Join ZiyamSelfDrive</h1>
            <p className="text-sm text-gray-500">Create an account to start driving or earning.</p>
          </div>
          
          <form onSubmit={handleSignup} className="space-y-5">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
                {error}
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-2">Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-gray-50 text-sm"
                placeholder="John Doe"
              />
            </div>
            
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-2">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-gray-50 text-sm"
                placeholder="name@example.com"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-2">Phone Number</label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-gray-50 text-sm"
                placeholder="+91 98765 43210"
              />
            </div>
            
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-gray-50 text-sm"
                placeholder="At least 8 characters"
              />
            </div>
            
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-3">I want to...</label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setRole('CUSTOMER')}
                  className={`py-3 rounded-xl border-2 text-sm font-semibold transition ${
                    role === 'CUSTOMER' ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-gray-200 text-gray-600 hover:border-amber-300'
                  }`}
                >
                  Rent a Car
                </button>
                <button
                  type="button"
                  onClick={() => setRole('SELF_HOST')}
                  className={`py-3 rounded-xl border-2 text-sm font-semibold transition ${
                    role === 'SELF_HOST' ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-gray-200 text-gray-600 hover:border-amber-300'
                  }`}
                >
                  Host my Car
                </button>
              </div>
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white font-bold py-3.5 rounded-xl transition text-base mt-4"
            >
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>
          
          <div className="mt-8 pt-6 border-t border-gray-100 text-center">
            <p className="text-sm text-gray-600">
              Already have an account?{' '}
              <a href="/login" className="text-amber-600 font-bold hover:underline">Log in</a>
            </p>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}