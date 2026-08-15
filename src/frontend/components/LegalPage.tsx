import React from 'react';
import Navbar from './Navbar';
import Footer from './Footer';

export interface LegalSection { heading: string; body: string[]; }

export default function LegalPage({ title, updated, sections }: { title: string; updated: string; sections: LegalSection[] }) {
  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 pt-28 pb-24">
        <h1 className="text-2xl font-extrabold text-gray-900 mb-1">{title}</h1>
        <p className="text-xs text-gray-400 mb-8">Last updated: {updated}</p>
        <div className="bg-white rounded-2xl border border-gray-100 p-8 space-y-8">
          {sections.map((s) => (
            <div key={s.heading}>
              <h2 className="font-bold text-gray-900 mb-2">{s.heading}</h2>
              {s.body.map((p, i) => (
                <p key={i} className="text-sm text-gray-600 leading-relaxed mb-2 last:mb-0">{p}</p>
              ))}
            </div>
          ))}
        </div>
      </div>
      <Footer />
    </div>
  );
}
