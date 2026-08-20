/** Single source of truth for real business/legal facts, pulled from ziyam.in — used across About, Terms, Privacy, Refund Policy, and the footer. */
export const COMPANY = {
  legalName: 'Eightlines Fleet Private Limited',
  brand: 'ZIYAM',
  brandFull: 'ZiyamSelfDrive',
  tagline: 'By Eightlines',
  cin: 'U77100KA2026PTC7772',
  registeredDate: '16 March 2026',
  address: '8-Lines Fleet, 15th Cross Rd, Popular Colony, Mangammanapalya, Bengaluru, Karnataka 560068',
  email: 'eightlinesfleet@gmail.com',
  phone: '+91 63636 17864',
  whatsappUrl: 'https://wa.me/916363617864',
  operatingCity: 'Bengaluru',
  scopeNote: 'Currently operating in Bengaluru only — expanding pan-India as the fleet grows.',
  jurisdiction: 'Courts at Bengaluru, Karnataka',
  startupIndiaRecognized: true,
  // Certified by QRO (Quality Research Organization / QRO Certification LLP),
  // IAF-accredited. Scope of activities on all three: "Providing
  // technology-driven fleet logistics, asset aggregation platforms,
  // peer-to-peer mobility routing, B2B corporate vehicle rental management,
  // and high-end event & luxury hospitality transport operations."
  certifications: [
    { standard: 'ISO 9001:2015', name: 'Quality Management System', certNumber: '305026060181Q' },
    { standard: 'ISO/IEC 27001:2022', name: 'Information Security Management System', certNumber: '305026060183IS' },
    { standard: 'ISO 14001:2015', name: 'Environmental Management System', certNumber: '305026060182E' },
  ],
  certifyingBody: 'QRO Certification LLP',
  certificationValidFrom: '1 June 2026',
  certificationExpiry: '31 May 2029',
  team: [
    {
      name: 'Syed Fardeen',
      role: 'Founder, CEO & Director',
      bio: 'Sets group strategy and capital allocation across Ziyam Self Drive, Mechanix Pro and Marc8. Owns fleet expansion, brand and long-term partnerships.',
    },
    {
      name: 'Mohammed Azam A',
      role: 'Co-Founder & Managing Director',
      bio: 'Leads business growth and expansion: hub network, partner and vendor relationships, and P&L accountability across the EFPL brands.',
    },
    {
      name: 'Shaik Afnan Sabil',
      role: 'Co-Founder & VP, Operations',
      bio: 'Owns fleet operations end to end: handover and return inspections, preventive maintenance cycles, hub parking protocols and agent performance.',
    },
    {
      name: 'Junaid Khan',
      role: 'Co-Founder & Chief Operating Officer',
      bio: 'Owns execution across the fleet: hub throughput, vehicle utilisation, service standards and delivery across Ziyam Self Drive and Mechanix Pro.',
    },
    {
      name: 'Numer Saqlain M',
      role: 'Co-Founder & Chief Financial Officer',
      bio: 'Owns finance across EFPL: host settlements and payout cycles, unit economics, GST and statutory compliance, and capital planning.',
    },
  ] as { name: string; role: string; bio?: string }[],
};
