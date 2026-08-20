import React from 'react';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import PageHero from '../../components/PageHero';

const PLANS = [
  {
    name: 'Basic',
    price: 'Included free',
    features: ['Standard security deposit terms', 'Full deposit held until clean return', '24/7 roadside assistance included'],
  },
  {
    name: 'Standard',
    price: '+₹149/day',
    features: ['Everything in Basic', 'Reduced security deposit hold', 'Priority roadside assistance queue'],
    highlight: true,
  },
  {
    name: 'Premium',
    price: '+₹349/day',
    features: ['Everything in Standard', 'Lowest security deposit hold', '24/7 priority support'],
  },
];

export default function InsurancePage() {
  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Navbar />
      <PageHero eyebrow="For Hosts & Lessees" title="Insurance & Damage Policy" subtitle="An honest explanation of who's covered, by whom, and what happens if something goes wrong." />

      <section className="py-16 bg-white">
        <div className="max-w-5xl mx-auto px-4">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 mb-14">
            <h3 className="font-bold text-gray-900 mb-2">⚠️ ZiyamSelfDrive does not provide vehicle damage insurance</h3>
            <p className="text-sm text-gray-700 leading-relaxed">
              We're a peer-to-peer marketplace, not an insurer. Every listed car is required to carry its own active
              comprehensive insurance policy, arranged and paid for by the host — this is checked at onboarding and
              can't be skipped. Protection plans below only change your <strong>security deposit</strong> hold and
              support priority; they do not transfer any damage liability to ZiyamSelfDrive.
            </p>
          </div>

          <h2 className="text-xl font-extrabold text-gray-900 mb-2">Protection Plans</h2>
          <p className="text-sm text-gray-500 mb-6">Lessee-facing add-ons that affect your deposit hold, not who pays for damage.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-14">
            {PLANS.map((p) => (
              <div key={p.name} className={`rounded-2xl p-6 border-2 ${p.highlight ? 'border-amber-500 bg-amber-50' : 'border-gray-100 bg-gray-50'}`}>
                <h3 className="font-extrabold text-lg text-gray-900">{p.name}</h3>
                <p className="text-amber-600 font-bold text-sm mb-4">{p.price}</p>
                <ul className="space-y-2">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className="text-amber-500 font-bold">✓</span> {f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <h2 className="text-xl font-extrabold text-gray-900 mb-6">How damage is actually handled</h2>
          <div className="space-y-4 mb-14">
            <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
              <h3 className="font-bold text-gray-900 mb-2">1. The host's own comprehensive insurance is the primary cover</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                Every car on the platform must have active comprehensive insurance at listing time. When damage
                happens during a trip, the host's policy — not ZiyamSelfDrive — is the mechanism that pays for repairs.
              </p>
            </div>
            <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
              <h3 className="font-bold text-gray-900 mb-2">2. Hosts recover costs from the lessee directly, from the security deposit first</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                Lessee-caused damage is deducted from the held security deposit first. If costs exceed the deposit,
                the host is responsible for recovering the difference from the lessee — the same as any other P2P
                rental marketplace.
              </p>
            </div>
            <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
              <h3 className="font-bold text-gray-900 mb-2">3. ZiyamSelfDrive assists — up to ₹20,000 per claim</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                We're not the insurer, but we don't leave hosts on their own either: our support team helps coordinate
                the claim and will try to cover up to ₹20,000 of a damage cost directly. Beyond that, the host's own
                comprehensive insurance is used to get the vehicle repaired.
              </p>
            </div>
            <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
              <h3 className="font-bold text-gray-900 mb-2">4. 24/7 roadside assistance, always included</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                Breakdowns and abandoned-vehicle situations are covered regardless of protection plan — we'll recover
                the vehicle to the nearest garage and connect the host with trusted repair options from there.
              </p>
            </div>
          </div>

          <div className="bg-gray-950 text-white rounded-2xl p-6">
            <h3 className="font-bold mb-2">For hosts: what's required before you list</h3>
            <p className="text-sm text-gray-400 leading-relaxed">
              An active comprehensive insurance policy is mandatory to list a car — you'll upload it during onboarding
              and we verify it before your listing goes live. See our full{' '}
              <a href="/host/policy" className="text-amber-400 hover:underline">Host Policy</a> for eligibility,
              payouts, and damage-recovery details.
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
