import { describe, it, expect } from 'vitest';
import { suggestCategoryForTrip } from '../src/backend/utils/carSuggestion';

describe('suggestCategoryForTrip', () => {
  it('suggests Sedan for a short trip', () => {
    expect(suggestCategoryForTrip(100)).toBe('Sedan');
  });

  it('suggests Sedan right at the boundary', () => {
    expect(suggestCategoryForTrip(350)).toBe('Sedan');
  });

  it('suggests SUV just past the boundary', () => {
    expect(suggestCategoryForTrip(351)).toBe('SUV');
  });

  it('suggests SUV for a long trip', () => {
    expect(suggestCategoryForTrip(480)).toBe('SUV');
  });
});
