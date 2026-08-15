'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth-context';
import MotionButton from './MotionButton';
import { LogoBadge } from './Logo';
import NotificationBell from './NotificationBell';

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { user, loading, logout } = useAuth();

  async function handleLogout() {
    await logout();
    setAccountOpen(false);
    window.location.href = '/';
  }

  useEffect(() => {
    // React bails out of re-rendering when the new boolean equals the old one,
    // so this is cheap even though the listener fires on every scroll tick.
    function handleScroll() {
      setScrolled(window.scrollY > 8);
    }
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md transition-shadow duration-300 ${
        scrolled ? 'shadow-lg' : 'shadow-sm'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
        {/* Logo */}
        <a href="/" className="flex items-center gap-2.5">
          <LogoBadge className="w-9 h-9 shrink-0 rounded-xl" />
          <span className="flex items-baseline gap-1">
            <span className="text-xl font-extrabold text-amber-500 tracking-tight">Ziyam</span>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest">SelfDrive</span>
          </span>
        </a>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-700">
          <a href="/cars" className="hover:text-amber-500 transition">Browse Cars</a>
          <a href="/how-it-works" className="hover:text-amber-500 transition">How It Works</a>
          <a href="/host/onboarding" className="hover:text-amber-500 transition">List Your Car</a>
          <a href="/support" className="hover:text-amber-500 transition">Support</a>
        </div>

        {/* Auth buttons */}
        <div className="hidden md:flex items-center gap-3">
          {loading ? null : user ? (
            <>
            <NotificationBell />
            <div className="relative">
              <button
                onClick={() => setAccountOpen(!accountOpen)}
                className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-amber-500 transition"
              >
                <span className="w-8 h-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center font-bold text-xs">
                  {user.fullName.slice(0, 1).toUpperCase()}
                </span>
                {user.fullName.split(' ')[0]}
              </button>
              {accountOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-2 text-sm">
                  <a href="/account" className="block px-4 py-2 hover:bg-gray-50 text-gray-700">My Account</a>
                  <a href="/account/trips" className="block px-4 py-2 hover:bg-gray-50 text-gray-700">My Trips</a>
                  <a href="/account/wishlist" className="block px-4 py-2 hover:bg-gray-50 text-gray-700">My Wishlist</a>
                  {(user.role === 'SELF_HOST' || user.role === 'FLEET_OPERATOR') && (
                    <a href="/host/dashboard" className="block px-4 py-2 hover:bg-gray-50 text-gray-700">Host Dashboard</a>
                  )}
                  {user.role === 'ADMIN' && (
                    <a href="/admin/dashboard" className="block px-4 py-2 hover:bg-gray-50 text-gray-700">Admin</a>
                  )}
                  <button onClick={handleLogout} className="w-full text-left px-4 py-2 hover:bg-gray-50 text-red-500">
                    Log Out
                  </button>
                </div>
              )}
            </div>
            </>
          ) : (
            <>
              <a href="/login" className="text-sm font-medium text-gray-700 hover:text-amber-500 transition">Log In</a>
              <MotionButton
                href="/signup"
                className="btn-gradient text-white text-sm font-semibold px-4 py-2 rounded-lg"
              >
                Sign Up
              </MotionButton>
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
          <a href="/host/onboarding" className="hover:text-amber-500 transition">List Your Car</a>
          <a href="/support" className="hover:text-amber-500 transition">Support</a>
          <hr className="border-gray-100" />
          {user ? (
            <>
              <a href="/account" className="hover:text-amber-500 transition">My Account</a>
              <a href="/account/trips" className="hover:text-amber-500 transition">My Trips</a>
              <a href="/account/wishlist" className="hover:text-amber-500 transition">My Wishlist</a>
              {(user.role === 'SELF_HOST' || user.role === 'FLEET_OPERATOR') && (
                <a href="/host/dashboard" className="hover:text-amber-500 transition">Host Dashboard</a>
              )}
              <button onClick={handleLogout} className="text-left text-red-500">Log Out</button>
            </>
          ) : (
            <>
              <a href="/login" className="hover:text-amber-500 transition">Log In</a>
              <a
                href="/signup"
                className="btn-gradient text-white text-center py-2 rounded-lg"
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
