import React from 'react';
import LegalPage from '../../components/LegalPage';
import { COMPANY } from '../../lib/companyInfo';

export default function RefundPolicyPage() {
  return (
    <LegalPage
      title="Refund & Cancellation Policy"
      updated="4 June 2026"
      sections={[
        {
          heading: '1. Introduction',
          body: [
            `This policy governs cancellations, refunds, security deposits, and transactions across all ${COMPANY.brand} platforms. ${COMPANY.legalName}, ${COMPANY.address}. By booking or using our services, you agree to comply with this policy alongside our Terms & Conditions and Privacy Policy.`,
          ],
        },
        {
          heading: '2. General Principles',
          body: [
            'Cancellation and refund eligibility depends on time until trip start, vehicle allocation status, whether the trip has commenced, the nature of the cancellation, policy compliance, and any outstanding dues. Refunds are not available where expressly prohibited by this Policy or applicable law. The Company reserves the right to refuse refunds in cases of fraud, abuse, chargeback abuse, identity fraud, or policy violations.',
          ],
        },
        {
          heading: '3. User-Initiated Cancellations',
          body: [
            'More than 24 hours before trip start: 100% of the booking amount is refunded, minus convenience fees, gateway charges, platform fees, and government taxes already remitted.',
            'Between 6–24 hours before trip start: up to 25% of the booking amount may be retained as a cancellation charge; the remainder is refunded.',
            'Within 6 hours before trip start: up to 50% of the booking amount may be retained; the remainder is refunded.',
            'After the scheduled trip start: no refund — the entire booking amount may be forfeited.',
          ],
        },
        {
          heading: '4. No-Show Policy',
          body: [
            'A user is considered a no-show if they fail to collect the vehicle within the pickup window, don\'t present required documents, don\'t complete verification, or become unreachable. The booking may be automatically cancelled with no refund payable.',
          ],
        },
        {
          heading: '5. Company-Initiated Cancellations',
          body: [
            'We may cancel due to vehicle unavailability, operational constraints, safety concerns, fraud detection, force majeure, regulatory restrictions, or verification failure. If the cancellation is solely attributable to the Company, you receive a full refund with no cancellation fee — unless the cancellation results from user misconduct, documentation issues, or policy violations.',
          ],
        },
        {
          heading: '6. Booking Modifications & Early Return',
          body: [
            'Subject to availability, you may request trip extensions, reductions, pickup changes, or vehicle changes; modification charges may apply. Voluntary early returns receive no refund for unused duration, except at the Company\'s discretion.',
          ],
        },
        {
          heading: '7. Security Deposit',
          body: [
            'Refundable deposits may be collected before trip commencement. Permissible deductions include traffic violations, tolls, parking charges, fuel shortages, cleaning charges, damage repair, missing accessories, late return charges, recovery expenses, and legal expenses arising from user misconduct.',
            'Subject to inspection and verification, deposits are ordinarily processed within 7–21 business days after trip completion — this may extend if traffic challans are pending, damage assessment is incomplete, or a claim/investigation is ongoing.',
          ],
        },
        {
          heading: '8. Failed or Duplicate Payments',
          body: ['When a payment is deducted but the booking is unconfirmed, or a duplicate/technical error causes overpayment, the Company verifies the transaction and processes eligible refunds. Transaction evidence may be required.'],
        },
        {
          heading: '9. Non-Refundable Charges',
          body: [
            'Convenience fees, platform fees, verification charges, documentation charges, membership fees, consumed subscription fees, deposited government taxes, third-party charges, activated insurance charges, late payment charges, and penalties/fines are generally non-refundable.',
          ],
        },
        {
          heading: '10. Refund Processing Timelines',
          body: [
            'UPI: 3–7 business days  ·  Debit card: 5–10 business days  ·  Credit card: 5–15 business days  ·  Net banking: 5–10 business days  ·  Wallets: 3–10 business days.',
            'Refunds are made to the original payment source wherever feasible, in accordance with RBI guidelines. Actual credit timelines depend on your bank/payment provider.',
          ],
        },
        {
          heading: '11. Chargebacks & Disputes',
          body: ['Please contact us before initiating a chargeback. Fraudulent or unjustified chargebacks may result in account suspension, booking restrictions, and recovery proceedings.'],
        },
        {
          heading: '12. Consumer Rights',
          body: ['Nothing in this Policy restricts, waives, or limits any rights available to consumers under the Consumer Protection Act 2019, the Consumer Protection (E-Commerce) Rules 2020, or other applicable law.'],
        },
        {
          heading: '13. Grievance Redressal',
          body: [
            `${COMPANY.legalName}  ·  ${COMPANY.address}`,
            `Email: ${COMPANY.email}  ·  Phone: ${COMPANY.phone}`,
            'Grievances are acknowledged within 48 hours and resolved within legally prescribed timelines.',
          ],
        },
        {
          heading: '14. Governing Law & Jurisdiction',
          body: [`This Policy is governed by Indian law. Subject to consumer law provisions, the ${COMPANY.jurisdiction} have exclusive dispute jurisdiction.`],
        },
      ]}
    />
  );
}
