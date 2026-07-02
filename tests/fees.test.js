import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  calculateAppFeeCents,
  calculateCardProcessingFeeCents,
  calculateCompanyLedgerCosts,
  calculateCustomerCheckoutTotals,
  calculateDepositPayment,
  DEFAULT_FEE_SETTINGS,
} from '../src/utils/fees.js';
import {
  calculateAppFeeLedgerNetCents,
  calculateOwnerSmsEstimateCents,
  createNearLiveRecordsForBooking,
} from '../src/utils/nearLiveRecords.js';

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

  it('estimates owner SMS from the hidden BrandNew app fee ledger', () => {
    expect(calculateOwnerSmsEstimateCents()).toBe(1);
    expect(calculateAppFeeLedgerNetCents(300, 1)).toBe(299);
  });

  it('creates near-live payment, ledger, and SMS records without live provider IDs', () => {
    const records = createNearLiveRecordsForBooking({
      id: 'booking_123',
      serviceTitle: 'Basic Detail',
      status: 'confirmed',
      totalCents: 15000,
      amountPaidTodayCents: 0,
      depositCents: 2500,
      cardProcessingFeeCents: 0,
      companyAppFeeCents: 300,
      appFeeRoutingStatus: 'ledger_only',
      address: 'Murfreesboro, TN',
      customer: { name: 'Demo Customer', phone: '(615) 555-0123', vehicle: 'Daily driver' },
    }, DEFAULT_FEE_SETTINGS);

    expect(records.paymentIntent.mode).toBe('test_mode_ready_not_connected');
    expect(records.paymentIntent.checkoutSessionId).toBeNull();
    expect(records.paymentIntent.paymentIntentId).toBeNull();
    expect(records.paymentIntent.connectedAccountId).toBeNull();
    expect(records.paymentIntent.applicationFeeAmountCents).toBe(300);
    expect(records.appFeeLedgerEntry.routingStatus).toBe('ledger_only');
    expect(records.appFeeLedgerEntry.smsCostStatus).toBe('estimated_not_billed');
    expect(records.appFeeLedgerEntry.visibleToCustomer).toBe(false);
    expect(records.smsNotification.status).toBe('would_send');
    expect(records.smsNotification.costEstimateCents).toBe(1);
    expect(records.customer.guestName).toBe('Demo Customer');
    expect(records.customer.claimTokenHash).toBe('claim_preview_booking_123');
    expect(records.customerProfile.status).toBe('guest_unclaimed');
  });

  it('keeps the Supabase migration ready for guest claims and RLS', () => {
    const migration = readFileSync('supabase/migrations/20260525161000_backend_foundation.sql', 'utf8');
    expect(migration).toContain('guest_name text');
    expect(migration).toContain('guest_phone text');
    expect(migration).toContain('guest_vehicle_label text');
    expect(migration).toContain('claim_token_hash text');
    expect(migration).toContain('claimed_by_user_id uuid');
    expect(migration).toContain('claimed_at timestamptz');
    expect(migration).toContain('alter table public.bookings enable row level security');
    expect(migration).toContain('create or replace function public.create_guest_booking');
    expect(migration).toContain('create policy "bookings read claimed own or staff"');
  });

  it('keeps the Supabase booking RPC responsible for server-side slot validation', () => {
    const migration = readFileSync('supabase/migrations/20260702130000_booking_rpc_validation.sql', 'utf8');
    expect(migration).toContain('create or replace function public.create_guest_booking');
    expect(migration).toContain('requested time is already booked');
    expect(migration).toContain('requested time is blocked');
    expect(migration).toContain('requested time is outside working hours');
    expect(migration).toContain('tstzrange(b.start_at, public.booking_end_at');
    expect(migration).toContain("status_to_insert := 'requested'");
    expect(migration).toContain('insert into public.owner_acknowledgments');
    expect(migration).toContain('insert into public.payment_placeholders');
    expect(migration).toContain('insert into public.sms_notifications');
    expect(migration).toContain('grant execute on function public.create_guest_booking(jsonb) to anon, authenticated');
    expect(migration).toContain('create or replace function public.claim_guest_booking');
    expect(migration).toContain('insert into public.customer_profiles');
    expect(migration).toContain('insert into public.vehicles');
    expect(migration).not.toContain("'company_app_fee_cents',\n    'deposit_cents'");
  });

  it('keeps owner operations server-side and role-gated for the future backend', () => {
    const migration = readFileSync('supabase/migrations/20260702143000_owner_operations_rpc.sql', 'utf8');
    expect(migration).toContain('create or replace function public.assert_owner_or_developer');
    expect(migration).toContain('owner or developer role required');
    expect(migration).toContain('create or replace function public.owner_acknowledge_booking');
    expect(migration).toContain('create or replace function public.owner_decide_booking_request');
    expect(migration).toContain('only requested bookings can be confirmed or declined here');
    expect(migration).toContain('create or replace function public.owner_request_booking_reschedule');
    expect(migration).toContain('create or replace function public.owner_update_booking_tracker');
    expect(migration).toContain("tracker status must be on_my_way, arrived, or complete");
    expect(migration).toContain('create or replace function public.owner_set_availability_block');
    expect(migration).toContain('create or replace function public.owner_remove_availability_block');
    expect(migration).toContain('grant execute on function public.owner_acknowledge_booking(uuid) to authenticated');
    expect(migration).toContain('grant execute on function public.owner_set_availability_block(text, date, text, text) to authenticated');
  });

  it('keeps a Supabase seed for current services and launch settings', () => {
    const seed = readFileSync('supabase/seed.sql', 'utf8');
    expect(seed).toContain("('basic', 'Basic Detail', 15000");
    expect(seed).toContain("('deluxe', 'Deluxe Detail', 22000");
    expect(seed).toContain("('premium', 'Premium Detail', 32000");
    expect(seed).toContain("('monthly', 'Monthly Maintenance', 10000");
    expect(seed).toContain("('business_name', '\"The Peoples Detailing\"'::jsonb)");
    expect(seed).toContain("('booking_submit_mode', '\"instant_book_no_payment\"'::jsonb)");
    expect(seed).toContain("('stripe_live_mode', '\"locked\"'::jsonb)");
    expect(seed).toContain("('owner_sms', 'queued_locally_only'");
  });
});
