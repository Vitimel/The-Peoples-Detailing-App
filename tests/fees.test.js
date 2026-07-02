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

  it('keeps owner closeout server-side without live payment provider calls', () => {
    const migration = readFileSync('supabase/migrations/20260702200000_owner_closeout_rpc.sql', 'utf8');
    expect(migration).toContain('add column if not exists closeout_status text');
    expect(migration).toContain('add column if not exists owner_adjustment_cents integer');
    expect(migration).toContain('add column if not exists cash_collected_cents integer');
    expect(migration).toContain('add column if not exists refund_needed_cents integer');
    expect(migration).toContain('create or replace function public.owner_closeout_booking');
    expect(migration).toContain('perform public.assert_owner_or_developer()');
    expect(migration).toContain('only confirmed or complete bookings can be closed out');
    expect(migration).toContain("'manual_review_required_no_stripe_refund_sent'");
    expect(migration).toContain('owner_closed_out_booking');
    expect(migration).toContain('grant execute on function public.owner_closeout_booking(uuid, integer, text, integer, text) to authenticated');
    expect(migration).toContain('create or replace function public.owner_get_report_snapshot');
    expect(migration).toContain("'cash_collected_cents'");
    expect(migration).toContain("'owner_adjustment_cents'");
    expect(migration).toContain("'refund_needed_cents'");
    expect(migration).not.toMatch(/stripe\.com|checkout_session_id|payment_intent_id|connected_account_id|twilio|telnyx|service-role/i);
  });

  it('keeps customer lifecycle operations server-side without live providers', () => {
    const migration = readFileSync('supabase/migrations/20260702150000_customer_lifecycle_rpc.sql', 'utf8');
    expect(migration).toContain('create or replace function public.can_access_booking');
    expect(migration).toContain('booking access denied');
    expect(migration).toContain('create or replace function public.customer_cancel_booking');
    expect(migration).toContain('cancel_deposit_forfeit_days');
    expect(migration).toContain('Deposit forfeited');
    expect(migration).toContain('No payment collected');
    expect(migration).toContain('create or replace function public.reschedule_booking');
    expect(migration).toContain('short-notice requests cannot be rescheduled online by the customer');
    expect(migration).toContain('inside customer reschedule cutoff');
    expect(migration).toContain('perform public.validate_booking_slot');
    expect(migration).toContain('create or replace function public.create_booking_message');
    expect(migration).toContain("'not_connected'");
    expect(migration).toContain("'estimated_not_billed'");
    expect(migration).toContain('grant execute on function public.customer_cancel_booking(uuid, text, text) to anon, authenticated');
    expect(migration).toContain('grant execute on function public.reschedule_booking(uuid, timestamptz, text, text, text) to anon, authenticated');
    expect(migration).toContain('grant execute on function public.create_booking_message(uuid, text, text) to anon, authenticated');
  });

  it('keeps developer admin operations role-gated and live providers locked', () => {
    const migration = readFileSync('supabase/migrations/20260702153000_developer_admin_rpc.sql', 'utf8');
    expect(migration).toContain('create or replace function public.assert_developer');
    expect(migration).toContain('developer role required');
    expect(migration).toContain('create or replace function public.developer_update_service');
    expect(migration).toContain('price_cents must be zero or greater');
    expect(migration).toContain('create or replace function public.developer_update_business_setting');
    expect(migration).toContain('setting cannot be managed by developer admin');
    expect(migration).toContain('Stripe live mode remains locked until separate go-live approval');
    expect(migration).toContain('SMS provider remains not_connected until separate go-live approval');
    expect(migration).toContain('create or replace function public.developer_update_integration_status');
    expect(migration).toContain('owner SMS provider remains disabled until separate approval');
    expect(migration).toContain('grant execute on function public.developer_update_service(text, text, integer, integer, integer, boolean) to authenticated');
  });

  it('keeps developer admin reads role-gated and free of customer operational data', () => {
    const migration = readFileSync('supabase/migrations/20260702190000_developer_admin_read_rpc.sql', 'utf8');
    expect(migration).toContain('create or replace function public.developer_get_admin_snapshot');
    expect(migration).toContain('perform public.assert_developer()');
    expect(migration).toContain("'customer_sees_app_fee', false");
    expect(migration).toContain("'app_fee_routing_status', 'ledger_only'");
    expect(migration).toContain("'stripe_live_mode', 'locked_until_explicit_approval'");
    expect(migration).toContain('grant execute on function public.developer_get_admin_snapshot() to authenticated');
    expect(migration).not.toContain('from public.bookings');
    expect(migration).not.toContain('payment_placeholders');
    expect(migration).not.toContain('sms_notifications');
    expect(migration).not.toContain('claim_token_hash');
  });

  it('hardens Supabase Auth profile creation and app-role checks', () => {
    const migration = readFileSync('supabase/migrations/20260702160000_auth_role_hardening.sql', 'utf8');
    expect(migration).toContain('create or replace function public.current_app_role()');
    expect(migration).toContain('security definer');
    expect(migration).toContain('create or replace function public.is_owner_or_developer()');
    expect(migration).toContain('create or replace function public.handle_new_auth_user()');
    expect(migration).toContain('after insert on auth.users');
    expect(migration).toContain("new.id,\n    'customer'");
    expect(migration).toContain('drop policy if exists "profiles update own basic fields or developer role"');
    expect(migration).toContain('create or replace function public.developer_assign_app_role');
    expect(migration).toContain('perform public.assert_developer()');
    expect(migration).toContain('developer cannot remove their own developer role');
    expect(migration).toContain('grant execute on function public.current_app_role() to anon, authenticated');
    expect(migration).toContain('grant execute on function public.developer_assign_app_role(uuid, public.app_role, text, text) to authenticated');
  });

  it('keeps guest claim tokens usable without storing raw tokens', () => {
    const migration = readFileSync('supabase/migrations/20260702170000_guest_claim_token_contract.sql', 'utf8');
    expect(migration).toContain('create or replace function public.hash_claim_token');
    expect(migration).toContain("encode(digest(token_input, 'sha256'), 'hex')");
    expect(migration).toContain('create or replace function public.booking_claim_token_matches');
    expect(migration).toContain('drop function if exists public.create_guest_booking(jsonb)');
    expect(migration).toContain('returns jsonb');
    expect(migration).toContain("raw_claim_token text := encode(gen_random_bytes(32), 'hex')");
    expect(migration).toContain('public.hash_claim_token(raw_claim_token)');
    expect(migration).not.toContain('stored_hash = token_input');
    expect(migration).toContain("'claim_token', raw_claim_token");
    expect(migration).toContain('public.booking_claim_token_matches(claim_token_hash, claim_token_hash_input)');
    expect(migration).toContain('grant execute on function public.create_guest_booking(jsonb) to anon, authenticated');
    expect(migration).toContain('grant execute on function public.claim_guest_booking(uuid, text) to authenticated');
  });

  it('keeps guest claim handoff audited and attached to profile data', () => {
    const migration = readFileSync('supabase/migrations/20260702202000_guest_claim_audit_rpc.sql', 'utf8');
    expect(migration).toContain('create or replace function public.claim_guest_booking');
    expect(migration).toContain('sign in required');
    expect(migration).toContain('claimed_by_user_id is null');
    expect(migration).toContain('public.booking_claim_token_matches(claim_token_hash, claim_token_hash_input)');
    expect(migration).toContain('update public.messages');
    expect(migration).toContain('set customer_profile_id = profile_id');
    expect(migration).toContain('default_vehicle_id = saved_vehicle_id');
    expect(migration).toContain("'guest_booking_claimed'");
    expect(migration).toContain('grant execute on function public.claim_guest_booking(uuid, text) to authenticated');
    expect(migration).not.toContain('stored_hash = token_input');
    expect(migration).not.toContain('app_fee_ledger_entries');
    expect(migration).not.toContain('payment_placeholders');
    expect(migration).not.toContain('sms_notifications');
    expect(migration).not.toMatch(/stripe\.com|twilio|telnyx|service-role/i);
  });

  it('lets customers re-open bookings through safe token-gated read RPCs', () => {
    const migration = readFileSync('supabase/migrations/20260702180000_customer_booking_read_rpc.sql', 'utf8');
    expect(migration).toContain('create or replace function public.get_customer_booking');
    expect(migration).toContain('create or replace function public.get_customer_booking_messages');
    expect(migration).toContain('perform public.assert_booking_access(booking_id_input, claim_token_hash_input)');
    expect(migration).toContain("'service_title', booking_row.service_title");
    expect(migration).toContain("'owner_ack_status', booking_row.owner_ack_status");
    expect(migration).toContain("'payment_status', booking_row.payment_status");
    expect(migration).toContain("'customer_access_mode'");
    expect(migration).toContain('grant execute on function public.get_customer_booking(uuid, text) to anon, authenticated');
    expect(migration).toContain('grant execute on function public.get_customer_booking_messages(uuid, text) to anon, authenticated');
    expect(migration).not.toContain("'claim_token_hash'");
    expect(migration).not.toContain("'claimed_by_user_id'");
    expect(migration).not.toContain('app_fee_ledger_entries');
    expect(migration).not.toContain('payment_placeholders');
    expect(migration).not.toContain('sms_notifications');
  });

  it('lets booking parties read a safe status timeline without backend internals', () => {
    const migration = readFileSync('supabase/migrations/20260702201000_booking_timeline_read_rpc.sql', 'utf8');
    expect(migration).toContain('create or replace function public.get_booking_timeline');
    expect(migration).toContain('perform public.assert_booking_access(booking_id_input, claim_token_hash_input)');
    expect(migration).toContain('from public.status_events e');
    expect(migration).toContain("'event_type', e.event_type");
    expect(migration).toContain("'display_group'");
    expect(migration).toContain('order by e.created_at asc');
    expect(migration).toContain('grant execute on function public.get_booking_timeline(uuid, text) to anon, authenticated');
    expect(migration).not.toContain("'created_by'");
    expect(migration).not.toContain("'claim_token_hash'");
    expect(migration).not.toContain('app_fee_ledger_entries');
    expect(migration).not.toContain('payment_placeholders');
    expect(migration).not.toContain('sms_notifications');
    expect(migration).not.toMatch(/stripe\.com|twilio|telnyx|service-role/i);
  });

  it('lets signed-in customers list claimed bookings without private backend fields', () => {
    const migration = readFileSync('supabase/migrations/20260702192000_customer_booking_list_rpc.sql', 'utf8');
    expect(migration).toContain('create or replace function public.get_customer_bookings');
    expect(migration).toContain('sign in required');
    expect(migration).toContain('where b.claimed_by_user_id = auth.uid()');
    expect(migration).toContain("'customer_access_mode', 'profile'");
    expect(migration).toContain('grant execute on function public.get_customer_bookings() to authenticated');
    expect(migration).not.toContain("'claim_token_hash'");
    expect(migration).not.toContain("'claimed_by_user_id'");
    expect(migration).not.toContain('app_fee_ledger_entries');
    expect(migration).not.toContain('payment_placeholders');
    expect(migration).not.toContain('sms_notifications');
  });

  it('lets signed-in customers manage their profile and saved vehicles through RPCs', () => {
    const migration = readFileSync('supabase/migrations/20260702194000_customer_profile_vehicle_rpc.sql', 'utf8');
    expect(migration).toContain('create or replace function public.customer_ensure_profile()');
    expect(migration).toContain('sign in required');
    expect(migration).toContain('create or replace function public.get_my_customer_profile()');
    expect(migration).toContain('create or replace function public.upsert_my_customer_profile');
    expect(migration).toContain('notification preference must be email, sms, phone, or none');
    expect(migration).toContain('create or replace function public.upsert_my_vehicle');
    expect(migration).toContain('vehicle nickname is required');
    expect(migration).toContain('create or replace function public.delete_my_vehicle');
    expect(migration).toContain('grant execute on function public.get_my_customer_profile() to authenticated');
    expect(migration).toContain('grant execute on function public.upsert_my_vehicle(uuid, text, text, text, text, text, text, text, boolean) to authenticated');
    expect(migration).not.toContain('app_fee_ledger_entries');
    expect(migration).not.toContain('payment_placeholders');
    expect(migration).not.toContain('sms_notifications');
    expect(migration).not.toMatch(/service.role|service-role/i);
  });

  it('keeps active booking overlaps protected by the database', () => {
    const migration = readFileSync('supabase/migrations/20260702175000_booking_overlap_constraint.sql', 'utf8');
    expect(migration).toContain('add column if not exists end_at timestamptz');
    expect(migration).toContain('create or replace function public.set_booking_end_at');
    expect(migration).toContain('before insert or update of service_id, start_at');
    expect(migration).toContain('new.end_at := public.booking_end_at(new.service_id, new.start_at)');
    expect(migration).toContain('bookings_end_after_start');
    expect(migration).toContain('bookings_no_active_overlap');
    expect(migration).toContain('exclude using gist');
    expect(migration).toContain("where (status in ('requested', 'confirmed'))");
    expect(migration).toContain('deferrable initially immediate');
    expect(migration).toContain('bookings_active_range_idx');
  });

  it('keeps owner job queue reads role-gated and operational only', () => {
    const migration = readFileSync('supabase/migrations/20260702185000_owner_job_read_rpc.sql', 'utf8');
    expect(migration).toContain('create or replace function public.owner_list_jobs');
    expect(migration).toContain('perform public.assert_owner_or_developer()');
    expect(migration).toContain("'message_count', coalesce(msg.message_count, 0)");
    expect(migration).toContain("'owner_sms_status', sms.last_owner_sms_status");
    expect(migration).toContain("'owner_sms_cost_status', sms.last_owner_sms_cost_status");
    expect(migration).toContain('grant execute on function public.owner_list_jobs(timestamptz, timestamptz, text) to authenticated');
    expect(migration).not.toContain("'claim_token_hash'");
    expect(migration).not.toContain('app_fee_ledger_entries');
    expect(migration).not.toContain('payment_placeholders');
    expect(migration).not.toContain('business_settings');
  });

  it('keeps owner notification reads role-gated and SMS-placeholder only', () => {
    const migration = readFileSync('supabase/migrations/20260702193000_owner_notification_read_rpc.sql', 'utf8');
    expect(migration).toContain('create or replace function public.owner_list_notifications');
    expect(migration).toContain('perform public.assert_owner_or_developer()');
    expect(migration).toContain("'owner_sms_placeholder'");
    expect(migration).toContain("'provider', s.provider");
    expect(migration).toContain("'cost_status', s.cost_status");
    expect(migration).toContain("'action_required'");
    expect(migration).toContain("'booking', jsonb_build_object");
    expect(migration).toContain('grant execute on function public.owner_list_notifications(timestamptz, timestamptz, text) to authenticated');
    expect(migration).not.toContain("'claim_token_hash'");
    expect(migration).not.toContain('app_fee_ledger_entries');
    expect(migration).not.toContain('payment_placeholders');
    expect(migration).not.toContain('business_settings');
  });

  it('keeps owner report reads role-gated and ledger-only', () => {
    const migration = readFileSync('supabase/migrations/20260702195000_owner_reports_read_rpc.sql', 'utf8');
    expect(migration).toContain('create or replace function public.owner_get_report_snapshot');
    expect(migration).toContain('perform public.assert_owner_or_developer()');
    expect(migration).toContain('report range cannot exceed 370 days');
    expect(migration).toContain("'app_fee_visibility', 'hidden_from_customer'");
    expect(migration).toContain("'app_fee_routing_status', 'ledger_only'");
    expect(migration).toContain("'sms_cost_status', 'estimated_not_billed'");
    expect(migration).toContain("'live_payments', 'not_connected'");
    expect(migration).toContain('grant execute on function public.owner_get_report_snapshot(timestamptz, timestamptz) to authenticated');
    expect(migration).toContain('from public.payment_placeholders');
    expect(migration).toContain('from public.app_fee_ledger_entries');
    expect(migration).not.toContain('checkout_session_id');
    expect(migration).not.toContain('payment_intent_id');
    expect(migration).not.toContain('connected_account_id');
    expect(migration).not.toMatch(/stripe\.com|twilio|telnyx|service-role/i);
  });

  it('keeps public availability reads customer-safe without exposing owner notes', () => {
    const migration = readFileSync('supabase/migrations/20260702191000_public_availability_read_rpc.sql', 'utf8');
    expect(migration).toContain('create or replace function public.get_public_availability');
    expect(migration).toContain("where b.status in ('requested', 'confirmed')");
    expect(migration).toContain("'owner_block'::text as source");
    expect(migration).toContain("'booking'::text as source");
    expect(migration).toContain('availability range cannot exceed 370 days');
    expect(migration).toContain('grant execute on function public.get_public_availability(date, date) to anon, authenticated');
    expect(migration).not.toContain("'reason'");
    expect(migration).not.toContain('guest_name');
    expect(migration).not.toContain('guest_phone');
    expect(migration).not.toContain('claim_token_hash');
  });

  it('keeps a Supabase seed for current services and launch settings', () => {
    const seed = readFileSync('supabase/seed.sql', 'utf8');
    expect(seed).toContain("('basic', 'Basic Detail', 15000");
    expect(seed).toContain("('deluxe', 'Deluxe Detail', 22000");
    expect(seed).toContain("('premium', 'Premium Detail', 32000");
    expect(seed).toContain("('monthly', 'Monthly Maintenance', 10000");
    expect(seed).toContain("('business_name', '\"The Peoples Detailing\"'::jsonb)");
    expect(seed).toContain("('booking_submit_mode', '\"instant_book_no_payment\"'::jsonb)");
    expect(seed).toContain("('customer_pays_card_processing_fee', 'true'::jsonb)");
    expect(seed).toContain("('card_processing_percent', '2.9'::jsonb)");
    expect(seed).toContain("('card_processing_fixed_cents', '30'::jsonb)");
    expect(seed).toContain("('stripe_live_mode', '\"locked\"'::jsonb)");
    expect(seed).toContain("('owner_sms', 'queued_locally_only'");
    expect(seed).toContain("('maps_address_tools', 'planned_not_connected'");
    expect(seed).toContain("('google_calendar', 'planned_not_connected'");
  });
});
