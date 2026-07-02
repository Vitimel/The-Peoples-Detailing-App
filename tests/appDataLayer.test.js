import { describe, expect, it, vi } from 'vitest';
import {
  createSupabaseRestAdapter,
  getActiveDataAdapter,
  getConfiguredBackendAdapter,
  getIntegrationStatus,
  getSupabaseConfigStatus,
} from '../src/data/appDataLayer.js';

describe('app data layer readiness', () => {
  it('keeps localStorage as the active adapter until Supabase is explicitly connected', () => {
    expect(getActiveDataAdapter().id).toBe('localStorage');
    expect(getIntegrationStatus().dataAdapter.active).toBe('localStorage');
  });

  it('reports Supabase as repo-ready but disabled without live env setup', () => {
    const status = getIntegrationStatus();
    expect(status.dataAdapter.supabase).toBe('repo_ready_disabled');
    expect(status.dataAdapter.bookingRpc).toBe('repo_ready_not_applied');
    expect(status.auth.rowLevelSecurity).toBe('repo_ready_requires_live_verification');
    expect(getSupabaseConfigStatus()).toMatchObject({
      configured: false,
      active: false,
      status: 'missing_frontend_env',
    });
    expect(getConfiguredBackendAdapter()).toBeNull();
  });

  it('defines the future Supabase RPC contract without requiring a paid service', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => 'booking-id-123',
    }));
    const adapter = createSupabaseRestAdapter({
      url: 'https://example.supabase.co/',
      anonKey: 'anon_test_key',
      fetchImpl,
    });

    await expect(adapter.createGuestBooking({ service_id: 'basic' })).resolves.toBe('booking-id-123');
    expect(fetchImpl).toHaveBeenCalledWith('https://example.supabase.co/rest/v1/rpc/create_guest_booking', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ payload: { service_id: 'basic' } }),
    }));
  });
});
