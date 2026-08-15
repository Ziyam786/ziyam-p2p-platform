import React from 'react';
import LegalPage from '../../components/LegalPage';

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms & Conditions"
      updated="August 2026"
      sections={[
        {
          heading: '1. Acceptance of Terms',
          body: [
            'By creating an account or using ZiyamSelfDrive ("Ziyam", "we", "us"), operated by Eightlines, you agree to these Terms & Conditions and our Privacy Policy.',
          ],
        },
        {
          heading: '2. Eligibility',
          body: [
            'Renters must be at least 21 years old and hold a valid driving licence for a minimum of 1 year. Hosts must be at least 18 years old and complete identity verification (KYC) before listing a vehicle.',
          ],
        },
        {
          heading: '3. Bookings & Cancellations',
          body: [
            'A booking is confirmed once payment is authorized. Free cancellation is available up to 24 hours before the scheduled pickup time; cancellations after this window may be subject to a partial charge.',
          ],
        },
        {
          heading: '4. Payments & the 70/30 Split',
          body: [
            'Renters pay the full trip fare plus a platform fee and refundable security deposit at booking. Hosts receive 70% of the base fare; Ziyam retains 30% to cover payment processing, insurance, marketing, and platform operations.',
            'Host payouts are released on an N+1 schedule: funds are held in escrow until the trip is marked complete, then settled to the host\'s linked payout account after the configured settlement window.',
          ],
        },
        {
          heading: '5. Vehicle Condition & Insurance',
          body: [
            'Hosts warrant that listed vehicles are roadworthy, insured, and accurately described. Basic third-party insurance is included on every trip; renters may upgrade to Standard or Premium protection plans at checkout.',
          ],
        },
        {
          heading: '6. Prohibited Use',
          body: [
            'Vehicles may not be used for commercial ride-hailing, sub-letting, off-roading (unless the listing explicitly permits it), or any illegal activity. Violations may result in account suspension and forfeiture of the security deposit.',
          ],
        },
        {
          heading: '7. Limitation of Liability',
          body: [
            'Ziyam acts as a marketplace connecting renters and hosts and is not a party to the rental agreement between them. Except as required by law, Ziyam\'s liability is limited to fees paid for the specific booking in dispute.',
          ],
        },
        {
          heading: '8. Governing Law',
          body: ['These Terms are governed by the laws of India, with exclusive jurisdiction in the courts of Bengaluru, Karnataka.'],
        },
      ]}
    />
  );
}
