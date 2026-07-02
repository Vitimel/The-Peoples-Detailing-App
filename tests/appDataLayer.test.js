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

    await expect(adapter.createGuestBooking({
      serviceId: 'basic',
      date: '2026-07-05T14:00:00.000Z',
      address: '218 Demo Ave, Murfreesboro, TN',
      guestName: 'Tim',
      guestPhone: '(615) 555-0123',
      vehicleLabel: 'Daily driver',
    })).resolves.toBe('booking-id-123');
    expect(fetchImpl).toHaveBeenCalledWith('https://example.supabase.co/rest/v1/rpc/create_guest_booking', expect.objectContaining({
      method: 'POST',
    }));
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body).payload).toMatchObject({
      service_id: 'basic',
      start_at: '2026-07-05T14:00:00.000Z',
      address: '218 Demo Ave, Murfreesboro, TN',
      guest_name: 'Tim',
      guest_phone: '(615) 555-0123',
      guest_vehicle_label: 'Daily driver',
    });
  });

  it('maps future Supabase reads into app-facing shapes', async () => {
    const fetchImpl = vi.fn(async url => {
      const payload = url.includes('/services')
        ? [{ id: 'basic', title: 'Basic Detail', price_cents: 15000, duration_minutes: 180, buffer_minutes: 30, visible: true }]
        : url.includes('/business_settings')
          ? [{ key: 'minimum_booking_notice_hours', value: 48 }]
          : [{ id: 'booking-1', service_id: 'basic', service_title: 'Basic Detail', price_cents: 15000, start_at: '2026-07-05T14:00:00.000Z', address: '218 Demo Ave', status: 'confirmed' }];
      return {
        ok: true,
        status: 200,
        json: async () => payload,
      };
    });
    const adapter = createSupabaseRestAdapter({
      url: 'https://example.supabase.co/',
      anonKey: 'anon_test_key',
      fetchImpl,
    });

    await expect(adapter.loadServices()).resolves.toMatchObject([{ id: 'basic', priceCents: 15000, durationHours: '3' }]);
    await expect(adapter.loadBusinessSettings()).resolves.toEqual({ minimumBookingNoticeHours: 48 });
    await expect(adapter.loadCustomerBookings()).resolves.toMatchObject([{ id: 'booking-1', serviceId: 'basic', priceCents: 15000, startIso: '2026-07-05T14:00:00.000Z' }]);
  });
});
