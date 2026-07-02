import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

describe('Supabase live verification docs', () => {
  it('keeps every migration in the free setup order', () => {
    const setup = read('docs/SUPABASE_FREE_SETUP_STEPS.md');
    const migrations = fs
      .readdirSync(path.join(root, 'supabase/migrations'))
      .filter(file => file.endsWith('.sql'))
      .sort();

    for (const migration of migrations) {
      expect(setup).toContain(`supabase/migrations/${migration}`);
    }

    expect(setup).toContain('supabase/seed.sql');
    expect(setup).toContain('supabase/verification/live_smoke_checks.sql');
    expect(setup).toContain('docs/SUPABASE_LIVE_VERIFICATION_CHECKLIST.md');
  });

  it('documents the live checks that prove backend business logic before cutover', () => {
    const checklist = read('docs/SUPABASE_LIVE_VERIFICATION_CHECKLIST.md');
    const requiredPhrases = [
      'npm run verify:supabase-api',
      'SUPABASE_DEVELOPER_EMAIL',
      'SUPABASE_CUSTOMER_B_PASSWORD',
      'create_guest_booking',
      'get_customer_booking',
      'get_customer_booking_messages',
      'owner_list_jobs',
      'raw `claim_token`',
      'claim_token_hash',
      'short-notice',
      'blocked full day',
      'blocked time slot',
      'overlapping active booking',
      'bookings_no_active_overlap',
      'owner SMS placeholder',
      'provider = not_connected',
      'live_mode = false',
      'visible_to_customer = false',
      'Customer A cannot read Customer B bookings',
      'Dane owner can acknowledge',
      'Tim developer can update',
      'cannot unlock `stripe_live_mode`',
      'cannot activate a real SMS provider',
      'Keep `VITE_USE_SUPABASE=false`',
      'Live Stripe charges',
      'Live SMS sends',
    ];

    for (const phrase of requiredPhrases) {
      expect(checklist).toContain(phrase);
    }
  });

  it('keeps the SQL smoke check scoped to free non-provider verification', () => {
    const smoke = read('supabase/verification/live_smoke_checks.sql');
    expect(smoke).toContain('rollback;');
    expect(smoke).toContain('public.create_guest_booking');
    expect(smoke).toContain('public.get_customer_booking');
    expect(smoke).toContain('public.get_customer_booking_messages');
    expect(smoke).toContain('owner_list_jobs');
    expect(smoke).toContain('bookings_no_active_overlap');
    expect(smoke).toContain("smoke_booking_result->>'claim_token'");
    expect(smoke).toContain("provider = 'not_connected'");
    expect(smoke).toContain("status = 'would_send'");
    expect(smoke).toContain('visible_to_customer');
    expect(smoke).toContain('live_mode');
    expect(smoke).not.toMatch(/twilio|telnyx|stripe\.com|service-role/i);
  });

  it('exposes a no-dependency Supabase API/RLS runner without live-provider keys', () => {
    const packageJson = JSON.parse(read('package.json'));
    const runner = read('scripts/verify-supabase-api.mjs');

    expect(packageJson.scripts['verify:supabase-api']).toBe('node scripts/verify-supabase-api.mjs --mutating');
    expect(runner).toContain('SUPABASE_URL');
    expect(runner).toContain('SUPABASE_ANON_KEY');
    expect(runner).toContain('SUPABASE_DEVELOPER_EMAIL');
    expect(runner).toContain('developer_assign_app_role');
    expect(runner).toContain('owner_acknowledge_booking');
    expect(runner).toContain('claim_guest_booking');
    expect(runner).toContain('get_customer_booking');
    expect(runner).toContain('get_customer_booking_messages');
    expect(runner).toContain('owner_list_jobs');
    expect(runner).toContain('claimToken');
    expect(runner).toContain('Raw claim token was stored instead of a hash');
    expect(runner).toContain('owner_set_availability_block');
    expect(runner).toContain('company_app_fee_cents');
    expect(runner).toContain('stripe_live_mode');
    expect(runner).toContain('sms_provider');
    expect(runner).not.toMatch(/SERVICE_ROLE|service-role|STRIPE_SECRET|TWILIO_AUTH|TELNYX_API/i);
  });
});
