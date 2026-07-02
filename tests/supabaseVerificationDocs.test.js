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
      'create_guest_booking',
      'short-notice',
      'blocked full day',
      'blocked time slot',
      'overlapping active booking',
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
    expect(smoke).toContain("provider = 'not_connected'");
    expect(smoke).toContain("status = 'would_send'");
    expect(smoke).toContain('visible_to_customer');
    expect(smoke).toContain('live_mode');
    expect(smoke).not.toMatch(/twilio|telnyx|stripe\.com|service-role/i);
  });
});
