import React from 'react';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import PageHero from '../../components/PageHero';
import RoadTimeline from '../../components/RoadTimeline';
import ScrollReveal, { StaggerGroup, StaggerItem } from '../../components/ScrollReveal';
import MotionButton from '../../components/MotionButton';
import { COMPANY } from '../../lib/companyInfo';

const VALUES = [
  { icon: '🤝', title: 'Trust First', desc: 'Every host and lessee is KYC-verified. Every car is inspected before it goes live.' },
  { icon: '⚖️', title: 'Fair Splits', desc: 'Hosts keep 70% of every booking — one of the highest host shares of any platform in India.' },
  { icon: '🌱', title: 'Idle Assets, Active Income', desc: 'The average private car sits parked most of the day. We help owners put that time to work.' },
  { icon: '🔐', title: 'Safety by Design', desc: 'Escrowed deposits, N+1 payouts, mandatory KYC, and dedicated support protect both sides of every trip.' },
];

const TIMELINE = [
  { year: 'Mar 2026', title: 'Incorporated', desc: `${COMPANY.legalName} was registered (CIN ${COMPANY.cin}) to build ZiyamSelfDrive.` },
  { year: '2026', title: 'Bengaluru Launch', desc: `Live in ${COMPANY.operatingCity}, onboarding our first verified hosts and fleet partners.` },
  { year: 'Next', title: 'Pan-India Expansion', desc: 'Scaling city by city as our host and fleet network grows beyond Bengaluru.' },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Navbar />
      <PageHero
        eyebrow="Our Story"
        title="Making every car a shared asset"
        subtitle="ZiyamSelfDrive is a peer-to-peer self-drive marketplace — connecting car owners with lessees who just want the keys, not the driver."
      />

      <section className="py-14 bg-white">
        <ScrollReveal className="max-w-2xl mx-auto px-4 text-center">
          <p className="inline-block text-xs font-semibold bg-amber-50 text-amber-600 px-3 py-1.5 rounded-full mb-4">
            📍 {COMPANY.scopeNote}
          </p>
          <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900">
            A young company, <span className="text-amber-500">built to move fast</span>
          </h2>
          <p className="text-gray-500 text-sm mt-3">
            {COMPANY.legalName} was registered on {COMPANY.registeredDate} — we're early, and honest about it. We'd rather earn your trust city by city than promise a scale we haven't reached yet.
          </p>
        </ScrollReveal>
      </section>

      <section className="py-16 bg-gray-50">
        <div className="max-w-5xl mx-auto px-4">
          <ScrollReveal>
            <h2 className="text-2xl font-extrabold text-gray-900 mb-2 text-center">What We Believe</h2>
            <p className="text-gray-500 text-sm text-center mb-10">The principles behind every product decision we make</p>
          </ScrollReveal>
          <StaggerGroup className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
            {VALUES.map((v) => (
              <StaggerItem key={v.title}>
                <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 text-center h-full hover:border-amber-300 hover:shadow-md transition">
                  <span className="text-3xl block mb-3">{v.icon}</span>
                  <h3 className="font-bold text-gray-900 text-sm mb-2">{v.title}</h3>
                  <p className="text-xs text-gray-500 leading-relaxed">{v.desc}</p>
                </div>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </div>
      </section>

      <section className="py-16 bg-white">
        <div className="max-w-3xl mx-auto px-4">
          <ScrollReveal>
            <h2 className="text-2xl font-extrabold text-gray-900 mb-2 text-center">Our Journey</h2>
            <p className="text-gray-500 text-sm text-center mb-10">Where we've been, and where we're headed</p>
          </ScrollReveal>
          <RoadTimeline items={TIMELINE} />
        </div>
      </section>

      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4">
          <ScrollReveal>
            <h2 className="text-2xl font-extrabold text-gray-900 mb-2 text-center">Recognition & Certifications</h2>
            <p className="text-gray-500 text-sm text-center mb-10">Real credentials, not marketing claims</p>
          </ScrollReveal>
          <StaggerGroup className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
            {COMPANY.startupIndiaRecognized && (
              <StaggerItem>
                <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 h-full">
                  <span className="text-2xl block mb-2">🇮🇳</span>
                  <h3 className="font-bold text-gray-900 text-sm">Startup India Recognized</h3>
                  <p className="text-xs text-gray-500 mt-1">DPIIT-recognized under the Government of India's Startup India initiative.</p>
                </div>
              </StaggerItem>
            )}
            {COMPANY.certifications.map((c) => (
              <StaggerItem key={c.standard}>
                <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 h-full">
                  <span className="text-2xl block mb-2">📋</span>
                  <h3 className="font-bold text-gray-900 text-sm">{c.standard}</h3>
                  <p className="text-xs text-gray-500 mt-1">{c.name}</p>
                  <p className="text-[11px] text-gray-400 mt-2 font-mono">Cert No. {c.certNumber}</p>
                </div>
              </StaggerItem>
            ))}
          </StaggerGroup>
          <p className="text-center text-xs text-gray-400 mb-6">
            Certified by {COMPANY.certifyingBody}, IAF-accredited · Valid {COMPANY.certificationValidFrom} – {COMPANY.certificationExpiry}
          </p>
        </div>
      </section>

      <section className="py-16 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4">
          <ScrollReveal>
            <h2 className="text-2xl font-extrabold text-gray-900 mb-2 text-center">Leadership</h2>
            <p className="text-gray-500 text-sm text-center mb-10">The team behind {COMPANY.brandFull}</p>
          </ScrollReveal>
          <StaggerGroup className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
            {COMPANY.team.map((person) => (
              <StaggerItem key={person.name}>
                <div className="bg-white rounded-2xl p-5 border border-gray-100 text-center h-full">
                  <div className="w-14 h-14 rounded-full bg-amber-50 text-amber-600 font-bold text-lg flex items-center justify-center mx-auto mb-3">
                    {person.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}
                  </div>
                  <p className="font-bold text-gray-900 text-sm">{person.name}</p>
                  <p className="text-xs text-gray-500 mt-1">{person.role}</p>
                  {person.bio && <p className="text-xs text-gray-400 mt-2 leading-relaxed">{person.bio}</p>}
                </div>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </div>
      </section>

      <section className="py-16 bg-amber-500 text-center">
        <ScrollReveal className="max-w-2xl mx-auto px-4">
          <h2 className="text-2xl font-extrabold text-white mb-3">Built by Eightlines</h2>
          <p className="text-amber-100 text-sm mb-6">
            ZiyamSelfDrive is operated by {COMPANY.legalName}, a small Bengaluru team obsessed with making mobility in India more flexible, affordable, and trustworthy.
          </p>
          <MotionButton href="/careers" className="bg-white text-amber-600 font-bold px-6 py-3 rounded-xl inline-block hover:bg-amber-50 transition-colors">
            View Open Roles
          </MotionButton>
        </ScrollReveal>
      </section>

      <Footer />
    </div>
  );
}
