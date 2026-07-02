import { describe, expect, it, vi } from 'vitest';
import {
  createSupabaseAuthAdapter,
  createSupabaseRestAdapter,
  getActiveDataAdapter,
  getConfiguredAuthAdapter,
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
    expect(status.dataAdapter.bookingOverlapConstraint).toBe('repo_ready_not_applied');
    expect(status.dataAdapter.ownerOperationRpcs).toBe('repo_ready_not_applied');
    expect(status.dataAdapter.ownerCloseoutRpcs).toBe('repo_ready_not_applied');
    expect(status.dataAdapter.ownerReadRpcs).toBe('repo_ready_not_applied');
    expect(status.dataAdapter.ownerNotificationReadRpcs).toBe('repo_ready_not_applied');
    expect(status.dataAdapter.ownerReportReadRpcs).toBe('repo_ready_not_applied');
    expect(status.dataAdapter.customerLifecycleRpcs).toBe('repo_ready_not_applied');
    expect(status.dataAdapter.customerReadRpcs).toBe('repo_ready_not_applied');
    expect(status.dataAdapter.customerHistoryReadRpcs).toBe('repo_ready_not_applied');
    expect(status.dataAdapter.customerProfileVehicleRpcs).toBe('repo_ready_not_applied');
    expect(status.dataAdapter.messageReadRpcs).toBe('repo_ready_not_applied');
    expect(status.dataAdapter.publicAvailabilityReadRpcs).toBe('repo_ready_not_applied');
    expect(status.dataAdapter.developerAdminRpcs).toBe('repo_ready_not_applied');
    expect(status.dataAdapter.developerAdminReadRpcs).toBe('repo_ready_not_applied');
    expect(status.dataAdapter.authRoleRpcs).toBe('repo_ready_not_applied');
    expect(status.auth.supabaseAccessTokenAdapter).toBe('repo_ready_not_live');
    expect(status.auth.rowLevelSecurity).toBe('repo_ready_requires_live_verification');
    expect(getSupabaseConfigStatus()).toMatchObject({
      configured: false,
      active: false,
      status: 'missing_frontend_env',
    });
    expect(getConfiguredBackendAdapter()).toBeNull();
    expect(getConfiguredAuthAdapter()).toBeNull();
  });

  it('defines the future Supabase RPC contract without requiring a paid service', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        booking_id: 'booking-id-123',
        claim_token: 'claim-token-123',
        status: 'confirmed',
        short_notice_request: false,
      }),
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
    })).resolves.toEqual({
      bookingId: 'booking-id-123',
      claimToken: 'claim-token-123',
      status: 'confirmed',
      shortNoticeRequest: false,
    });
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
          : url.includes('/rpc/get_customer_bookings')
            ? [{ id: 'booking-1', service_id: 'basic', service_title: 'Basic Detail', price_cents: 15000, start_at: '2026-07-05T14:00:00.000Z', end_at: '2026-07-05T17:30:00.000Z', address: '218 Demo Ave', status: 'confirmed', customer_access_mode: 'profile' }]
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
    await expect(adapter.loadCustomerBookings()).resolves.toMatchObject([{ id: 'booking-1', serviceId: 'basic', priceCents: 15000, startIso: '2026-07-05T14:00:00.000Z', customerAccessMode: 'profile' }]);
    expect(fetchImpl.mock.calls.map(call => call[0])).toContain('https://example.supabase.co/rest/v1/rpc/get_customer_bookings');
  });

  it('uses a Supabase user access token when one is available', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => 'ok-id',
    }));
    const adapter = createSupabaseRestAdapter({
      url: 'https://example.supabase.co',
      anonKey: 'anon_test_key',
      accessToken: 'user_access_token',
      fetchImpl,
    });

    await adapter.ownerAcknowledgeBooking('booking-1');

    expect(fetchImpl).toHaveBeenCalledWith('https://example.supabase.co/rest/v1/rpc/owner_acknowledge_booking', expect.objectContaining({
      headers: expect.objectContaining({
        apikey: 'anon_test_key',
        Authorization: 'Bearer user_access_token',
      }),
    }));
  });

  it('can resolve a fresh Supabase user token for each request', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => 'ok-id',
    }));
    const getAccessToken = vi.fn()
      .mockResolvedValueOnce('first_user_token')
      .mockResolvedValueOnce('second_user_token');
    const adapter = createSupabaseRestAdapter({
      url: 'https://example.supabase.co',
      anonKey: 'anon_test_key',
      getAccessToken,
      fetchImpl,
    });

    await adapter.ownerAcknowledgeBooking('booking-1');
    await adapter.developerUpdateBusinessSetting({ key: 'deposit_cents', value: 2500 });

    expect(getAccessToken).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBe('Bearer first_user_token');
    expect(fetchImpl.mock.calls[1][1].headers.Authorization).toBe('Bearer second_user_token');
  });

  it('defines a no-dependency Supabase Auth REST contract', async () => {
    const fetchImpl = vi.fn(async url => {
      const payload = url.includes('/auth/v1/user')
        ? { id: 'user-1', email: 'tim@example.com' }
        : url.includes('/auth/v1/logout')
          ? null
          : {
              access_token: 'session_access_token',
              refresh_token: 'session_refresh_token',
              expires_in: 3600,
              token_type: 'bearer',
              user: { id: 'user-1', email: 'tim@example.com' },
            };
      return {
        ok: true,
        status: 200,
        text: async () => payload ? JSON.stringify(payload) : '',
      };
    });
    const auth = createSupabaseAuthAdapter({
      url: 'https://example.supabase.co/',
      anonKey: 'anon_test_key',
      fetchImpl,
    });

    await expect(auth.signUpWithEmail({
      email: 'tim@example.com',
      password: 'test-password',
      name: 'Tim',
      phone: '(615) 555-0123',
    })).resolves.toMatchObject({
      accessToken: 'session_access_token',
      refreshToken: 'session_refresh_token',
      user: { id: 'user-1', email: 'tim@example.com' },
    });
    await expect(auth.signInWithPassword({
      email: 'tim@example.com',
      password: 'test-password',
    })).resolves.toMatchObject({ accessToken: 'session_access_token' });
    await expect(auth.getUser('session_access_token')).resolves.toMatchObject({
      user: { id: 'user-1', email: 'tim@example.com' },
    });
    await expect(auth.signOut('session_access_token')).resolves.toEqual({ ok: true });

    expect(fetchImpl.mock.calls.map(call => call[0])).toEqual([
      'https://example.supabase.co/auth/v1/signup',
      'https://example.supabase.co/auth/v1/token?grant_type=password',
      'https://example.supabase.co/auth/v1/user',
      'https://example.supabase.co/auth/v1/logout',
    ]);
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual({
      email: 'tim@example.com',
      password: 'test-password',
      data: {
        name: 'Tim',
        phone: '(615) 555-0123',
      },
    });
    expect(fetchImpl.mock.calls[2][1]).toMatchObject({
      method: 'GET',
      headers: expect.objectContaining({
        apikey: 'anon_test_key',
        Authorization: 'Bearer session_access_token',
      }),
    });
    expect(fetchImpl.mock.calls[3][1].headers.Authorization).toBe('Bearer session_access_token');
  });

  it('surfaces Supabase Auth REST errors without using service-role keys', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: false,
      status: 400,
      text: async () => JSON.stringify({ msg: 'Invalid login credentials' }),
    }));
    const auth = createSupabaseAuthAdapter({
      url: 'https://example.supabase.co',
      anonKey: 'anon_test_key',
      fetchImpl,
    });

    await expect(auth.signInWithPassword({
      email: 'tim@example.com',
      password: 'bad-password',
    })).rejects.toThrow('Invalid login credentials');
    expect(fetchImpl.mock.calls[0][1].headers).toMatchObject({
      apikey: 'anon_test_key',
      Authorization: 'Bearer anon_test_key',
    });
  });

  it('defines future owner operation RPC calls without connecting a live backend', async () => {
    const fetchImpl = vi.fn(async url => {
      const payload = url.includes('/rpc/get_public_availability')
        ? [{ id: 'booking-1', block_type: 'time_slot', block_date: '2026-07-06', time_label: '10:00 AM', source: 'booking', status: 'confirmed' }]
        : url.includes('/rpc/owner_list_notifications')
          ? [{
              id: 'sms-1',
              booking_id: 'booking-1',
              notification_type: 'owner_sms_placeholder',
              audience: 'owner',
              provider: 'not_connected',
              status: 'would_send',
              cost_estimate_cents: 1,
              cost_status: 'estimated_not_billed',
              body_preview: 'New booking needs attention',
              action_required: true,
              booking: {
                id: 'booking-1',
                service_id: 'basic',
                service_title: 'Basic Detail',
                price_cents: 15000,
                start_at: '2026-07-06T15:00:00.000Z',
                status: 'requested',
                short_notice_request: true,
                owner_ack_status: 'approval_needed',
                guest_name: 'Tim',
                guest_phone: '(615) 555-0123',
                guest_vehicle_label: 'Daily driver',
              },
            }]
          : url.includes('/rpc/owner_get_report_snapshot')
            ? {
                from_at: '2026-07-01T00:00:00.000Z',
                to_at: '2026-08-01T00:00:00.000Z',
                summary: {
                  booking_count: 1,
                  gross_job_total_cents: 15000,
                  online_paid_cents: 2500,
                  app_fee_cents: 300,
                  sms_estimate_cents: 1,
                  brandnew_net_estimate_cents: 299,
                  routing_status: 'ledger_only',
                },
                rows: [{ booking_id: 'booking-1', service_title: 'Basic Detail', total_cents: 15000, app_fee_cents: 300 }],
              }
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

    await adapter.ownerAcknowledgeBooking('booking-1');
    await adapter.ownerDecideBookingRequest({ bookingId: 'booking-1', decision: 'confirm' });
    await adapter.ownerRequestBookingReschedule('booking-1');
    await adapter.ownerUpdateBookingTracker({ bookingId: 'booking-1', trackerStatus: 'arrived' });
    await adapter.ownerCloseoutBooking({
      bookingId: 'booking-1',
      adjustmentCents: 1000,
      adjustmentLabel: 'Owner adjustment',
      cashCollectedCents: 11500,
      closeoutNote: 'Customer paid cash.',
    });
    await adapter.ownerSetAvailabilityBlock({ type: 'time_slot', date: '2026-07-06', timeLabel: '10:00 AM', reason: 'Family appointment' });
    await adapter.ownerRemoveAvailabilityBlock('block-1');
    await expect(adapter.loadOwnerJobs({
      fromAt: '2026-07-01T00:00:00.000Z',
      toAt: '2026-08-01T00:00:00.000Z',
      statusFilter: 'needs_ack',
    })).resolves.toEqual([]);
    await expect(adapter.loadOwnerNotifications({
      fromAt: '2026-07-01T00:00:00.000Z',
      toAt: '2026-08-01T00:00:00.000Z',
      statusFilter: 'would_send',
    })).resolves.toMatchObject([{
      id: 'sms-1',
      bookingId: 'booking-1',
      provider: 'not_connected',
      status: 'would_send',
      costEstimateCents: 1,
      costStatus: 'estimated_not_billed',
      bodyPreview: 'New booking needs attention',
      actionRequired: true,
      booking: {
        id: 'booking-1',
        status: 'requested',
        ownerAckStatus: 'approval_needed',
        guestName: 'Tim',
      },
    }]);
    await expect(adapter.loadOwnerReportSnapshot({
      fromAt: '2026-07-01T00:00:00.000Z',
      toAt: '2026-08-01T00:00:00.000Z',
    })).resolves.toMatchObject({
      fromAt: '2026-07-01T00:00:00.000Z',
      summary: {
        bookingCount: 1,
        grossJobTotalCents: 15000,
        appFeeCents: 300,
        smsEstimateCents: 1,
        brandnewNetEstimateCents: 299,
        routingStatus: 'ledger_only',
      },
      rows: [{ bookingId: 'booking-1', serviceTitle: 'Basic Detail', totalCents: 15000 }],
    });
    await expect(adapter.loadAvailabilityBlocks({
      fromDate: '2026-07-01',
      toDate: '2026-07-31',
    })).resolves.toMatchObject([{
      id: 'booking-1',
      type: 'time_slot',
      date: '2026-07-06',
      timeLabel: '10:00 AM',
      source: 'booking',
      status: 'confirmed',
    }]);

    expect(fetchImpl.mock.calls.map(call => call[0])).toEqual([
      'https://example.supabase.co/rest/v1/rpc/owner_acknowledge_booking',
      'https://example.supabase.co/rest/v1/rpc/owner_decide_booking_request',
      'https://example.supabase.co/rest/v1/rpc/owner_request_booking_reschedule',
      'https://example.supabase.co/rest/v1/rpc/owner_update_booking_tracker',
      'https://example.supabase.co/rest/v1/rpc/owner_closeout_booking',
      'https://example.supabase.co/rest/v1/rpc/owner_set_availability_block',
      'https://example.supabase.co/rest/v1/rpc/owner_remove_availability_block',
      'https://example.supabase.co/rest/v1/rpc/owner_list_jobs',
      'https://example.supabase.co/rest/v1/rpc/owner_list_notifications',
      'https://example.supabase.co/rest/v1/rpc/owner_get_report_snapshot',
      'https://example.supabase.co/rest/v1/rpc/get_public_availability',
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
      booking_id_input: 'booking-1',
      owner_adjustment_cents_input: 1000,
      owner_adjustment_label_input: 'Owner adjustment',
      cash_collected_cents_input: 11500,
      closeout_note_input: 'Customer paid cash.',
    });
    expect(JSON.parse(fetchImpl.mock.calls[5][1].body)).toEqual({
      block_type_input: 'time_slot',
      block_date_input: '2026-07-06',
      time_label_input: '10:00 AM',
      reason_input: 'Family appointment',
    });
    expect(JSON.parse(fetchImpl.mock.calls[7][1].body)).toEqual({
      from_at_input: '2026-07-01T00:00:00.000Z',
      to_at_input: '2026-08-01T00:00:00.000Z',
      status_filter_input: 'needs_ack',
    });
    expect(JSON.parse(fetchImpl.mock.calls[8][1].body)).toEqual({
      from_at_input: '2026-07-01T00:00:00.000Z',
      to_at_input: '2026-08-01T00:00:00.000Z',
      status_filter_input: 'would_send',
    });
    expect(JSON.parse(fetchImpl.mock.calls[9][1].body)).toEqual({
      from_at_input: '2026-07-01T00:00:00.000Z',
      to_at_input: '2026-08-01T00:00:00.000Z',
    });
    expect(JSON.parse(fetchImpl.mock.calls[10][1].body)).toEqual({
      from_date_input: '2026-07-01',
      to_date_input: '2026-07-31',
    });
  });

  it('defines future customer lifecycle RPC calls without connecting a live backend', async () => {
    const fetchImpl = vi.fn(async url => {
      const payload = url.includes('/rpc/get_customer_booking_messages')
        ? [{ id: 'msg-2', booking_id: 'booking-1', body: 'Guest read', audience: 'customer', direction: 'outbound' }]
        : url.includes('/rpc/get_customer_booking')
          ? { id: 'booking-1', service_id: 'basic', service_title: 'Basic Detail', price_cents: 15000, start_at: '2026-07-05T14:00:00.000Z', end_at: '2026-07-05T17:30:00.000Z', status: 'confirmed', guest_name: 'Tim' }
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

    await expect(adapter.loadBookingMessages({ bookingId: 'booking-1', claimToken: 'claim-token' })).resolves.toMatchObject([{ id: 'msg-2', bookingId: 'booking-1', body: 'Guest read' }]);
    await expect(adapter.loadCustomerBooking({ bookingId: 'booking-1', claimToken: 'claim-token' })).resolves.toMatchObject({ id: 'booking-1', serviceId: 'basic', endIso: '2026-07-05T17:30:00.000Z', guestName: 'Tim' });
    await expect(adapter.loadCustomerBookingMessages({ bookingId: 'booking-1', claimToken: 'claim-token' })).resolves.toMatchObject([{ id: 'msg-2', bookingId: 'booking-1', body: 'Guest read' }]);
    await adapter.cancelBooking({ bookingId: 'booking-1', claimToken: 'claim-token', reason: 'Schedule changed' });
    await adapter.rescheduleBooking({ bookingId: 'booking-1', newStartAt: '2026-07-07T15:00:00.000Z', timeLabel: '10:00 AM', claimToken: 'claim-token' });
    await adapter.createBookingMessage({ bookingId: 'booking-1', body: 'Can I move this?', claimToken: 'claim-token' });

    expect(fetchImpl.mock.calls.map(call => call[0])).toEqual([
      'https://example.supabase.co/rest/v1/rpc/get_customer_booking_messages',
      'https://example.supabase.co/rest/v1/rpc/get_customer_booking',
      'https://example.supabase.co/rest/v1/rpc/get_customer_booking_messages',
      'https://example.supabase.co/rest/v1/rpc/customer_cancel_booking',
      'https://example.supabase.co/rest/v1/rpc/reschedule_booking',
      'https://example.supabase.co/rest/v1/rpc/create_booking_message',
    ]);
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual({
      booking_id_input: 'booking-1',
      claim_token_hash_input: 'claim-token',
    });
    expect(JSON.parse(fetchImpl.mock.calls[1][1].body)).toEqual({
      booking_id_input: 'booking-1',
      claim_token_hash_input: 'claim-token',
    });
    expect(JSON.parse(fetchImpl.mock.calls[2][1].body)).toEqual({
      booking_id_input: 'booking-1',
      claim_token_hash_input: 'claim-token',
    });
    expect(JSON.parse(fetchImpl.mock.calls[3][1].body)).toEqual({
      booking_id_input: 'booking-1',
      claim_token_hash_input: 'claim-token',
      reason_input: 'Schedule changed',
    });
    expect(JSON.parse(fetchImpl.mock.calls[4][1].body)).toMatchObject({
      booking_id_input: 'booking-1',
      new_start_at_input: '2026-07-07T15:00:00.000Z',
      time_label_input: '10:00 AM',
      claim_token_hash_input: 'claim-token',
    });
    expect(JSON.parse(fetchImpl.mock.calls[5][1].body)).toEqual({
      booking_id_input: 'booking-1',
      body_input: 'Can I move this?',
      claim_token_hash_input: 'claim-token',
    });
  });

  it('defines future customer profile and vehicle RPC calls without connecting a live backend', async () => {
    const profilePayload = {
      id: 'profile-1',
      user_id: 'user-1',
      name: 'Tim',
      phone: '(615) 555-0123',
      default_vehicle_id: 'vehicle-1',
      notification_preference: 'email',
      vehicles: [{
        id: 'vehicle-1',
        nickname: 'Daily driver',
        year: '2021',
        make: 'Toyota',
        model: 'Camry',
        is_default: true,
      }],
    };
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => profilePayload,
    }));
    const adapter = createSupabaseRestAdapter({
      url: 'https://example.supabase.co',
      anonKey: 'anon_test_key',
      accessToken: 'customer_access_token',
      fetchImpl,
    });

    await expect(adapter.loadMyCustomerProfile()).resolves.toMatchObject({
      id: 'profile-1',
      userId: 'user-1',
      defaultVehicleId: 'vehicle-1',
      vehicles: [{ id: 'vehicle-1', nickname: 'Daily driver', isDefault: true }],
    });
    await expect(adapter.upsertMyCustomerProfile({
      name: 'Tim',
      phone: '(615) 555-0123',
      notificationPreference: 'sms',
    })).resolves.toMatchObject({ id: 'profile-1' });
    await expect(adapter.upsertMyVehicle({
      id: 'vehicle-1',
      nickname: 'Daily driver',
      year: '2021',
      make: 'Toyota',
      model: 'Camry',
      isDefault: true,
    })).resolves.toMatchObject({ vehicles: [{ id: 'vehicle-1' }] });
    await expect(adapter.deleteMyVehicle('vehicle-1')).resolves.toMatchObject({ id: 'profile-1' });

    expect(fetchImpl.mock.calls.map(call => call[0])).toEqual([
      'https://example.supabase.co/rest/v1/rpc/get_my_customer_profile',
      'https://example.supabase.co/rest/v1/rpc/upsert_my_customer_profile',
      'https://example.supabase.co/rest/v1/rpc/upsert_my_vehicle',
      'https://example.supabase.co/rest/v1/rpc/delete_my_vehicle',
    ]);
    expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBe('Bearer customer_access_token');
    expect(JSON.parse(fetchImpl.mock.calls[1][1].body)).toEqual({
      name_input: 'Tim',
      phone_input: '(615) 555-0123',
      notification_preference_input: 'sms',
    });
    expect(JSON.parse(fetchImpl.mock.calls[2][1].body)).toMatchObject({
      vehicle_id_input: 'vehicle-1',
      nickname_input: 'Daily driver',
      year_input: '2021',
      make_input: 'Toyota',
      model_input: 'Camry',
      is_default_input: true,
    });
    expect(JSON.parse(fetchImpl.mock.calls[3][1].body)).toEqual({
      vehicle_id_input: 'vehicle-1',
    });
  });

  it('defines future developer admin RPC calls without connecting a live backend', async () => {
    const fetchImpl = vi.fn(async url => {
      const payload = url.includes('/rpc/developer_get_admin_snapshot')
        ? {
            services: [{ id: 'basic', title: 'Basic Detail', price_cents: 15000, duration_minutes: 180, buffer_minutes: 30, visible: true }],
            developer_settings: { deposit_cents: 2500, company_app_fee_cents: 300, stripe_live_mode: 'locked', sms_provider: 'not_connected' },
            integrations: [{ id: 'stripe_live_mode', status: 'locked', details: 'Live payments require approval.' }],
            money_flow: { customer_sees_app_fee: false, app_fee_routing_status: 'ledger_only' },
            live_mode_locks: { stripe_live_mode: 'locked_until_explicit_approval' },
          }
        : url.includes('/integration_status?select=')
        ? [{ id: 'stripe_live_mode', status: 'locked', details: 'Live payments require approval.' }]
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

    await expect(adapter.loadIntegrationStatus()).resolves.toEqual([
      { id: 'stripe_live_mode', status: 'locked', details: 'Live payments require approval.' },
    ]);
    await expect(adapter.loadDeveloperAdminSnapshot()).resolves.toMatchObject({
      services: [{ id: 'basic', priceCents: 15000 }],
      developerSettings: { depositCents: 2500, companyAppFeeCents: 300 },
      moneyFlow: { customer_sees_app_fee: false },
      liveModeLocks: { stripe_live_mode: 'locked_until_explicit_approval' },
    });
    await adapter.developerUpdateService({
      id: 'basic',
      title: 'Basic Detail',
      priceCents: 15500,
      durationHours: 3,
      bufferMinutes: 30,
      visible: true,
    });
    await adapter.developerUpdateBusinessSetting({ key: 'deposit_cents', value: 2500 });
    await adapter.developerUpdateIntegrationStatus({
      integrationId: 'stripe_live_mode',
      status: 'locked',
      details: 'Live payments require approval.',
    });
    await adapter.developerAssignAppRole({
      targetUserId: 'user-1',
      role: 'owner',
      name: 'Dane',
      phone: '(931) 334-0730',
    });

    expect(fetchImpl.mock.calls.map(call => call[0])).toEqual([
      'https://example.supabase.co/rest/v1/integration_status?select=*&order=id.asc',
      'https://example.supabase.co/rest/v1/rpc/developer_get_admin_snapshot',
      'https://example.supabase.co/rest/v1/rpc/developer_update_service',
      'https://example.supabase.co/rest/v1/rpc/developer_update_business_setting',
      'https://example.supabase.co/rest/v1/rpc/developer_update_integration_status',
      'https://example.supabase.co/rest/v1/rpc/developer_assign_app_role',
    ]);
    expect(JSON.parse(fetchImpl.mock.calls[2][1].body)).toEqual({
      service_id_input: 'basic',
      title_input: 'Basic Detail',
      price_cents_input: 15500,
      duration_minutes_input: 180,
      buffer_minutes_input: 30,
      visible_input: true,
    });
    expect(JSON.parse(fetchImpl.mock.calls[3][1].body)).toEqual({
      setting_key_input: 'deposit_cents',
      setting_value_input: 2500,
    });
    expect(JSON.parse(fetchImpl.mock.calls[4][1].body)).toEqual({
      integration_id_input: 'stripe_live_mode',
      status_input: 'locked',
      details_input: 'Live payments require approval.',
    });
    expect(JSON.parse(fetchImpl.mock.calls[5][1].body)).toEqual({
      target_user_id: 'user-1',
      new_role: 'owner',
      name_input: 'Dane',
      phone_input: '(931) 334-0730',
    });
  });
});
