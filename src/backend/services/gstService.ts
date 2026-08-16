import { getSetting } from './settingsService';

// Common Indian cities -> state, for determining place-of-supply (intra- vs
// inter-state) when a Car has no explicit state field. Falls back to the
// company's home state (company_home_state Setting) for anything not listed
// — correct for Ziyam's current Bengaluru-only operation regardless, and a
// reasonable default once it expands.
const CITY_STATE_MAP: Record<string, string> = {
  Bengaluru: 'Karnataka', Bangalore: 'Karnataka', Mysuru: 'Karnataka', Mangaluru: 'Karnataka',
  Mumbai: 'Maharashtra', Pune: 'Maharashtra', Nagpur: 'Maharashtra',
  'Delhi NCR': 'Delhi', Delhi: 'Delhi', Gurugram: 'Haryana', Noida: 'Uttar Pradesh',
  Hyderabad: 'Telangana', Chennai: 'Tamil Nadu', Kolkata: 'West Bengal',
  Jaipur: 'Rajasthan', Ahmedabad: 'Gujarat', Kochi: 'Kerala',
};

export interface GstBreakdown {
  placeOfSupply: string;
  gstRate: number;
  cgstAmount: number | null;
  sgstAmount: number | null;
  igstAmount: number | null;
  totalGst: number;
  totalWithGst: number;
}

/** Computes CGST+SGST (intra-state) or IGST (inter-state) for a base amount, frozen onto the invoice at creation. */
export async function computeGst(amount: number, city: string): Promise<GstBreakdown> {
  const [gstRate, homeState] = await Promise.all([
    getSetting<number>('default_gst_rate', 0.05),
    getSetting<string>('company_home_state', 'Karnataka'),
  ]);

  const placeOfSupply = CITY_STATE_MAP[city] ?? homeState;
  const isIntraState = placeOfSupply === homeState;
  const totalGst = Number((amount * gstRate).toFixed(2));

  const breakdown: GstBreakdown = isIntraState
    ? { placeOfSupply, gstRate, cgstAmount: Number((totalGst / 2).toFixed(2)), sgstAmount: Number((totalGst / 2).toFixed(2)), igstAmount: null, totalGst, totalWithGst: amount + totalGst }
    : { placeOfSupply, gstRate, cgstAmount: null, sgstAmount: null, igstAmount: totalGst, totalGst, totalWithGst: amount + totalGst };

  return breakdown;
}
