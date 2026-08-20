import React from 'react';
import Navbar from './Navbar';
import Footer from './Footer';

export interface LegalSection { heading: string; body: string[]; }
export interface LegalSummaryCard { icon: string; title: string; body: string; }

interface LegalPageProps {
  title: string;
  updated: string;
  /** Anchor id + nav label for the full legal text — matches ziyam.in's
   * pattern of a page-specific anchor alongside #summary/#contact
   * (e.g. "terms" for Terms & Conditions, "policy" for Privacy/Refund). */
  detailsAnchor: string;
  detailsLabel: string;
  /** 4–6 short, icon-led cards summarizing the key provisions — the
   * "At a Glance" section ziyam.in leads every legal page with, so a
   * renter/host can get the gist without reading the full clauses. */
  summary: LegalSummaryCard[];
  sections: LegalSection[];
  /** Grievance/contact block rendered at the end with its own #contact
   * anchor, per ziyam.in's structure. */
  contact: { body: string[] };
}

function AnchorNav({ detailsAnchor, detailsLabel }: { detailsAnchor: string; detailsLabel: string }) {
  const links = [
    { href: '#summary', label: 'At a Glance' },
    { href: `#${detailsAnchor}`, label: detailsLabel },
    { href: '#contact', label: 'Contact' },
  ];
  return (
    <nav className="sticky top-16 z-10 bg-white/95 backdrop-blur border-b border-gray-100 -mx-4 px-4 sm:mx-0 sm:px-0 sm:rounded-2xl sm:border sm:mb-8">
      <div className="flex gap-6 overflow-x-auto py-3 text-sm font-semibold text-gray-500 sm:px-6">
        {links.map((l) => (
          <a key={l.href} href={l.href} className="whitespace-nowrap hover:text-amber-500 transition">
            {l.label}
          </a>
        ))}
      </div>
    </nav>
  );
}

export default function LegalPage({ title, updated, detailsAnchor, detailsLabel, summary, sections, contact }: LegalPageProps) {
  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 pt-28 pb-24">
        <h1 className="text-2xl font-extrabold text-gray-900 mb-1">{title}</h1>
        <p className="text-xs text-gray-400 mb-6">Last updated: {updated}</p>

        <AnchorNav detailsAnchor={detailsAnchor} detailsLabel={detailsLabel} />

        <section id="summary" className="scroll-mt-32 mb-10">
          <h2 className="text-sm font-bold uppercase tracking-wide text-gray-400 mb-4">At a Glance</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {summary.map((card) => (
              <div key={card.title} className="bg-white rounded-2xl border border-gray-100 p-5">
                <span className="text-2xl block mb-2">{card.icon}</span>
                <p className="font-bold text-gray-900 text-sm mb-1">{card.title}</p>
                <p className="text-gray-500 text-xs leading-relaxed">{card.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section id={detailsAnchor} className="scroll-mt-32 bg-white rounded-2xl border border-gray-100 p-8 space-y-8 mb-10">
          <h2 className="text-sm font-bold uppercase tracking-wide text-gray-400">{detailsLabel}</h2>
          {sections.map((s) => (
            <div key={s.heading}>
              <h3 className="font-bold text-gray-900 mb-2">{s.heading}</h3>
              {s.body.map((p, i) => (
                <p key={i} className="text-sm text-gray-600 leading-relaxed mb-2 last:mb-0">{p}</p>
              ))}
            </div>
          ))}
        </section>

        <section id="contact" className="scroll-mt-32 bg-marc8cream border border-amber-200 rounded-2xl p-6">
          <h2 className="text-sm font-bold uppercase tracking-wide text-amber-700 mb-3">Contact</h2>
          {contact.body.map((p, i) => (
            <p key={i} className="text-sm text-gray-700 leading-relaxed mb-2 last:mb-0">{p}</p>
          ))}
        </section>
      </div>
      <Footer />
    </div>
  );
}
