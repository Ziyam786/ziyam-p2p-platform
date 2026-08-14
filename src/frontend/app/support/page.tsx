'use client';

import React from 'react';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-gray-50 font-sans flex flex-col">
      <Navbar />
      
      <main className="flex-1 max-w-5xl mx-auto px-4 pt-32 pb-20 w-full">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-extrabold text-gray-900 mb-4">How can we help?</h1>
          <p className="text-gray-500 text-lg">Search our help center or contact our support team directly.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 text-center">
            <div className="text-4xl mb-4">📞</div>
            <h3 className="font-bold text-gray-900 mb-2">24/7 Roadside Assistance</h3>
            <p className="text-sm text-gray-500 mb-4">Need immediate help on the road? We've got you covered.</p>
            <a href="tel:18001234567" className="text-amber-600 font-bold text-lg">1800-123-4567</a>
          </div>

          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 text-center">
            <div className="text-4xl mb-4">💬</div>
            <h3 className="font-bold text-gray-900 mb-2">Live Chat</h3>
            <p className="text-sm text-gray-500 mb-4">Chat with our support agents for booking inquiries.</p>
            <button className="bg-amber-500 hover:bg-amber-600 text-white px-6 py-2 rounded-xl font-bold transition">Start Chat</button>
          </div>

          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 text-center">
            <div className="text-4xl mb-4">✉️</div>
            <h3 className="font-bold text-gray-900 mb-2">Email Support</h3>
            <p className="text-sm text-gray-500 mb-4">Send us your queries and we'll reply within 24 hours.</p>
            <a href="mailto:support@ziyam.in" className="text-amber-600 font-bold">support@ziyam.in</a>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm">
          <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">Send us a message</h2>
          <form className="space-y-6 max-w-2xl mx-auto" onSubmit={(e) => { e.preventDefault(); alert('Message sent!'); }}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-2">Name</label>
                <input type="text" required className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-amber-500 bg-gray-50" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-2">Email</label>
                <input type="email" required className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-amber-500 bg-gray-50" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-2">Subject</label>
              <select className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-amber-500 bg-gray-50">
                <option>Booking Issue</option>
                <option>Payment & Refund</option>
                <option>Host Onboarding</option>
                <option>Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-2">Message</label>
              <textarea rows={5} required className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-amber-500 bg-gray-50"></textarea>
            </div>
            <div className="text-center">
              <button type="submit" className="bg-amber-500 hover:bg-amber-600 text-white font-bold py-3.5 px-8 rounded-xl transition">
                Submit Request
              </button>
            </div>
          </form>
        </div>
      </main>

      <Footer />
    </div>
  );
}