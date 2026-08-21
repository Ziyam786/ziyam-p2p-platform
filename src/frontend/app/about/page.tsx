'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import Emblem3D from '../../components/Emblem3D';
import { COMPANY } from '../../lib/companyInfo';

interface TeamMember {
  name: string;
  role: string;
  focus: string;
  bio: string;
  chips: string[];
  instagram: string;
  photo: string;
}

// Richer per-person data for this page's expandable cards — name/role/bio
// stay in sync with the shared COMPANY.team (Footer, admin-editable
// company_info), the fields below (focus/chips/instagram/photo) are only
// ever shown here, so they don't belong in that shared object.
const TEAM: TeamMember[] = [
  {
    name: 'Syed Fardeen',
    role: 'Founder, CEO & Director',
    focus: 'Strategy & Technology',
    bio: COMPANY.team[0].bio ?? '',
    chips: ['Product strategy', 'Full-stack development', 'Fleet economics', 'Brand', 'Fundraising'],
    instagram: 'itz_fardeen_ziyam',
    photo: '/team/syed-fardeen.jpg',
  },
  {
    name: 'Mohammed Azam A',
    role: 'Co-Founder & Managing Director',
    focus: 'Growth & Expansion',
    bio: COMPANY.team[1].bio ?? '',
    chips: ['Business development', 'Partnerships', 'P&L ownership', 'Hub expansion'],
    instagram: 'mr_azam_0705',
    photo: '/team/mohammed-azam.jpg',
  },
  {
    name: 'Shaik Afnan Sabil',
    role: 'Co-Founder & VP, Operations',
    focus: 'Fleet & Ground Ops',
    bio: COMPANY.team[2].bio ?? '',
    chips: ['Vehicle inspection', 'Preventive maintenance', 'Hub protocols', 'Agent training'],
    instagram: 'shaik_afnan_sabil',
    photo: '/team/shaik-afnan.jpg',
  },
  {
    name: 'Junaid Khan',
    role: 'Co-Founder & Chief Operating Officer',
    focus: 'Operations',
    bio: COMPANY.team[3].bio ?? '',
    chips: ['Fleet operations', 'Utilisation planning', 'SLA design', 'Vendor management'],
    instagram: 'junxid_khxn_02',
    photo: '/team/junaid-khan.jpg',
  },
  {
    name: 'Numer Saqlain Muneer',
    role: 'Co-Founder & Chief Financial Officer',
    focus: 'Finance & Technology',
    bio: COMPANY.team[4].bio ?? '',
    chips: ['Financial planning', 'Unit economics', 'GST & compliance', 'Full-stack development', 'Payments'],
    instagram: '_sonu_._._24',
    photo: '/team/numer-saqlain.jpg',
  },
];

const BUILDING = [
  {
    name: 'Self-drive mobile app',
    status: 'In development',
    description: 'Native booking, digital KYC, keyless handover checklist, live trip and fare view, and in-app roadside request routed to Mechanix Pro.',
    items: ['Booking & availability', 'Digital KYC', 'Handover checklist', 'Trip & fare view'],
  },
  {
    name: 'Host web app',
    status: 'In development',
    description: 'Peer-to-peer supply side: list a car, set availability and pricing, track trip-wise earnings, and view settlement cycles.',
    items: ['Listing & onboarding', 'Availability calendar', 'Earnings dashboard', 'Settlement view'],
  },
  {
    name: 'Fleet operations console',
    status: 'In development',
    description: 'Internal tooling for hub teams: vehicle status, inspection logs, maintenance scheduling and agent performance.',
    items: ['Vehicle status', 'Inspection logs', 'PM scheduling', 'Agent scoring'],
  },
  {
    name: 'Multi-business platform',
    status: 'Roadmap',
    description: 'One account layer across mobility, roadside assistance and stay — shared identity, payments and support across EFPL brands.',
    items: ['Shared identity', 'Unified payments', 'Cross-brand support'],
  },
];

const STACK = ['React', 'React Native', 'Node.js', 'REST APIs', 'PostgreSQL', 'Payments & settlements', 'Digital KYC', 'Cloud hosting', 'Git'];

