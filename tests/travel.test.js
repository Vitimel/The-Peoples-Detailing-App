import { describe, expect, it } from 'vitest';
import { calculateTravelFeeCents, estimateMilesFromAddress } from '../src/utils/travel.js';

describe('travel estimate helpers', () => {
  it('recognizes Nashville typed address input for travel fee estimates', () => {
    expect(estimateMilesFromAddress('Nashville, Tennessee')).toMatchObject({
      label: 'Nashville, TN',
      miles: 35,
    });
  });

  it('recognizes exact typed addresses when they include a supported city or ZIP', () => {
    expect(estimateMilesFromAddress('405 Main St, Franklin, TN 37064')).toMatchObject({
      label: 'Franklin, TN',
      miles: 38,
      source: 'typed address city estimate',
    });

    expect(estimateMilesFromAddress('Cool Springs address 37067')).toMatchObject({
      label: 'Franklin, TN',
      miles: 38,
      source: 'ZIP estimate',
    });
  });

  it('does not guess from unsupported street-only addresses', () => {
    expect(estimateMilesFromAddress('123 Main Street, TN')).toBeNull();
  });

  it('keeps Murfreesboro inside the free travel radius', () => {
    expect(estimateMilesFromAddress('Murfreesboro, TN')).toMatchObject({
      label: 'Murfreesboro, TN',
      miles: 0,
    });
    expect(calculateTravelFeeCents(0, { freeTravelRadiusMiles: 10, perMileFeeCents: 150 })).toBe(0);
  });

  it('calculates travel fee after the free radius', () => {
    expect(calculateTravelFeeCents(35, { freeTravelRadiusMiles: 10, perMileFeeCents: 150 })).toBe(3750);
  });
});
