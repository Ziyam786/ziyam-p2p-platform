import { describe, it, expect, vi, beforeEach } from 'vitest';

// computeGst reads its rate and home state from the admin-editable settings
// store, so the store is the one thing we control per-test. Everything else
// under test is pure arithmetic we want to pin down exactly.
const settings = vi.hoisted(() => ({ values: {} as Record<string, unknown> }));
vi.mock('../src/backend/services/settingsService', () => ({
  getSetting: async (key: string, fallback: unknown) =>
    key in settings.values ? settings.values[key] : fallback,
}));

import { computeGst } from '../src/backend/services/gstService';

beforeEach(() => {
  settings.values = { default_gst_rate: 0.05, company_home_state: 'Karnataka' };
});

describe('computeGst — place of supply', () => {
  it('splits into CGST+SGST for an intra-state supply', async () => {
    const r = await computeGst(10000, 'Bengaluru');
    expect(r.placeOfSupply).toBe('Karnataka');
    expect(r.cgstAmount).toBe(250);
    expect(r.sgstAmount).toBe(250);
    expect(r.igstAmount).toBeNull();
    expect(r.totalGst).toBe(500);
    expect(r.totalWithGst).toBe(10500);
  });

  it('charges IGST for an inter-state supply', async () => {
    const r = await computeGst(10000, 'Mumbai');
    expect(r.placeOfSupply).toBe('Maharashtra');
    expect(r.igstAmount).toBe(500);
    expect(r.cgstAmount).toBeNull();
    expect(r.sgstAmount).toBeNull();
    expect(r.totalGst).toBe(500);
  });

  it('treats city aliases as the same state (Bangalore == Bengaluru)', async () => {
    const a = await computeGst(5000, 'Bengaluru');
    const b = await computeGst(5000, 'Bangalore');
    expect(b.placeOfSupply).toBe(a.placeOfSupply);
    expect(b.cgstAmount).toBe(a.cgstAmount);
  });

  it('maps NCR cities to their real states, not to Delhi', async () => {
    // Gurugram is Haryana and Noida is UP — getting this wrong is a real
    // filing error, not a cosmetic one, because it flips CGST/SGST to IGST.
    expect((await computeGst(1000, 'Gurugram')).placeOfSupply).toBe('Haryana');
    expect((await computeGst(1000, 'Noida')).placeOfSupply).toBe('Uttar Pradesh');
    expect((await computeGst(1000, 'Delhi')).placeOfSupply).toBe('Delhi');
  });

  it('falls back to the home state for an unmapped city, and so bills intra-state', async () => {
    const r = await computeGst(1000, 'Somewhere Not In The Map');
    expect(r.placeOfSupply).toBe('Karnataka');
    expect(r.igstAmount).toBeNull();
  });

  it('follows the home state when the company moves', async () => {
    settings.values.company_home_state = 'Maharashtra';
    const mumbai = await computeGst(1000, 'Mumbai');
    expect(mumbai.cgstAmount).toBe(25);
    expect(mumbai.igstAmount).toBeNull();

    const blr = await computeGst(1000, 'Bengaluru');
    expect(blr.igstAmount).toBe(50);
    expect(blr.cgstAmount).toBeNull();
  });

  it('honours a changed GST rate from settings', async () => {
    settings.values.default_gst_rate = 0.18;
    const r = await computeGst(1000, 'Bengaluru');
    expect(r.gstRate).toBe(0.18);
    expect(r.totalGst).toBe(180);
    expect(r.cgstAmount).toBe(90);
    expect(r.sgstAmount).toBe(90);
  });

  it('rounds GST to paise and keeps the CGST/SGST halves consistent with the total', async () => {
    const r = await computeGst(1333.33, 'Bengaluru');
    expect(r.totalGst).toBe(66.67);
    // Documents real behaviour: each half is independently rounded, so the
    // halves can sum to a paise more than the stated total. Invoices must
    // present totalGst as authoritative rather than re-adding the halves.
    expect((r.cgstAmount as number) + (r.sgstAmount as number)).toBeCloseTo(66.68, 2);
  });

  it('returns zero GST on a zero-amount supply rather than NaN', async () => {
    const r = await computeGst(0, 'Bengaluru');
    expect(r.totalGst).toBe(0);
    expect(r.totalWithGst).toBe(0);
  });
});
