import React from 'react';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import PageHero from '../../components/PageHero';

const PLANS = [
  {
    name: 'Basic',
    price: 'Included free',
    features: ['Standard third-party liability coverage', 'Covers legal liability to third parties', 'Renter responsible for own-damage repair costs'],
  },
  {
    name: 'Standard',
    price: '+₹149/day',
    features: ['Everything in Basic', 'Reduced own-damage liability (up to 80% covered)', '24/7 roadside assistance priority queue', 'Lower security deposit hold'],
    highlight: true,
  },
  {
    name: 'Premium',
    price: '+₹349/day',
    features: ['Everything in Standard', 'Zero liability on accidental damage', 'Windscreen & tyre cover included', 'Instant claim approval', 'No security deposit hold'],
  },
];

export default function InsurancePage() {
  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Navbar />
      <PageHero eyebrow="For Hosts & Renters" title="Insurance Coverage" subtitle="Every trip on ZiyamSelfDrive is protected. Choose the plan that fits your risk appetite." />

      <section className="py-16 bg-white">
        <div className="max-w-5xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-14">
            {PLANS.map((p) => (
              <div key={p.name} className={`rounded-2xl p-6 border-2 ${p.highlight ? 'border-amber-500 bg-amber-50' : 'border-gray-100 bg-gray-50'}`}>
                <h3 className="font-extrabold text-lg text-gray-900">{p.name}</h3>
                <p className="text-amber-600 font-bold text-sm mb-4">{p.price}</p>
                <ul className="space-y-2">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className="text-emerald-500 font-bold">✓</span> {f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
            <h3 className="font-bold text-gray-900 mb-2">For Hosts: Your vehicle is protected too</h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              Every host vehicle is required to carry a valid comprehensive insurance policy. Ziyam's protection plans
              supplement this by covering the renter's liability during the trip — reducing claim disputes and
              protecting your vehicle's resale value.
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
