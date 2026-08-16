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

export default function HostPolicyPage() {
  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Navbar />
      <PageHero eyebrow="For Hosts" title="Host Policy" subtitle="Everything you need to know before and after listing your car — no fine print surprises." />

      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4">
          <Section title="1. Vehicle Eligibility">
            <Card title="To list a car, it must:">
              <ul className="space-y-1.5 list-disc list-inside">
                <li>Be under 6 years old from date of manufacture, with under 50,000 km on the odometer</li>
                <li>Be roadworthy, mechanically sound, and hygiene-compliant</li>
                <li>Carry a valid RC in the host's name (or with written authorization to list)</li>
                <li>Carry an <strong>active comprehensive insurance policy</strong> — not just third-party — verified before the listing goes live</li>
                <li>Have a valid Pollution Under Control (PUC) certificate</li>
              </ul>
            </Card>
            <Card title="Documents you'll upload">
              <p>RC (front &amp; back), PUC certificate, and insurance policy — as photos or scans, verified by our team. A listing shows a "Verified" badge once all three are approved.</p>
            </Card>
          </Section>

          <Section title="2. Two Ways to Host">
            <Card title="Self-Hosted">
              <p>You manage your own car — set your price (within the market-rate band), handle handovers, and get paid directly. Full control, full involvement.</p>
            </Card>
            <Card title="Fleet-Managed">
              <p>
                Opt in and a Ziyam fleet operator handles guest handovers, cleaning, and day-to-day logistics for you —
                useful if you own multiple vehicles or don't want to manage bookings yourself. Fleet-managed cars go
                through a short audit + telematics install before going live, and follow the payout timeline in
                Section 3 below.
              </p>
              <p>A car listed with a fleet operator stays exclusively on ZiyamSelfDrive's own platform unless you and your fleet operator separately agree to multi-platform syndication.</p>
            </Card>
          </Section>

          <Section title="3. Payouts">
            <Card title="Revenue split">
              <p>Hosts keep <strong>70%</strong> of every booking; ZiyamSelfDrive's commission is <strong>30%</strong>. This split is the same whether you're self-hosted or fleet-managed.</p>
            </Card>
            <Card title="N+1 payout timeline">
              <ul className="space-y-1.5 list-disc list-inside">
                <li><strong>Self-hosted:</strong> paid 24–48 hours after trip completion, or bundled into a weekly payout if you opt in from your dashboard</li>
                <li><strong>Fleet-managed:</strong> paid within 1 business day of your fleet operator confirming they've received a clear payout from the platform</li>
              </ul>
              <p className="text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mt-2">
                No advance payouts are made without a cleared, confirmed receipt — this protects both hosts and the platform from chargebacks.
              </p>
            </Card>
            <Card title="Bank details & payout eligibility">
              <p>Add your bank account (verified via a real penny-drop check) from your dashboard. Payouts won't release to an unverified account.</p>
            </Card>
          </Section>

          <Section title="4. Insurance & Damage — read this carefully">
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-4">
              <p className="font-bold text-gray-900 mb-1">⚠️ ZiyamSelfDrive does not provide vehicle damage insurance.</p>
              <p className="text-sm text-gray-700">We're a marketplace, not an insurer. Your own comprehensive insurance policy is the primary coverage for your vehicle — see the full breakdown on our <a href="/insurance" className="text-amber-700 underline font-semibold">Insurance &amp; Damage Policy</a> page.</p>
            </div>
            <Card title="In short">
              <ul className="space-y-1.5 list-disc list-inside">
                <li>Renter-caused damage is deducted from the security deposit first</li>
                <li>Costs beyond the deposit are the host's responsibility to recover from the renter directly</li>
                <li>ZiyamSelfDrive assists with claim coordination and will try to cover up to ₹20,000 of a claim</li>
                <li>24/7 roadside assistance is included for breakdowns and abandoned-vehicle recovery, regardless of protection plan</li>
              </ul>
            </Card>
          </Section>

          <Section title="5. Handover Checklists">
            <Card title="Trip-start and trip-end verification">
              <p>
                Every trip uses a 4-digit handover code — shown only to the host, entered only by the guest — to confirm
                both parties actually met for the handover before a trip can be marked complete. This protects both
                sides from disputes about whether a return actually happened.
              </p>
              <p>We strongly recommend photographing the vehicle's condition at both pickup and drop-off; timestamped photos are the strongest evidence in any damage dispute.</p>
            </Card>
          </Section>

          <Section title="6. Pausing & Availability">
            <Card title="Pause anytime for maintenance or personal use">
              <p>Block off dates from your dashboard's availability calendar — renters won't be able to book overlapping dates. There's no penalty for reasonable, occasional pausing.</p>
              <p>Repeated last-minute cancellations of confirmed bookings may result in a review of your listing, since it directly affects guest trust in the platform.</p>
            </Card>
          </Section>

          <Section title="7. Prohibited Use">
            <Card title="Not permitted, by either party">
              <ul className="space-y-1.5 list-disc list-inside">
                <li>Commercial use, racing, rallying, or off-roading</li>
                <li>Sub-leasing the vehicle to anyone other than the verified guest on the booking</li>
                <li>Circumventing the platform — arranging a rental directly with a guest to avoid platform fees voids KYC protection, insurance-relevant driver verification, and platform support for that trip</li>
              </ul>
            </Card>
          </Section>

          <Section title="8. Referrals">
            <Card title="Earn ₹500 per host you refer">
              <p>Share your referral code — you get ₹500 in platform credit once the person you referred completes their first trip.</p>
            </Card>
          </Section>

          <div className="bg-gray-950 text-white rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="font-bold mb-1">Questions about hosting?</h3>
              <p className="text-sm text-gray-400">Check the <a href="/host/faq" className="text-amber-400 hover:underline">Host FAQ</a> or reach our support team.</p>
            </div>
            <a href="/host/onboarding" className="btn-gradient text-white font-bold px-6 py-3 rounded-xl transition text-sm whitespace-nowrap">
              Start Hosting
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
