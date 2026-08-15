import React from 'react';
import LegalPage from '../../components/LegalPage';

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated="August 2026"
      sections={[
        {
          heading: '1. What We Collect',
          body: [
            'Account details (name, email, phone number), identity documents submitted for KYC verification, booking and payment history, and vehicle telemetry (for keyless-enabled cars during active trips).',
          ],
        },
        {
          heading: '2. How We Use Your Data',
          body: [
            'To operate bookings and payouts, verify identity via our KYC provider, process payments through our payment gateway partner, prevent fraud, and improve the platform.',
          ],
        },
        {
          heading: '3. Data Sharing',
          body: [
            'We share only what\'s necessary with our payment gateway, KYC provider (DigiLocker), and telematics/IoT partners to complete a booking. We never sell personal data to third parties.',
          ],
        },
        {
          heading: '4. Data Retention',
          body: ['Booking and payout records are retained as required by Indian tax and financial regulations. KYC documents are stored securely and only accessible for verification purposes.'],
        },
        {
          heading: '5. Your Rights',
          body: ['You may request a copy of your data or account deletion at any time by contacting privacy@ziyam.in, subject to regulatory retention requirements for financial records.'],
        },
        {
          heading: '6. Cookies',
          body: ['We use cookies for authentication (session tokens) and basic analytics. See our Cookie Policy for details.'],
        },
        {
          heading: '7. Contact',
          body: ['Questions about this policy can be directed to privacy@ziyam.in.'],
        },
      ]}
    />
  );
}
