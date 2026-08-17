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
            `This Policy governs cancellations, refunds, security deposits, and related transactions across all ${COMPANY.brand} platforms, operated by ${COMPANY.legalName}, ${COMPANY.address}. It should be read together with our Terms & Conditions and Privacy Policy. By booking or using our services, you agree to be bound by this Policy.`,
          ],
        },
        {
          heading: '2. General Principles',
          body: [
            'Cancellation and refund eligibility depends on time remaining before the trip start, vehicle allocation status, whether the trip has commenced, the nature of the cancellation, your compliance with our policies, and any outstanding dues. Refunds are not available where expressly prohibited by this Policy or applicable law, and we reserve the right to refuse a refund request involving fraud, abuse, chargeback abuse, identity fraud, or policy violations.',
          ],
        },
        {
          heading: '3. User-Initiated Cancellations',
          body: [
            'More than 24 hours before trip start: 100% of the booking amount is refunded, minus convenience fees, gateway charges, platform fees, and government taxes already remitted.',
            'Between 6 and 24 hours before trip start: up to 25% of the booking amount may be retained as a cancellation charge; the remainder is refunded.',
            'Within 6 hours of trip start: up to 50% of the booking amount may be retained; the remainder is refunded.',
            'After the scheduled trip start: no refund — the entire booking amount may be forfeited.',
          ],
        },
        {
          heading: '4. No-Show & Failure to Collect the Vehicle',
          body: [
            'You will be treated as a no-show if you don\'t collect the vehicle within the agreed pickup window, don\'t present the required documents, don\'t complete verification, or become unreachable at the scheduled time — including if you never arrive despite a confirmed booking. In these cases, the booking may be cancelled, the vehicle released for other guests, and no refund is payable.',
          ],
        },
        {
          heading: '5. Company-Initiated Cancellations',
          body: [
            'We may cancel a booking due to vehicle unavailability, operational constraints, safety concerns, fraud detection, force majeure, regulatory restrictions, or a verification failure. Where the cancellation is solely attributable to the Company, you receive a full refund of amounts paid with no cancellation fee — unless the underlying cause was your own misconduct, documentation issues, or a policy violation.',
          ],
        },
        {
          heading: '6. Booking Modifications',
          body: [
            'Subject to availability, you may request a trip extension, a shortened rental, a change of pickup time, or a different vehicle. Modification charges may apply, and any difference in rental cost is adjusted against your original payment.',
          ],
        },
        {
          heading: '7. Early Return of the Vehicle',
          body: [
            'If you return the vehicle before your booked rental period ends, no refund is payable for the unused duration, except where the Company agrees otherwise at its discretion.',
          ],
        },
        {
          heading: '8. Security Deposit',
          body: [
            'Where applicable, the security deposit shown at checkout is collected together with the trip cost in a single payment through PayU, rather than as a separate hold. From this combined amount, the Company may deduct charges for traffic violations, tolls, parking, fuel shortfall, cleaning, damage repair, missing accessories, late-return charges, and legal or recovery expenses arising from your conduct during the trip.',
            'Subject to inspection of the vehicle and verification of any pending challans or damage claims, the deposit balance is ordinarily returned to your original payment method within 7–21 business days of trip completion; this can take longer while a challan, damage assessment, or investigation is still pending. Deposit refunds are handled separately from the host\'s own trip earnings, so any deduction from your deposit does not change what the host is paid for the trip.',
          ],
        },
        {
          heading: '9. Failed or Duplicate Payments',
          body: ['Where a payment is deducted but the booking is not confirmed, or a duplicate charge or technical error results in overpayment, we verify the transaction and process eligible refunds. You may be asked to provide transaction evidence.'],
        },
        {
          heading: '10. Non-Refundable Charges',
          body: [
            'Convenience fees, platform fees, verification charges, documentation charges, membership fees, subscription fees already consumed, government taxes already deposited, third-party charges, activated insurance charges, late-payment charges, and penalties or fines are generally non-refundable.',
          ],
        },
        {
          heading: '11. Special Event & Peak-Demand Bookings',
          body: ['Bookings made during festivals, long weekends, or other high-demand periods may carry different cancellation terms, which will be clearly disclosed at the time of booking.'],
        },
        {
          heading: '12. Force Majeure',
          body: [
            'We are not liable for cancellations, delays, or an inability to provide a vehicle caused by events outside our reasonable control — including natural disasters, floods, epidemics, government restrictions, strikes, civil unrest, or infrastructure and payment-network outages. Where such an event affects a confirmed booking, we will offer a credit, rescheduling, or a refund at our discretion.',
          ],
        },
        {
          heading: '13. Chargebacks & Payment Disputes',
          body: ['Please contact our support team before initiating a chargeback with your bank — most issues can be resolved faster this way. A chargeback found to be fraudulent or unjustified may result in booking restrictions, account suspension, and recovery of the disputed amount.'],
        },
        {
          heading: '14. Refund Processing Timelines',
          body: [
            'UPI: 3–7 business days  ·  Debit card: 5–10 business days  ·  Credit card: 5–15 business days  ·  Net banking: 5–10 business days  ·  Wallets: 3–10 business days.',
            'Refunds are made to your original payment source wherever feasible, through PayU and in accordance with RBI guidelines. Actual credit timelines depend on your bank or payment provider.',
          ],
        },
        {
          heading: '15. Refund Refusal',
          body: ['We may decline a refund where a request involves false information, fraudulent activity, a breach of the rental terms, unlawful use of the vehicle, forged documentation, or a claim unsupported by evidence.'],
        },
        {
          heading: '16. Consumer Rights',
          body: ['Nothing in this Policy restricts, waives, or limits any rights available to consumers under the Consumer Protection Act 2019, the Consumer Protection (E-Commerce) Rules 2020, or other applicable law.'],
        },
        {
          heading: '17. Grievance Redressal',
          body: [
            `${COMPANY.legalName}  ·  ${COMPANY.address}`,
            `Email: ${COMPANY.email}  ·  Phone: ${COMPANY.phone}`,
            'Grievances are acknowledged within 48 hours and resolved within legally prescribed timelines.',
          ],
        },
        {
          heading: '18. Amendments to This Policy',
          body: ['We may modify, amend, or replace this Policy at any time. Updated versions take effect upon publication on the platform.'],
        },
        {
          heading: '19. Governing Law & Jurisdiction',
          body: [`This Policy is governed by Indian law. Subject to applicable consumer-protection provisions, the ${COMPANY.jurisdiction} have exclusive jurisdiction over disputes arising from or relating to this Policy.`],
        },
      ]}
    />
  );
}
