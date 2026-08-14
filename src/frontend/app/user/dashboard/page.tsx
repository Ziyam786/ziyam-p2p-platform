'use client';

import React, { useEffect, useState } from 'react';
import Navbar from '../../../components/Navbar';
import Footer from '../../../components/Footer';
import { getStoredUser, logout, AuthUser } from '../../../lib/auth';

const MOCK_BOOKINGS = [
  {
    id: 'BKG-4829',
    carName: 'Hyundai Creta',
    date: '10 Aug 2026',
    status: 'Completed',
    amount: '₹4,998',
    image: 'https://imgd.aeplcdn.com/664x374/n/cw/ec/106815/creta-exterior-right-front-three-quarter-4.jpeg',
  },
  {
    id: 'BKG-5102',
    carName: 'Tata Nexon EV',
    date: '22 Aug 2026',
    status: 'Upcoming',
    amount: '₹2,799',
    image: 'https://imgd.aeplcdn.com/664x374/n/cw/ec/156811/nexon-ev-exterior-right-front-three-quarter-2.jpeg',
  },
];

export default function UserDashboard() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    setUser(getStoredUser());
    setChecked(true);
  }, []);

  const handleLogout = async () => {
    await logout();
    window.location.href = '/login';
  };

  if (checked && !user) {
    return (
      <div className="min-h-screen bg-gray-50 font-sans flex flex-col">
        <Navbar />
        <main className="flex-1 flex flex-col items-center justify-center pt-24 pb-20 px-4 text-center">
          <h1 className="text-2xl font-extrabold text-gray-900 mb-3">Please Log In</h1>
          <p className="text-gray-500 mb-6 max-w-md">Sign in to view your bookings, profile, and payment history.</p>
          <a href="/login" className="bg-amber-500 hover:bg-amber-600 text-white font-bold px-6 py-3 rounded-xl transition">
            Log In
          </a>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans flex flex-col">
      <Navbar />
      
      <main className="flex-1 max-w-6xl mx-auto px-4 pt-24 pb-20 w-full">
        <h1 className="text-3xl font-extrabold text-gray-900 mb-8">My Account</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-1 space-y-2">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4 text-center">
              <div className="w-16 h-16 bg-amber-100 text-3xl flex items-center justify-center rounded-full mx-auto mb-3">👤</div>
              <h3 className="font-bold text-gray-900">{user?.fullName ?? 'Guest'}</h3>
              <p className="text-xs text-gray-500 mb-2">{user?.email ?? ''}</p>
              <span className={`text-xs px-2 py-1 rounded-full font-bold ${user?.isKycVerified ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                {user?.isKycVerified ? 'KYC Verified' : 'KYC Pending'}
              </span>
            </div>
            
            <a href="#" className="block px-4 py-3 rounded-lg font-semibold bg-amber-50 text-amber-700 border-l-4 border-amber-500">My Bookings</a>
            <a href="#" className="block px-4 py-3 rounded-lg font-semibold text-gray-600 hover:bg-gray-100">Profile Settings</a>
            <a href="#" className="block px-4 py-3 rounded-lg font-semibold text-gray-600 hover:bg-gray-100">Payment Methods</a>
            <button onClick={handleLogout} className="w-full text-left px-4 py-3 rounded-lg font-semibold text-red-600 hover:bg-red-50">Logout</button>
          </div>

          <div className="md:col-span-3 space-y-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">My Bookings</h2>
            
            {MOCK_BOOKINGS.map(b => (
              <div key={b.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col md:flex-row gap-6">
                <img src={b.image} alt={b.carName} className="w-full md:w-48 h-32 object-cover rounded-xl bg-gray-100" />
                <div className="flex-1">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-bold text-lg text-gray-900">{b.carName}</h3>
                      <p className="text-sm text-gray-500">Booking ID: {b.id}</p>
                    </div>
                    <span className={`text-xs font-bold px-3 py-1 rounded-full ${b.status === 'Completed' ? 'bg-gray-100 text-gray-600' : 'bg-amber-100 text-amber-700'}`}>
                      {b.status}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 my-4 text-sm">
                    <div>
                      <p className="text-gray-500 text-xs uppercase tracking-wider">Date</p>
                      <p className="font-semibold text-gray-800">{b.date}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs uppercase tracking-wider">Amount</p>
                      <p className="font-semibold text-gray-800">{b.amount}</p>
                    </div>
                  </div>

                  <div className="flex gap-3 mt-4">
                    {b.status === 'Upcoming' && (
                      <button className="bg-amber-500 hover:bg-amber-600 text-white font-bold px-4 py-2 rounded-lg text-sm transition">Manage Trip</button>
                    )}
                    <button className="border border-gray-200 hover:bg-gray-50 font-bold px-4 py-2 rounded-lg text-sm transition text-gray-700">View Invoice</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}