const BRANDS: { name: string; description: string; instagram: string | null }[] = [
  { name: 'Ziyam Self Drive', description: 'Self-drive rentals & peer-to-peer hosting', instagram: 'ziyambyeightlines' },
  { name: 'Eightlines Fleet', description: 'Parent company & fleet operations', instagram: 'eightlinesfleetofficial' },
  { name: 'Mechanix Pro', description: 'Roadside assistance & rapid servicing', instagram: null },
  { name: 'Marc8', description: 'Digital tools & refurbished products', instagram: 'marc8officialindia' },
  { name: 'Marc8 Lifestyle', description: 'Lifestyle & retail', instagram: 'marc8lifestyleofficial' },
  { name: 'Marc8Stay', description: 'Short-term accommodation', instagram: 'marc8stay' },
];

export default function AboutPage() {
  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <div style={{ fontFamily: "'Poppins', system-ui, sans-serif" }}>
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;800&display=swap" rel="stylesheet" />

      <Navbar />

      <div className="bg-[#2A2320] text-[#EFE9DE]">
        <div className="max-w-5xl mx-auto px-6">
          {/* ── HERO ─────────────────────────────────────────────────── */}
          <header className="pt-20 pb-6">
            <div className="flex flex-col md:flex-row items-center gap-10">
              <div className="flex-1 text-center md:text-left">
                <p className="text-[#2F9E4F] font-semibold text-xs uppercase tracking-[0.2em]">Eightlines Fleet Private Limited</p>
                <h1 className="font-extrabold mt-3" style={{ fontSize: 'clamp(2.2rem,6vw,3.6rem)', lineHeight: 1.05, letterSpacing: '-0.02em' }}>
                  Five founders.
                  <br />
                  <span className="text-[#2F9E4F]">One fleet, built in-house.</span>
                </h1>
                <p className="text-[#96887A] mt-5 max-w-[56ch] mx-auto md:mx-0 text-[1.02rem]">
                  Self-drive rentals and peer-to-peer hosting, roadside assistance, and stay — run by an operating team that also writes the software.
                  Every leader below owns a live part of the business, not a title.
                </p>
                <div className="flex flex-wrap gap-3 mt-8 justify-center md:justify-start">
                  {[
                    ['5', 'Founders'],
                    ['4', 'Brands'],
                    ['3', 'Products in build'],
                    ['3', 'ISO certifications'],
                    ['DPIIT', 'Recognised startup'],
                  ].map(([n, label]) => (
                    <div key={label} className="border border-[#463C36] rounded-xl px-4 py-3">
                      <p className="font-extrabold text-2xl">{n}</p>
                      <p className="text-[#96887A] text-[0.7rem] uppercase tracking-wider">{label}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="shrink-0">
                <Emblem3D plateSrc="/emblems/ziyam-plate.svg" artSrc="/emblems/ziyam-art.svg" label="Ziyam Self Drive emblem" glareColor="255,252,240" size={220} />
              </div>
            </div>
          </header>

          <div className="h-px bg-[#463C36] my-14" />

          {/* ── TEAM ─────────────────────────────────────────────────── */}
          <section>
            <h2 className="font-extrabold" style={{ fontSize: 'clamp(1.7rem,3.6vw,2.4rem)' }}>
              The <span className="text-[#2F9E4F]">team</span>
            </h2>
            <p className="text-[#96887A] mt-2 max-w-[58ch]">Tap any founder to open their profile, focus areas and skills.</p>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 mt-8">
              {TEAM.map((person, i) => (
                <button
                  key={person.name}
                  onClick={() => setExpanded(expanded === i ? null : i)}
                  aria-expanded={expanded === i}
                  className="text-left group"
                >
                  <div className="relative rounded-xl overflow-hidden bg-[#161110] aspect-square">
                    <Image src={person.photo} alt={person.name} fill sizes="200px" className="object-cover grayscale group-hover:grayscale-0 transition-all duration-300" />
                  </div>
                  <p className="font-bold text-sm mt-2 leading-tight">{person.name}</p>
                  <p className="text-[#96887A] text-xs mt-0.5 leading-tight">{person.role}</p>
                  <p className="text-[#2F9E4F] text-[0.68rem] font-semibold uppercase tracking-wider mt-1">{person.focus}</p>
                </button>
              ))}
            </div>

            {TEAM.map((person, i) =>
              expanded === i ? (
                <div key={person.name} className="mt-6 bg-[#332A26] border-l-4 border-[#2F9E4F] rounded-lg p-6">
                  <h3 className="font-extrabold text-lg">{person.name}</h3>
                  <p className="text-[#96887A] text-sm mt-0.5">{person.role}</p>
                  <p className="mt-3 text-sm leading-relaxed max-w-[70ch]">{person.bio}</p>
                  <div className="flex flex-wrap gap-2 mt-4">
                    {person.chips.map((chip) => (
                      <span key={chip} className="text-[0.7rem] font-semibold bg-[#2F9E4F]/15 text-[#2F9E4F] px-3 py-1 rounded-full">
                        {chip}
                      </span>
                    ))}
                  </div>
                  <a
                    href={`https://instagram.com/${person.instagram}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-4 text-sm text-[#2F9E4F] hover:underline"
                  >
                    @{person.instagram}
                  </a>
                </div>
              ) : null
            )}
          </section>

          <div className="h-px bg-[#463C36] my-14" />

          {/* ── WHAT WE'RE BUILDING ──────────────────────────────────── */}
          <section>
            <h2 className="font-extrabold" style={{ fontSize: 'clamp(1.7rem,3.6vw,2.4rem)' }}>
              What we&apos;re <span className="text-[#2F9E4F]">building</span>
            </h2>
            <p className="text-[#96887A] mt-2 max-w-[58ch]">
              Product direction comes from all the founders. The platform is designed and developed in-house by the Eightlines team — no outsourced build.
            </p>

            <div className="grid sm:grid-cols-2 gap-5 mt-8">
              {BUILDING.map((item) => (
                <article key={item.name} className="bg-[#332A26] rounded-xl p-6 border border-transparent hover:border-[#2F9E4F] transition-colors">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-extrabold text-[1.05rem]">{item.name}</h3>
                    <span
                      className={`text-[0.58rem] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full shrink-0 ${
                        item.status === 'In development' ? 'bg-[#2F9E4F]/15 text-[#2F9E4F]' : 'bg-[#96887A]/15 text-[#96887A]'
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>
                  <p className="text-[#96887A] text-[0.85rem] mt-2">{item.description}</p>
                  <ul className="mt-4 space-y-1.5">
                    {item.items.map((line) => (
                      <li key={line} className="text-[0.8rem] flex items-center gap-2">
                        <span className="w-1 h-1 rounded-full bg-[#2F9E4F] shrink-0" />
                        {line}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>

            <p className="text-[#96887A] text-sm mt-9">Working stack</p>
            <div className="flex flex-wrap gap-2 mt-3">
              {STACK.map((tech) => (
                <span key={tech} className="text-xs font-medium bg-[#332A26] border border-[#463C36] px-3 py-1.5 rounded-full">
                  {tech}
                </span>
              ))}
            </div>
          </section>

          <div className="h-px bg-[#463C36] my-14" />

          {/* ── REGISTERED & CERTIFIED ───────────────────────────────── */}
          <section>
            <h2 className="font-extrabold" style={{ fontSize: 'clamp(1.7rem,3.6vw,2.4rem)' }}>
              Registered &amp; <span className="text-[#2F9E4F]">certified</span>
            </h2>
            <p className="text-[#96887A] mt-2 max-w-[58ch]">Independently audited management systems, and statutory registration in India.</p>

            <div className="grid sm:grid-cols-3 gap-5 mt-8">
              {COMPANY.certifications.map((cert) => (
                <article key={cert.certNumber} className="bg-[#332A26] rounded-xl p-6 border border-transparent hover:border-[#2F9E4F] transition-colors">
                  <span className="text-[0.58rem] font-semibold uppercase tracking-wider bg-[#2F9E4F]/15 text-[#2F9E4F] px-2.5 py-1 rounded-full">Certified</span>
                  <h3 className="font-extrabold text-[1.05rem] mt-3.5">{cert.standard}</h3>
                  <p className="text-[#96887A] text-[0.82rem] mt-1">{cert.name}</p>
                  <div className="mt-4 border-t border-[#463C36] pt-3.5 space-y-2 text-[0.74rem]">
                    <div className="flex justify-between gap-3">
                      <dt className="text-[#96887A]">Certificate</dt>
                      <dd className="font-semibold">{cert.certNumber}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-[#96887A]">Issued</dt>
                      <dd className="font-semibold">{COMPANY.certificationValidFrom}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-[#96887A]">Valid to</dt>
                      <dd className="font-semibold">{COMPANY.certificationExpiry}</dd>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            <p className="text-[#96887A] text-xs mt-5">
              Certified by {COMPANY.certifyingBody} under EGAC/IAF accreditation. Validity subject to annual surveillance audits.
            </p>

            <div className="mt-7 bg-[#332A26] border-l-4 border-[#2F9E4F] rounded-lg p-5">
              <span className="block text-[#2F9E4F] text-[0.62rem] font-semibold uppercase tracking-wider">Certified scope of activities</span>
              <p className="text-sm mt-2 max-w-[76ch]">
                Technology-driven fleet logistics, asset aggregation platforms, peer-to-peer mobility routing, B2B corporate vehicle rental management, and
                high-end event and luxury hospitality transport operations.
              </p>
            </div>
          </section>

          <div className="h-px bg-[#463C36] my-14" />

          {/* ── THE GROUP ────────────────────────────────────────────── */}
          <section>
            <h2 className="font-extrabold" style={{ fontSize: 'clamp(1.7rem,3.6vw,2.4rem)' }}>
              The <span className="text-[#2F9E4F]">group</span>
            </h2>
            <p className="text-[#96887A] mt-2 max-w-[58ch]">Ziyam Self Drive is a brand of Eightlines Fleet Private Limited.</p>

            <div className="flex flex-col sm:flex-row items-center gap-9 mt-8">
              <div className="shrink-0">
                <Emblem3D plateSrc="/emblems/eightlines-plate.svg" artSrc="/emblems/eightlines-art.svg" label="Eightlines Fleet Private Limited emblem" glareColor="255,248,220" size={200} />
              </div>
              <div className="flex-1">
                <h3 className="font-extrabold text-[1.2rem]">{COMPANY.legalName}</h3>
                <p className="text-[#96887A] text-sm mt-3 max-w-[60ch]">
                  The parent company behind Ziyam Self Drive, Mechanix Pro and the Marc8 brands. Registered in India and operating out of Bengaluru,
                  Eightlines holds the fleet, the hub network and the technology built in-house by the team.
                </p>
              </div>
            </div>
          </section>

          <div className="h-px bg-[#463C36] my-14" />

          {/* ── BRANDS TABLE ─────────────────────────────────────────── */}
          <section className="pb-20">
            <h2 className="font-extrabold" style={{ fontSize: 'clamp(1.7rem,3.6vw,2.4rem)' }}>
              Brands under <span className="text-[#2F9E4F]">Eightlines</span>
            </h2>
            <p className="text-[#96887A] mt-2 max-w-[58ch]">One group, several businesses across mobility, servicing, retail and stay.</p>

            <div className="overflow-x-auto mt-8">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[#96887A] text-xs uppercase tracking-wider border-b border-[#463C36]">
                    <th className="py-3 pr-4 font-semibold">Brand</th>
                    <th className="py-3 pr-4 font-semibold">What it does</th>
                    <th className="py-3 font-semibold">Instagram</th>
                  </tr>
                </thead>
                <tbody>
                  {BRANDS.map((brand) => (
                    <tr key={brand.name} className="border-b border-[#463C36]/60 last:border-0">
                      <td className="py-3.5 pr-4 font-bold">{brand.name}</td>
                      <td className="py-3.5 pr-4 text-[#96887A]">{brand.description}</td>
                      <td className="py-3.5">
                        {brand.instagram ? (
                          <a href={`https://instagram.com/${brand.instagram}`} target="_blank" rel="noopener noreferrer" className="text-[#2F9E4F] hover:underline">
                            @{brand.instagram}
                          </a>
                        ) : (
                          <span className="text-[#96887A]">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>

      <Footer />
    </div>
  );
}
