import { describe, expect, it } from 'vitest';
import {
  calculateAppFeeCents,
  calculateCardProcessingFeeCents,
  calculateCompanyLedgerCosts,
  calculateCustomerCheckoutTotals,
  calculateDepositPayment,
  DEFAULT_FEE_SETTINGS,
} from '../src/utils/fees.js';

describe('checkout fee logic', () => {
  it('tracks the flat $3 app cost for Dane without adding it to checkout', () => {
    expect(calculateAppFeeCents(DEFAULT_FEE_SETTINGS)).toBe(300);
  });

  it('full card checkout excludes app fee and charges customer card processing by default', () => {
    const total = calculateCustomerCheckoutTotals({
      servicePriceCents: 22_000,
      travelFeeCents: 2_000,
      discountCents: 1_000,
      paymentChoice: 'card_full',
      settings: DEFAULT_FEE_SETTINGS,
    });

    expect(total.subtotalCents).toBe(24_000);
    expect(total.jobTotalAfterDiscountCents).toBe(23_000);
    expect(total.appFeeCents).toBe(300);
    expect(total.totalBeforeCardFeeCents).toBe(23_000);
    expect(total.cardProcessingFeeCents).toBeGreaterThan(0);
    expect(total.totalDueTodayCents).toBe(23_000 + total.cardProcessingFeeCents);
    expect(total.balanceDueCents).toBe(0);
    expect(total.paymentStatus).toBe('paid_full');
  });

  it('deposit cash balance charges deposit plus card fee today and records balance', () => {
    const total = calculateCustomerCheckoutTotals({
      servicePriceCents: 22_000,
      travelFeeCents: 2_000,
      discountCents: 0,
      paymentChoice: 'deposit_cash_balance',
      settings: DEFAULT_FEE_SETTINGS,
    });

    expect(total.amountPaidBeforeCardFeeCents).toBe(2_500);
    expect(total.cardProcessingFeeCents).toBe(calculateCardProcessingFeeCents(2_500, DEFAULT_FEE_SETTINGS));
    expect(total.totalDueTodayCents).toBe(2_500 + total.cardProcessingFeeCents);
    expect(total.balanceDueCents).toBe(21_500);
    expect(total.paymentStatus).toBe('balance_due');
  });

  it('can cover card processing if owner turns customer-paid processing off', () => {
    const fee = calculateCardProcessingFeeCents(2_500, {
      ...DEFAULT_FEE_SETTINGS,
      customerPaysCardProcessingFee: false,
    });
    expect(fee).toBe(0);
  });

  it('does not let the deposit exceed a small job total', () => {
    expect(calculateDepositPayment(1_200, DEFAULT_FEE_SETTINGS)).toBe(1_200);
  });

  it('records app fee routing as ledger-only until backend routing exists', () => {
    expect(calculateCompanyLedgerCosts(DEFAULT_FEE_SETTINGS)).toEqual({
      companyAppFeeCents: 300,
      appFeeRoutingStatus: 'ledger_only',
    });
  });
});
