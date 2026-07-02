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
    expect(status.dataAdapter.ownerOperationRpcs).toBe('repo_ready_not_applied');
    expect(status.dataAdapter.customerLifecycleRpcs).toBe('repo_ready_not_applied');
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

  it('defines future owner operation RPC calls without connecting a live backend', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => 'ok-id',
    }));
    const adapter = createSupabaseRestAdapter({
      url: 'https://example.supabase.co',
      anonKey: 'anon_test_key',
      fetchImpl,
    });

    await adapter.ownerAcknowledgeBooking('booking-1');
    await adapter.ownerDecideBookingRequest({ bookingId: 'booking-1', decision: 'confirm' });
    await adapter.ownerRequestBookingReschedule('booking-1');
    await adapter.ownerUpdateBookingTracker({ bookingId: 'booking-1', trackerStatus: 'arrived' });
    await adapter.ownerSetAvailabilityBlock({ type: 'time_slot', date: '2026-07-06', timeLabel: '10:00 AM', reason: 'Family appointment' });
    await adapter.ownerRemoveAvailabilityBlock('block-1');

    expect(fetchImpl.mock.calls.map(call => call[0])).toEqual([
      'https://example.supabase.co/rest/v1/rpc/owner_acknowledge_booking',
      'https://example.supabase.co/rest/v1/rpc/owner_decide_booking_request',
      'https://example.supabase.co/rest/v1/rpc/owner_request_booking_reschedule',
      'https://example.supabase.co/rest/v1/rpc/owner_update_booking_tracker',
      'https://example.supabase.co/rest/v1/rpc/owner_set_availability_block',
      'https://example.supabase.co/rest/v1/rpc/owner_remove_availability_block',
    ]);
    expect(JSON.parse(fetchImpl.mock.calls[1][1].body)).toEqual({
      booking_id_input: 'booking-1',
      decision: 'confirm',
    });
    expect(JSON.parse(fetchImpl.mock.calls[3][1].body)).toEqual({
      booking_id_input: 'booking-1',
      tracker_status_input: 'arrived',
    });
    expect(JSON.parse(fetchImpl.mock.calls[4][1].body)).toEqual({
      block_type_input: 'time_slot',
      block_date_input: '2026-07-06',
      time_label_input: '10:00 AM',
      reason_input: 'Family appointment',
    });
  });

  it('defines future customer lifecycle RPC calls without connecting a live backend', async () => {
    const fetchImpl = vi.fn(async url => {
      const payload = url.includes('/messages?select=')
        ? [{ id: 'msg-1', booking_id: 'booking-1', body: 'Hello', audience: 'owner', direction: 'inbound' }]
        : 'ok-id';
      return {
        ok: true,
        status: 200,
        json: async () => payload,
      };
    });
    const adapter = createSupabaseRestAdapter({
      url: 'https://example.supabase.co',
      anonKey: 'anon_test_key',
      fetchImpl,
    });

    await expect(adapter.loadBookingMessages('booking 1')).resolves.toMatchObject([{ id: 'msg-1', bookingId: 'booking-1', body: 'Hello' }]);
    await adapter.cancelBooking({ bookingId: 'booking-1', claimTokenHash: 'claim-hash', reason: 'Schedule changed' });
    await adapter.rescheduleBooking({ bookingId: 'booking-1', newStartAt: '2026-07-07T15:00:00.000Z', timeLabel: '10:00 AM', claimTokenHash: 'claim-hash' });
    await adapter.createBookingMessage({ bookingId: 'booking-1', body: 'Can I move this?', claimTokenHash: 'claim-hash' });

    expect(fetchImpl.mock.calls.map(call => call[0])).toEqual([
      'https://example.supabase.co/rest/v1/messages?select=*&booking_id=eq.booking%201&order=created_at.asc',
      'https://example.supabase.co/rest/v1/rpc/customer_cancel_booking',
      'https://example.supabase.co/rest/v1/rpc/reschedule_booking',
      'https://example.supabase.co/rest/v1/rpc/create_booking_message',
    ]);
    expect(JSON.parse(fetchImpl.mock.calls[1][1].body)).toEqual({
      booking_id_input: 'booking-1',
      claim_token_hash_input: 'claim-hash',
      reason_input: 'Schedule changed',
    });
    expect(JSON.parse(fetchImpl.mock.calls[2][1].body)).toMatchObject({
      booking_id_input: 'booking-1',
      new_start_at_input: '2026-07-07T15:00:00.000Z',
      time_label_input: '10:00 AM',
      claim_token_hash_input: 'claim-hash',
    });
    expect(JSON.parse(fetchImpl.mock.calls[3][1].body)).toEqual({
      booking_id_input: 'booking-1',
      body_input: 'Can I move this?',
      claim_token_hash_input: 'claim-hash',
    });
  });
});
