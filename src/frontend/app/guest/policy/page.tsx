import React from 'react';
import Navbar from '../../../components/Navbar';
import Footer from '../../../components/Footer';
import PageHero from '../../../components/PageHero';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-12">
      <h2 className="text-xl font-extrabold text-gray-900 mb-4">{title}</h2>
      {children}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 mb-4">
      <h3 className="font-bold text-gray-900 mb-2">{title}</h3>
      <div className="text-sm text-gray-600 leading-relaxed space-y-2">{children}</div>
    </div>
  );
}

const PENALTY_SCHEDULE: [string, string][] = [
  ['Unauthorized Driver / Handover to Third Party', '₹10,000/- + Immediate Termination'],
  ['Tampering with Dashcam or OBD Port (GPS)', '₹12,500/-'],
  ['Loss of or Damage to Vehicle Keys', '₹10,000/- + lock system cost (up to ₹75,000)'],
  ['Loss of Original Vehicle Documents', '₹10,000/-'],
  ['Overspeeding (above 100 km/h)', '₹2,500/- per instance'],
  ['Harsh Braking / Rapid Acceleration (telematics-tracked)', '₹1,000/- – ₹2,000/-'],
  ['DUI / Reckless Driving', '100% of all costs + legal action'],
  ['Smoking or Alcohol Consumption inside Vehicle', '₹1,250/-'],
  ['Exterior Washing Required (dirt/mud)', '₹500/-'],
  ['Interior Cleaning (spills, stains, trash)', '₹700/- to ₹1,500/-'],
];

export default function GuestPolicyPage() {
  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Navbar />
      <PageHero eyebrow="For Guests" title="Guest Policy" subtitle="Everything to know before you book — eligibility, deposits, conduct, and what happens if something goes wrong." />

      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4">
          <Section title="1. Who Can Rent">
            <Card title="Eligibility">
              <ul className="space-y-1.5 list-disc list-inside">
                <li>21 years or older</li>
                <li>Valid driving licence, held for 1+ year</li>
                <li>Completed KYC verification via DigiLocker/Aadhaar — mandatory before your first booking</li>
              </ul>
            </Card>
          </Section>

          <Section title="2. Booking & Payment">
            <Card title="How it works">
              <p>Search by city and dates, choose a car, and pay securely via UPI, card, or wallet. Your security deposit is held in escrow alongside the trip cost and released separately after a clean return.</p>
            </Card>
            <Card title="Sticky search dates">
              <p>Dates you pick on the homepage or search page carry over to whichever car you click into — no re-entering them per car.</p>
            </Card>
            <Card title="Cancellation">
              <p>Free cancellation up to 24 hours before pickup. If a host cancels a confirmed booking on you, you get a full refund instantly plus priority rebooking help from our support team.</p>
            </Card>
          </Section>

          <Section title="3. Security Deposit & Protection Plans">
            <Card title="Deposit">
              <p>Refundable, released within 24-48 hours after a clean vehicle return. Lessee-caused damage is deducted from it first — see Section 6 for the full damage process.</p>
            </Card>
            <Card title="Protection Plans">
              <p>Basic (free), Standard (+₹149/day), and Premium (+₹349/day) only change your deposit-hold amount and support priority — they don't transfer any damage liability away from you. See our full <a href="/insurance" className="text-amber-600 underline">Insurance &amp; Damage Policy</a>.</p>
            </Card>
          </Section>

          <Section title="4. Picking Up & Returning the Car">
            <Card title="Trip-start and trip-end handover code">
              <p>
                When your trip starts, the host is shown a 4-digit code — you'll need it from them to mark the trip
                complete when you return the car. This protects both of you from disputes about whether a handover
                actually happened in person.
              </p>
            </Card>
            <Card title="Fuel Policy">
              <p>Return the car with the same fuel level you received it at. Shortage is charged at ₹100 per 10km-equivalent; excess fuel is non-refundable.</p>
            </Card>
            <Card title="Doorstep delivery">
              <p>Available on some listings at the host's discretion, for an additional fee shown at checkout — not every car offers it.</p>
            </Card>
          </Section>

          <Section title="5. Trip Conduct — Permitted Territory & Usage">
            <Card title="Permitted Territory">
              <p>The entire territory of India, excluding Ladakh and foreign countries including but not limited to Nepal, Bhutan, Bangladesh, and Pakistan, unless separately agreed in writing with the host.</p>
            </Card>
            <Card title="Strict Usage Policy">
              <ul className="space-y-1.5 list-disc list-inside">
                <li>Personal use only — commercial use, racing, rallying, and off-roading are prohibited</li>
                <li>The vehicle must be driven ONLY by the verified lessee named on the booking</li>
                <li>Handing the vehicle to any third party — friends, family, or unregistered drivers — is strictly prohibited and voids insurance-relevant driver verification</li>
              </ul>
            </Card>
            <Card title="Don't tamper with the dashcam or telematics device">
              <p>Obstructing, unplugging, or tampering with the dashcam or OBD/GPS port is treated as a malicious attempt to hide vehicle misuse.</p>
            </Card>
          </Section>

          <Section title="6. Damage, Penalties & Liability">
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-4">
              <p className="font-bold text-gray-900 mb-1">⚠️ You are financially responsible for damage during your trip.</p>
              <p className="text-sm text-gray-700">Costs are deducted from your security deposit first; anything beyond the deposit is recovered directly by the host. ZiyamSelfDrive doesn't provide vehicle damage insurance — see our full <a href="/insurance" className="text-amber-700 underline font-semibold">Insurance &amp; Damage Policy</a>.</p>
            </div>
            <Card title="Schedule of penalties">
              <p className="mb-3">These are agreed pre-estimates of damages and costs for specific violations, payable immediately upon demand:</p>
              <div className="space-y-1.5">
                {PENALTY_SCHEDULE.map(([label, amount]) => (
                  <div key={label} className="flex justify-between text-xs gap-4">
                    <span>{label}</span>
                    <span className="font-semibold text-gray-800 whitespace-nowrap">{amount}</span>
                  </div>
                ))}
              </div>
            </Card>
            <Card title="Traffic violations & tolls">
              <p>You're responsible for any traffic violations, challans, tolls, or fines incurred during your rental period.</p>
            </Card>
          </Section>

          <Section title="7. Support">
            <Card title="24/7 roadside assistance">
              <p>Included on every trip regardless of protection plan — breakdowns and lockouts are covered.</p>
            </Card>
            <Card title="Message your host">
              <p>Coordinate pickup details or ask questions directly from your trip page once your booking is confirmed.</p>
            </Card>
            <Card title="Wash service add-on">
              <p>Request a wash for ₹349 during or after an active trip — it's auto-assigned to an on-duty agent.</p>
            </Card>
          </Section>

          <Section title="8. Referrals">
            <Card title="Earn ₹500 per friend you refer">
              <p>Share your referral code — you get ₹500 in platform credit once the person you referred completes their first trip.</p>
            </Card>
          </Section>

          <div className="bg-gray-950 text-white rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="font-bold mb-1">Ready to book?</h3>
              <p className="text-sm text-gray-400">See our full <a href="/terms" className="text-amber-400 hover:underline">Terms &amp; Conditions</a> or browse cars now.</p>
            </div>
            <a href="/cars" className="btn-gradient text-white font-bold px-6 py-3 rounded-xl transition text-sm whitespace-nowrap">
              Browse Cars
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
