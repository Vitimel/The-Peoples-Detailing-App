import { describe, expect, it } from 'vitest';
import {
  calculateAppFeeCents,
  calculateCardProcessingFeeCents,
  calculateCheckoutTotals,
  DEFAULT_FEE_SETTINGS,
} from '../src/utils/fees.js';

describe('checkout fee logic', () => {
  it('uses the flat $3 app fee by default', () => {
    expect(calculateAppFeeCents(10_000, DEFAULT_FEE_SETTINGS)).toBe(300);
  });

  it('keeps the flat $3 app fee on larger jobs', () => {
    expect(calculateAppFeeCents(32_000, DEFAULT_FEE_SETTINGS)).toBe(300);
  });

  it('supports percent/min/max app fee settings when no flat fee is set', () => {
    expect(calculateAppFeeCents(18_000, {
      ...DEFAULT_FEE_SETTINGS,
      appFeeFlatCents: undefined,
    })).toBe(450);
  });

  it('shows card processing fee when the customer pays it', () => {
    const fee = calculateCardProcessingFeeCents(22_550, {
      ...DEFAULT_FEE_SETTINGS,
      customerPaysCardProcessingFee: true,
    });
    expect(fee).toBeGreaterThan(0);
  });

  it('hides card processing fee when owner absorbs it', () => {
    expect(calculateCardProcessingFeeCents(22_550, {
      ...DEFAULT_FEE_SETTINGS,
      customerPaysCardProcessingFee: false,
    })).toBe(0);
  });

  it('carries discount into the total due today', () => {
    const total = calculateCheckoutTotals({
      servicePriceCents: 22_000,
      travelFeeCents: 2_000,
      discountCents: 1_000,
      settings: DEFAULT_FEE_SETTINGS,
    });

    expect(total.subtotalCents).toBe(24_000);
    expect(total.appFeeCents).toBe(300);
    expect(total.cardProcessingFeeCents).toBe(0);
    expect(total.totalCents).toBe(23_300);
  });
});
