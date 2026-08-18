import React from 'react';
import LegalPage from '../../components/LegalPage';
import { COMPANY } from '../../lib/companyInfo';

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms & Conditions"
      updated="4 June 2026"
      sections={[
        {
          heading: '1. Company Details',
          body: [
            `${COMPANY.legalName} operates as a technology-enabled vehicle rental platform under India's Companies Act, 2013, facilitating self-drive rentals and related mobility services (CIN ${COMPANY.cin}). ${COMPANY.scopeNote}`,
          ],
        },
        {
          heading: '2. Eligibility Requirements',
          body: [
            'Users must be at least 18 years old (or higher if legally required for the vehicle category booked), hold a valid government-issued identity proof and a valid driving license appropriate for the booked vehicle, and have an accepted payment method on file.',
            'The Company reserves discretionary authority to verify credentials and to refuse or suspend registrations.',
          ],
        },
        {
          heading: '3. Account Registration',
          body: [
            'Users creating accounts must provide accurate, complete, and current information, maintain confidential login credentials, and accept responsibility for all account activity. The Company disclaims liability for unauthorized access resulting from user negligence.',
          ],
        },
        {
          heading: '4. Services Offered',
          body: [
            'The platform enables browsing, reserving, and renting vehicles for self-drive purposes subject to availability. The Company reserves the right to refuse bookings, substitute vehicles with comparable models, modify offerings, or discontinue services without advance notice.',
          ],
        },
        {
          heading: '5. Booking & Payment Terms',
          body: [
            'Charges include rental fees, security deposits, taxes, tolls, penalties, late fees, and convenience charges. Pricing varies by booking duration, vehicle category, demand and availability, location, and seasonal factors.',
            'The Company may hold refundable security deposits and recover unpaid amounts from either the deposit or the registered payment method.',
          ],
        },
        {
          heading: '6. Vehicle Usage Conditions',
          body: [
            'Required: responsible and lawful vehicle operation, valid driving documents during the rental, authorization of all drivers, and return of the vehicle in the condition received (allowing reasonable wear).',
            'Prohibited: driving under the influence of alcohol, narcotics, or other substances; illegal activity; racing, rallying, stunts, speed testing, or unauthorized commercial use; exceeding weight capacity; tampering with GPS, odometer, or vehicle systems; and permitting unauthorized operators.',
            'Users bear sole liability for traffic violations, towing charges, parking violations, and penalties incurred during their booking period.',
          ],
        },
        {
          heading: '7. Pick-up & Return Procedures',
          body: [
            'Vehicles must be collected and returned at designated locations within scheduled times. Delayed returns incur additional hourly or daily charges. Extended non-return may result in vehicle repossession, authority reporting, penalties, and legal action.',
            'Users must inspect vehicles before departure and report visible damage promptly.',
          ],
        },
        {
          heading: '8. Damage, Accidents & Liability',
          body: [
            'Users must immediately notify the Company of accidents, theft, damage, breakdowns, or police involvement and cooperate with insurance providers and authorities.',
            'Users may be held liable for damages from negligence or misuse, insurance deductibles, uninsured losses, repair costs, and lost accessories or documents. The Company may recover repair and associated expenses from users.',
          ],
        },
        {
          heading: '9. Insurance Coverage',
          body: [
            'The Company does not itself provide vehicle damage insurance and is not an insurer — ZiyamSelfDrive is a peer-to-peer marketplace connecting hosts and guests. Every listed vehicle must carry a host-arranged, host-paid comprehensive (not merely third-party) insurance policy, verified at listing time. Coverage under that policy is subject to the issuing insurer\'s own terms, and typically excludes intoxicated driving, reckless operation, unauthorized use, legal violations, and use outside permitted geographic areas. Users remain responsible for any liabilities excluded from the host\'s policy. See our full Insurance & Damage Policy for the complete damage-recovery process, including the Company\'s own limited goodwill contribution toward eligible claims.',
          ],
        },
        {
          heading: '10. Cancellation & Refund Policy',
          body: [
            'Cancellation eligibility depends on timing, booking type, payment method, and applicable deductions. Refund timelines vary by banking partner and payment gateway. See our full Refund & Cancellation Policy for details.',
          ],
        },
        {
          heading: '11. User Content & Reviews',
          body: [
            'Users may post reviews and feedback but must not upload content that is defamatory, abusive, obscene, fraudulent, or unlawful, or that infringes intellectual property or contains malware. The Company may remove or moderate content at its discretion.',
          ],
        },
        {
          heading: '12. Intellectual Property Rights',
          body: [
            'All platform intellectual property — including trademarks, logos, designs, software, and branding — belongs to or is licensed to the Company. Users may not copy, reproduce, modify, distribute, reverse engineer, or commercially exploit content without written permission.',
          ],
        },
        {
          heading: '13. Privacy & Data',
          body: [
            'The Company collects, processes, and stores user information per its Privacy Policy and applicable law. By using the platform, users consent to data collection, including GPS tracking, telematics, and usage analytics, for operational, safety, and security purposes.',
          ],
        },
        {
          heading: '14. Suspension & Termination',
          body: [
            'The Company may suspend or terminate accounts without notice for Terms violations, fraudulent activity, vehicle misuse, non-payment, or unlawful conduct. Termination does not eliminate accrued liabilities or payment obligations.',
          ],
        },
        {
          heading: '15. Disclaimer of Warranties',
          body: [
            'Services are provided "as is" and "as available." The Company does not guarantee uninterrupted, error-free, or continuous availability and disclaims all express or implied warranties, including fitness for a particular purpose and merchantability.',
          ],
        },
        {
          heading: '16. Limitation of Liability',
          body: [
            'The Company is not liable for indirect or consequential damages, lost profits or data, delays, interruptions, third-party acts, or personal belongings left in vehicles. Aggregate liability shall not exceed the amount paid for the relevant booking.',
          ],
        },
        {
          heading: '17. Indemnification',
          body: [
            'Users indemnify the Company, its directors, employees, affiliates, and partners against claims, liabilities, losses, damages, penalties, and expenses resulting from breaches of these Terms, vehicle misuse, legal violations, or third-party claims arising from user conduct.',
          ],
        },
        {
          heading: '18. Force Majeure',
          body: [
            'The Company is not liable for performance failures caused by uncontrollable events including natural disasters, strikes, governmental restrictions, pandemics, technical failures, riots, or acts of God.',
          ],
        },
        {
          heading: '19. Governing Law & Jurisdiction',
          body: [`These Terms are governed by Indian law. Exclusive jurisdiction rests with the ${COMPANY.jurisdiction} for disputes arising from or relating to these Terms.`],
        },
        {
          heading: '20. Dispute Resolution',
          body: [
            `Parties first attempt amicable resolution through discussion. If unresolved within 30 days, disputes proceed to arbitration under the Arbitration and Conciliation Act, 1996. The seat and venue of arbitration shall be at ${COMPANY.legalName}, Bengaluru. Proceedings are conducted in English.`,
          ],
        },
        {
          heading: '21. Modification of Terms',
          body: ['The Company may amend these Terms at any time. Continued use of the platform constitutes acceptance of the revisions.'],
        },
        {
          heading: '22. Severability',
          body: ['If any provision is deemed invalid or unenforceable, the remaining provisions continue in full effect.'],
        },
        {
          heading: '23. Contact Information',
          body: [
            `${COMPANY.legalName} (${COMPANY.brand} Mobility Services)`,
            `Email: ${COMPANY.email}  ·  Phone: ${COMPANY.phone}`,
            `Registered Address: ${COMPANY.address}`,
          ],
        },
      ]}
    />
  );
}
