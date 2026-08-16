import React from 'react';
import LegalPage from '../../components/LegalPage';
import { COMPANY } from '../../lib/companyInfo';

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated="4 June 2026"
      sections={[
        {
          heading: '1. Overview',
          body: [
            `${COMPANY.legalName}, Bengaluru, Karnataka, processes personal data under the Information Technology Act, 2000 and the Digital Personal Data Protection Act, 2023.`,
          ],
        },
        {
          heading: '2. What We Collect',
          body: [
            'Account data: name, date of birth, email, phone, address, and login credentials.',
            'Identity verification: driving license, Aadhaar (masked only), passport, PAN, other government IDs, and facial verification records.',
            'Booking information: reservation details, locations, rental duration, and trip history.',
            'Location & telematics: real-time GPS, speed, acceleration, braking patterns, fuel consumption, and driving behaviour metrics. Vehicles may be monitored in real time during the rental period for safety, theft prevention, legal, and operational purposes.',
            'Payment information: billing address and transaction records — card details are not stored by the Company.',
            'Device information: device ID, IP address, browser, and operating system.',
            'Communications: support interactions, call recordings, chats, feedback, and reviews.',
          ],
        },
        {
          heading: '3. How We Use Your Data',
          body: [
            'Service delivery, identity verification, safety and theft prevention, legal compliance, business operations, and marketing (with consent).',
          ],
        },
        {
          heading: '4. Your Rights',
          body: [
            'You may request to access, correct, update, or delete your personal data, withdraw consent, and lodge complaints with India\'s Data Protection Board.',
          ],
        },
        {
          heading: '5. Data Security & Breach Response',
          body: [
            'We use encryption, access controls, and secure infrastructure — though no system can be guaranteed completely secure. Data breaches trigger investigation, regulator notification, and affected-user notification per legal timelines.',
          ],
        },
        {
          heading: '6. Cookies',
          body: ['We use cookies for authentication (session tokens) and basic analytics.'],
        },
        {
          heading: '7. Grievance Officer',
          body: [
            `Syed Fardeen  ·  ${COMPANY.email}  ·  ${COMPANY.phone}`,
            'Acknowledgment within 48 hours; resolution within 30 days.',
          ],
        },
      ]}
    />
  );
}
