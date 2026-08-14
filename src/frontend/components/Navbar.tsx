'use client';

import React, { useEffect, useState } from 'react';
import { getStoredUser, logout, AuthUser } from '../lib/auth';

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    setUser(getStoredUser());
  }, []);

  const handleLogout = async () => {
    await logout();
    setUser(null);
    window.location.href = '/';
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
        {/* Logo */}
        <a href="/" className="flex items-center gap-2">
          <span className="text-2xl font-extrabold text-amber-500 tracking-tight">ZIYAM</span>
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest">SelfDrive</span>
        </a>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-700">
          <a href="/cars" className="hover:text-amber-500 transition">Browse Cars</a>
          <a href="/how-it-works" className="hover:text-amber-500 transition">How It Works</a>
          <a href="/host/dashboard" className="hover:text-amber-500 transition">List Your Car</a>
          <a href="/support" className="hover:text-amber-500 transition">Support</a>
        </div>

        {/* Auth buttons */}
        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <>
              <a href="/user/dashboard" className="text-sm font-medium text-gray-700 hover:text-amber-500 transition">
                Hi, {user.fullName.split(' ')[0]}
              </a>
              <button
                onClick={handleLogout}
                className="border border-gray-200 hover:border-amber-400 text-sm font-semibold px-4 py-2 rounded-lg transition text-gray-700"
              >
                Log Out
              </button>
            </>
          ) : (
            <>
              <a href="/login" className="text-sm font-medium text-gray-700 hover:text-amber-500 transition">Log In</a>
              <a
                href="/signup"
                className="bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
              >
                Sign Up
              </a>
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden text-gray-700 focus:outline-none"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {menuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden bg-white border-t border-gray-100 px-4 py-4 flex flex-col gap-4 text-sm font-medium text-gray-700">
          <a href="/cars" className="hover:text-amber-500 transition">Browse Cars</a>
          <a href="/how-it-works" className="hover:text-amber-500 transition">How It Works</a>
          <a href="/host/dashboard" className="hover:text-amber-500 transition">List Your Car</a>
          <a href="/support" className="hover:text-amber-500 transition">Support</a>
          <hr className="border-gray-100" />
          {user ? (
            <>
              <a href="/user/dashboard" className="hover:text-amber-500 transition">My Bookings</a>
              <button onClick={handleLogout} className="text-left text-red-600 hover:text-red-700 transition">Log Out</button>
            </>
          ) : (
            <>
              <a href="/login" className="hover:text-amber-500 transition">Log In</a>
              <a
                href="/signup"
                className="bg-amber-500 text-white text-center py-2 rounded-lg hover:bg-amber-600 transition"
              >
                Sign Up
              </a>
            </>
          )}
        </div>
      )}
    </nav>
  );
}
