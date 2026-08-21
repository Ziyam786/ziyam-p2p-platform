import { describe, it, expect } from 'vitest';
import { REQUIRED_CAR_ANGLES, isAngleComplete, isBookable } from '../src/backend/utils/carPhotoAngles';

describe('REQUIRED_CAR_ANGLES', () => {
  it('is exactly the 6 required angles, FRONT first', () => {
    expect(REQUIRED_CAR_ANGLES).toEqual(['FRONT', 'RIGHT', 'REAR', 'LEFT', 'INTERIOR_FRONT', 'INTERIOR_REAR']);
  });
});

describe('isAngleComplete', () => {
  it('returns false for an empty array', () => {
    expect(isAngleComplete([])).toBe(false);
  });

  it('returns false for null/undefined', () => {
    expect(isAngleComplete(null)).toBe(false);
    expect(isAngleComplete(undefined)).toBe(false);
  });

  it('returns false when one required angle is missing', () => {
    expect(isAngleComplete(['FRONT', 'RIGHT', 'REAR', 'LEFT', 'INTERIOR_FRONT'])).toBe(false);
  });

  it('returns true when all 6 required angles are present', () => {
    expect(isAngleComplete(['FRONT', 'RIGHT', 'REAR', 'LEFT', 'INTERIOR_FRONT', 'INTERIOR_REAR'])).toBe(true);
  });

  it('returns true regardless of order or extra non-required entries', () => {
    expect(isAngleComplete(['INTERIOR_REAR', 'LEFT', 'OTHER', 'FRONT', 'REAR', 'RIGHT', 'INTERIOR_FRONT'])).toBe(true);
  });
});

describe('isBookable', () => {
  const complete = ['FRONT', 'RIGHT', 'REAR', 'LEFT', 'INTERIOR_FRONT', 'INTERIOR_REAR'];
  const incomplete = ['FRONT'];

  it('is always bookable when angle-complete, regardless of the cutoff date', () => {
    expect(isBookable({ imageAngles: complete }, '2000-01-01')).toBe(true);
  });

  it('is bookable when incomplete but no cutoff date is configured', () => {
    expect(isBookable({ imageAngles: incomplete }, '')).toBe(true);
  });

  it('is bookable when incomplete but the cutoff date is in the future', () => {
    const future = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString().slice(0, 10);
    expect(isBookable({ imageAngles: incomplete }, future)).toBe(true);
  });

  it('is not bookable when incomplete and the cutoff date has passed', () => {
    expect(isBookable({ imageAngles: incomplete }, '2000-01-01')).toBe(false);
  });
});
