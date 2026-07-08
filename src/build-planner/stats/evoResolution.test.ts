import { describe, expect, it } from 'vitest';
import { hasDistinctEvoAttrs } from './evoResolution';

describe('hasDistinctEvoAttrs', () => {
  it('returns false when there is no evo data', () => {
    expect(hasDistinctEvoAttrs(undefined)).toBe(false);
    expect(hasDistinctEvoAttrs([])).toBe(false);
  });

  it('returns true for a single evo slot (attrId trivially distinct)', () => {
    expect(hasDistinctEvoAttrs([[101, 1, 2, 3, 4]])).toBe(true);
  });

  it('returns true when Evo1/Evo2 have different attrIds', () => {
    expect(
      hasDistinctEvoAttrs([
        [101, 1, 2, 3, 4],
        [102, 1, 2, 3, 4],
      ]),
    ).toBe(true);
  });

  it('returns false when Evo1/Evo2 share the same attrId (user selects)', () => {
    expect(
      hasDistinctEvoAttrs([
        [101, 1, 2, 3, 4],
        [101, 5, 6, 7, 8],
      ]),
    ).toBe(false);
  });
});
