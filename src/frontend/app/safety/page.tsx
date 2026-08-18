import React from 'react';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import PageHero from '../../components/PageHero';

const PILLARS = [
  { icon: '🪪', title: 'Verified Identities', desc: 'Every lessee and host completes identity KYC (Aadhaar OTP or Arya.ai photo ID) plus driving-licence verification before their first trip.' },
  { icon: '🛡️', title: 'Insurance-Verified Vehicles', desc: 'Every host must carry active comprehensive insurance, checked before their listing goes live — see our Insurance & Damage Policy.' },
  { icon: '📸', title: 'Digital Handover Logs', desc: 'Photo-documented pickup and drop-off protects both lessees and hosts from disputes.' },
  { icon: '💰', title: 'Escrowed Deposits', desc: 'Security deposits are held separately and only released after a clean vehicle return.' },
  { icon: '📍', title: 'Live Vehicle Telemetry', desc: 'Keyless-enabled vehicles report live location and status for faster roadside response.' },
  { icon: '📞', title: '24/7 Roadside Support', desc: 'A dedicated emergency line is included with every single booking, no exceptions.' },
];

export default function SafetyPage() {
  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Navbar />
      <PageHero eyebrow="Trust & Safety" title="Safety is the foundation" subtitle="Every layer of ZiyamSelfDrive — from sign-up to drop-off — is designed to protect lessees and hosts alike." />

      <section className="py-16 bg-white">
        <div className="max-w-5xl mx-auto px-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 mb-16">
            {PILLARS.map((p) => (
              <div key={p.title} className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
                <span className="text-3xl block mb-3">{p.icon}</span>
                <h3 className="font-bold text-gray-900 text-sm mb-2">{p.title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>

          <div className="bg-gray-950 text-white rounded-2xl p-8 text-center">
            <h3 className="font-bold text-lg mb-2">See something concerning?</h3>
            <p className="text-gray-400 text-sm mb-4">Report any safety issue and our Trust & Safety team will respond within hours.</p>
            <a href="/support#contact" className="btn-gradient text-white font-bold px-6 py-3 rounded-xl inline-block transition">
              Report a Concern
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
