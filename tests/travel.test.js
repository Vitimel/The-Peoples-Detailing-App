import { describe, expect, it } from 'vitest';
import { calculateTravelFeeCents, estimateMilesFromAddress } from '../src/utils/travel.js';

describe('travel estimate helpers', () => {
  it('recognizes Nashville typed address input for travel fee estimates', () => {
    expect(estimateMilesFromAddress('Nashville, Tennessee')).toMatchObject({
      label: 'Nashville, TN',
      miles: 35,
    });
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
