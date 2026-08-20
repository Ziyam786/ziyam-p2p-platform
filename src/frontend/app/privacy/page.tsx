import React from 'react';
import LegalPage from '../../components/LegalPage';
import { COMPANY } from '../../lib/companyInfo';

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated="18 August 2026"
      detailsAnchor="policy"
      detailsLabel="Full Privacy Policy"
      summary={[
        { icon: '📋', title: 'What we collect', body: 'Account, KYC, booking, payment, device, and communication data — see the full policy for the exact list.' },
        { icon: '🎯', title: 'How we use it', body: 'Delivering the service, verifying identity, preventing fraud, legal compliance, and — with consent — marketing.' },
        { icon: '📍', title: 'Location & telematics', body: 'Only vehicles fitted with our IoT hardware can be located or remotely locked/unlocked — not every listing.' },
        { icon: '⚖️', title: 'Your rights', body: 'Access, correct, delete your data, withdraw consent, or lodge a complaint with the Data Protection Board of India.' },
        { icon: '🔒', title: 'Security & retention', body: 'Encryption and access controls; data kept only as long as needed, then deleted or anonymized.' },
        { icon: '✉️', title: 'Grievance officer', body: 'Complaints acknowledged within 48 hours, resolved within 30 days wherever possible.' },
      ]}
      contact={{
        body: [
          `${COMPANY.team[0].name}  ·  ${COMPANY.email}  ·  ${COMPANY.phone}`,
          'Complaints are acknowledged within 48 hours and, wherever possible, resolved within 30 days, in accordance with applicable law.',
        ],
      }}
      sections={[
        {
          heading: '1. Overview',
          body: [
            `${COMPANY.legalName}, incorporated under the Companies Act, 2013 and registered at ${COMPANY.address}, operates ${COMPANY.brandFull} — a technology platform for discovering, reserving, and renting self-drive vehicles (CIN ${COMPANY.cin}). ${COMPANY.scopeNote}`,
            'This Privacy Policy explains how we collect, use, store, share, and protect your personal data when you use the platform, in accordance with the Information Technology Act, 2000 and the Digital Personal Data Protection Act, 2023. By registering on or using the platform, you consent to the data practices described here.',
          ],
        },
        {
          heading: '2. Information We Collect',
          body: [
            'Account data: full name, date of birth, gender, email, phone number, address, and login credentials.',
            'Identity verification: you may complete Aadhaar OTP eKYC (UIDAI, via Sandbox.co.in). In that case we send your 12-digit Aadhaar number only to Sandbox to generate and verify the OTP; we do not store the Aadhaar number. Alternatively you may upload a photo of your Aadhaar, PAN, voter ID, or passport, plus a photo of your driving licence. Those documents (and optional liveness selfies) are checked by Arya.ai (Aurionpro Solutions) for extraction, image quality, liveness, deepfake detection, and face match. When the document is an Aadhaar card, Arya also produces a masked copy (Aadhaar number redacted) if we keep an image for review. Vehicle registration certificates uploaded by hosts are likewise checked by Arya. Document URLs submitted for verification are scanned with Arya cyber-threat detection before we fetch them. We store verification outcomes (pass/fail, extracted name, match flags) rather than unmasked ID images. DigiLocker remains an optional identity path where configured.',
            'Extended verification: where you sign a rental agreement, we capture your signature; a liveness selfie and an alternate contact number may also be collected as part of profile verification.',
            'Booking information: reservation dates, pickup and drop-off details, protection plan selection, co-driver details (if added), and trip history.',
            'Vehicle location & telematics: for the subset of vehicles fitted with our IoT hardware, we can retrieve on-demand GPS location, odometer, and fuel level, and issue remote lock/unlock commands during an active trip — used for keyless access, safety, and theft recovery. Cars without this hardware are not remotely tracked.',
            'Payment & payout information: billing details and transaction records processed through our payment partner, PayU — we do not store your full card number. Hosts additionally provide bank account, IFSC, and payout details, verified with a penny-drop check before payouts are enabled.',
            'Device information: device ID, IP address, browser, and operating system.',
            'Communications: support conversations, in-app messages exchanged with your host or guest about a specific booking, reviews, and AI chat-support transcripts.',
            'Referral & wallet data: your referral code, who referred you (if anyone), and your platform credits balance.',
          ],
        },
        {
          heading: '3. How We Collect Information',
          body: [
            'We collect information directly from you during registration, KYC verification, and booking; automatically through the app and, where fitted, vehicle telematics hardware; and from our verification and payment partners — Sandbox.co.in for Aadhaar OTP eKYC, Arya.ai for document extraction, Aadhaar masking, liveness, vehicle-RC, and URL security checks, DigiLocker (where you choose that path), and PayU for payments. Where legally required, we may also receive information from government databases, insurers, or law enforcement.',
          ],
        },
        {
          heading: '4. How We Use Your Data',
          body: [
            'We use your data to deliver the service — account creation, bookings, and customer support; to verify identity and prevent fraud and theft; to keep you informed with booking, security, and policy communications; to comply with legal, tax, and regulatory obligations; and, with your consent, for marketing communications about products and offers.',
          ],
        },
        {
          heading: '5. Legal Basis for Processing',
          body: [
            'We process personal data on the basis of your consent, performance of our contract with you, compliance with legal obligations, and certain legitimate uses permitted under Section 7 of the Digital Personal Data Protection Act, 2023, such as fraud prevention and safety.',
          ],
        },
        {
          heading: '6. Vehicle Location & Telematics',
          body: [
            'Only vehicles fitted with our telematics/IoT hardware can be located or remotely locked and unlocked — not every listing carries this equipment. Where fitted, it is used to support keyless access during your trip and to help recover a vehicle in the event of theft or an unreported breakdown. This is vehicle-level telemetry rather than continuous tracking of your personal device.',
          ],
        },
        {
          heading: '7. Cookies',
          body: [
            'We use a single, essential session cookie to keep you signed in, Mixpanel analytics and session replay on the renter site, plus other strictly operational cookies. We do not use advertising trackers or sell data to advertisers. See our full Cookie Policy for details.',
          ],
        },
        {
          heading: '8. How We Share Your Information',
          body: [
            'We share information with the partners needed to run the platform: PayU for payments; Sandbox.co.in for Aadhaar OTP eKYC; Arya.ai (Aurionpro) for KYC document extraction, Aadhaar masking, image-quality, liveness, deepfake detection, face match, vehicle RC verification, and URL cyber-threat checks; DigiLocker where you opt into that identity path; Mixpanel for product analytics and session replay on the renter site; our telematics hardware vendor; fleet operators (only for cars under their management); insurers; and cloud/infrastructure providers. Where legally required, we may share information with government authorities, regulators, courts, or law enforcement. We do not sell personal data.',
          ],
        },
        {
          heading: '9. International Data Transfers',
          body: [
            'Your personal data may be processed or stored by service providers operating outside India. Such transfers are subject to appropriate safeguards and shall not be made to any country restricted by the Central Government under Section 16 of the Digital Personal Data Protection Act, 2023.',
          ],
        },
        {
          heading: '10. Data Retention',
          body: [
            'We retain personal data only as long as necessary to provide the service, comply with legal obligations, resolve disputes, enforce our agreements, and prevent fraud. Once retention is no longer required, data is deleted, anonymized, or securely archived.',
          ],
        },
        {
          heading: '11. Data Security',
          body: [
            'We use encryption, access controls, and secure cloud infrastructure to protect your data, along with monitoring and regular vulnerability assessments — though no system can be guaranteed completely secure.',
          ],
        },
        {
          heading: '12. Data Breach Response',
          body: [
            'In the event of a personal data breach, we investigate and contain the incident, and notify the Data Protection Board of India and affected users within the timelines prescribed under the Digital Personal Data Protection Act, 2023 and the Information Technology Act, 2000.',
          ],
        },
        {
          heading: '13. Your Rights',
          body: [
            'Subject to applicable law, you may request to access, correct, or update your personal data, withdraw consent, request deletion, nominate another individual to exercise your rights, seek grievance redressal, and lodge a complaint with the Data Protection Board of India. Requests can be submitted using the contact details below.',
          ],
        },
        {
          heading: '14. Eligibility & Minors',
          body: [
            'The platform is intended only for individuals who are at least 18 years old. Persons under 18 may not create an account or rent a vehicle. If we learn that a minor\'s personal data has been collected unlawfully, we will delete it.',
          ],
        },
        {
          heading: '15. Third-Party Links',
          body: ['The platform may link to third-party websites or services. We are not responsible for their privacy practices, and you should review their policies independently.'],
        },
        {
          heading: '16. Changes to This Policy',
          body: ['We may amend this Privacy Policy at any time. Updated versions take effect upon publication on the platform.'],
        },
        {
          heading: '17. Governing Law & Jurisdiction',
          body: [`This Privacy Policy is governed by Indian law. Disputes arising from or relating to it are subject to the exclusive jurisdiction of the ${COMPANY.jurisdiction}.`],
        },
      ]}
    />
  );
}
