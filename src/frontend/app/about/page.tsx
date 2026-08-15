import React from 'react';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import PageHero from '../../components/PageHero';
import StatsSpeedometer from '../../components/StatsSpeedometer';
import RoadTimeline from '../../components/RoadTimeline';
import ScrollReveal, { StaggerGroup, StaggerItem } from '../../components/ScrollReveal';
import MotionButton from '../../components/MotionButton';

const VALUES = [
  { icon: '🤝', title: 'Trust First', desc: 'Every host and renter is KYC-verified. Every car is inspected before it goes live.' },
  { icon: '⚖️', title: 'Fair Splits', desc: 'Hosts keep 70% of every booking — the highest host share of any major platform in India.' },
  { icon: '🌱', title: 'Idle Assets, Active Income', desc: 'The average private car sits parked 95% of the time. We help owners put that time to work.' },
  { icon: '🔐', title: 'Safety by Design', desc: 'Escrowed deposits, N+1 payouts, and 24/7 support protect both sides of every trip.' },
];

const SPEEDO_STATS = [
  { value: '5,000+', percent: 0.7, label: 'Verified Cars' },
  { value: '1 Lakh+', percent: 0.85, label: 'Happy Renters' },
  { value: '4.6 / 5', percent: 0.92, label: 'Average Rating' },
  { value: '30+', percent: 0.5, label: 'Cities Covered' },
];

const TIMELINE = [
  { year: '2023', title: 'The Inception', desc: 'Eightlines starts building ZiyamSelfDrive after struggling to find affordable, driver-free rentals while travelling.' },
  { year: '2024', title: 'Bengaluru Launch', desc: 'Launched in Bengaluru with 50 host-listed cars and a keyless-entry pilot.' },
  { year: '2025', title: 'Pan-India Expansion', desc: 'Expanded to 30+ cities across India with fleet-operator partnerships.' },
  { year: '2026', title: 'Scale', desc: 'Crossed 1 lakh completed trips and 5,000 verified vehicles on the platform.' },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Navbar />
      <PageHero
        eyebrow="Our Story"
        title="Making every car a shared asset"
        subtitle="ZiyamSelfDrive is India's peer-to-peer self-drive marketplace — connecting car owners with renters who just want the keys, not the driver."
      />

      <section className="py-16 bg-white">
        <ScrollReveal className="max-w-3xl mx-auto px-4 text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900">
            Our <span className="text-amber-500">proven record</span> speaks for itself
          </h2>
        </ScrollReveal>
        <ScrollReveal delay={0.15} className="max-w-4xl mx-auto px-4">
          <StatsSpeedometer stats={SPEEDO_STATS} />
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
            <p className="text-gray-500 text-sm text-center mb-10">From a two-person idea to a pan-India platform</p>
          </ScrollReveal>
          <RoadTimeline items={TIMELINE} />
        </div>
      </section>

      <section className="py-16 bg-amber-500 text-center">
        <ScrollReveal className="max-w-2xl mx-auto px-4">
          <h2 className="text-2xl font-extrabold text-white mb-3">Built by Eightlines</h2>
          <p className="text-amber-100 text-sm mb-6">
            ZiyamSelfDrive is operated by Eightlines, a small team obsessed with making mobility in India more
            flexible, affordable, and trustworthy.
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
