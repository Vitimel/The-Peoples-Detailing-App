import { describe, expect, it } from 'vitest';
import {
  buildSupabaseAvailabilityBlockPayload,
  buildSupabaseBusinessSettingPayload,
  buildSupabaseCancelPayload,
  buildSupabaseCustomerBookingReadPayload,
  buildSupabaseGuestBookingPayload,
  buildSupabaseIntegrationStatusPayload,
  buildSupabaseMessagePayload,
  buildSupabaseOwnerJobsPayload,
  buildSupabaseOwnerNotificationsPayload,
  buildSupabasePublicAvailabilityPayload,
  buildSupabaseReschedulePayload,
  buildSupabaseRoleAssignmentPayload,
  buildSupabaseServiceUpdatePayload,
  mapSupabaseAvailabilityBlockRow,
  mapSupabaseBookingRow,
  mapSupabaseBusinessSettingsRows,
  mapSupabaseDeveloperAdminSnapshot,
  mapSupabaseMessageRow,
  mapSupabaseOwnerNotificationRow,
  mapSupabaseServiceRow,
} from '../src/data/supabaseMappings.js';

describe('Supabase mapping helpers', () => {
  it('maps service rows into the current app service shape', () => {
    expect(mapSupabaseServiceRow({
      id: 'basic',
      title: 'Basic Detail',
      price_cents: 15000,
      duration_minutes: 180,
      buffer_minutes: 30,
      visible: true,
    })).toMatchObject({
      id: 'basic',
      title: 'Basic Detail',
      priceCents: 15000,
      durationHours: '3',
      durationMinutes: 180,
      bufferMinutes: 30,
      cadence: 'Every 2-3 months',
    });
  });

  it('maps business settings rows into app settings names', () => {
    expect(mapSupabaseBusinessSettingsRows([
      { key: 'business_phone', value: '(931) 334-0730' },
      { key: 'working_hours_end', value: 19.5 },
      { key: 'minimum_booking_notice_hours', value: 48 },
      { key: 'booking_submit_mode', value: 'instant_book_no_payment' },
      { key: 'customer_pays_card_processing_fee', value: true },
      { key: 'card_processing_percent', value: 2.9 },
      { key: 'unknown_future_key', value: 'ignored' },
    ])).toEqual({
      businessPhone: '(931) 334-0730',
      workingHoursEnd: 19.5,
      minimumBookingNoticeHours: 48,
      bookingSubmissionMode: 'instant_book_no_payment',
      customerPaysCardProcessingFee: true,
      cardProcessingPercent: 2.9,
    });
  });

  it('maps booking rows into the current app booking shape', () => {
    expect(mapSupabaseBookingRow({
      id: 'booking-1',
      service_id: 'basic',
      service_title: 'Basic Detail',
      price_cents: 15000,
      start_at: '2026-07-05T14:00:00.000Z',
      end_at: '2026-07-05T17:30:00.000Z',
      address: '218 Demo Ave, Murfreesboro, TN',
      travel_miles: '12.4',
      travel_fee_cents: 400,
      discount_cents: 0,
      total_cents: 15400,
      status: 'requested',
      tracker_status: 'on_my_way',
      last_tracker_at: '2026-07-05T14:30:00.000Z',
      short_notice_request: true,
      owner_ack_status: 'approval_needed',
      guest_name: 'Tim',
      guest_phone: '(615) 555-0123',
      guest_vehicle_label: 'Daily driver',
      claim_token_hash: 'hash',
      claimed_by_user_id: null,
      confirmed_at: null,
      declined_at: null,
      reschedule_requested_at: null,
      cancelled_at: null,
      completed_at: null,
      payment_status: 'balance_due',
      cancellation_outcome: null,
      message_count: 2,
      owner_sms_status: 'would_send',
      owner_sms_cost_status: 'estimated_not_billed',
      created_at: '2026-07-02T15:00:00.000Z',
    })).toMatchObject({
      id: 'booking-1',
      serviceId: 'basic',
      serviceTitle: 'Basic Detail',
      priceCents: 15000,
      startIso: '2026-07-05T14:00:00.000Z',
      endIso: '2026-07-05T17:30:00.000Z',
      travelMiles: 12.4,
      totalCents: 15400,
      status: 'requested',
      trackerStatus: 'on_my_way',
      lastTrackerAt: '2026-07-05T14:30:00.000Z',
      shortNoticeRequest: true,
      ownerAckStatus: 'approval_needed',
      customerAccessMode: 'guest',
      guestName: 'Tim',
      customer: {
        name: 'Tim',
        phone: '(615) 555-0123',
        vehicle: 'Daily driver',
      },
      paymentStatus: 'balance_due',
      messageCount: 2,
      ownerSmsStatus: 'would_send',
      ownerSmsCostStatus: 'estimated_not_billed',
      requestedAt: '2026-07-02T15:00:00.000Z',
    });
  });

  it('builds the safe guest-booking RPC payload from an app draft', () => {
    expect(buildSupabaseGuestBookingPayload({
      serviceId: 'basic',
      date: '2026-07-05T14:00:00.000Z',
      timeLabel: '9:00 AM',
      address: '218 Demo Ave, Murfreesboro, TN',
      lat: 35.84,
      lng: -86.39,
      travelMiles: 4.2,
      travelFeeCents: 0,
      discountCents: 1000,
      guestName: 'Tim',
      guestPhone: '(615) 555-0123',
      vehicleLabel: 'Daily driver',
    })).toEqual({
      service_id: 'basic',
      start_at: '2026-07-05T14:00:00.000Z',
      time_label: '9:00 AM',
      address: '218 Demo Ave, Murfreesboro, TN',
      lat: 35.84,
      lng: -86.39,
      travel_miles: 4.2,
      travel_fee_cents: 0,
      discount_cents: 1000,
      guest_name: 'Tim',
      guest_phone: '(615) 555-0123',
      guest_vehicle_label: 'Daily driver',
    });
  });

  it('maps availability blocks for owner scheduling controls', () => {
    expect(mapSupabaseAvailabilityBlockRow({
      id: 'block-1',
      block_type: 'time_slot',
      block_date: '2026-07-06',
      time_label: '10:00 AM',
      reason: 'Family appointment',
      created_by: 'owner-user-id',
      created_at: '2026-07-02T15:00:00.000Z',
    })).toEqual({
      id: 'block-1',
      type: 'time_slot',
      date: '2026-07-06',
      timeLabel: '10:00 AM',
      reason: 'Family appointment',
      source: 'owner_block',
      status: null,
      createdBy: 'owner-user-id',
      createdAt: '2026-07-02T15:00:00.000Z',
    });

    expect(buildSupabaseAvailabilityBlockPayload({
      type: 'time_slot',
      date: '2026-07-06',
      timeLabel: '10:00 AM',
      reason: 'Family appointment',
    })).toEqual({
      block_type_input: 'time_slot',
      block_date_input: '2026-07-06',
      time_label_input: '10:00 AM',
      reason_input: 'Family appointment',
    });

    expect(mapSupabaseAvailabilityBlockRow({
      id: 'booking-1',
      block_type: 'time_slot',
      block_date: '2026-07-06',
      time_label: '10:00 AM',
      source: 'booking',
      status: 'confirmed',
    })).toMatchObject({
      id: 'booking-1',
      type: 'time_slot',
      date: '2026-07-06',
      timeLabel: '10:00 AM',
      source: 'booking',
      status: 'confirmed',
    });

    expect(buildSupabasePublicAvailabilityPayload({
      fromDate: '2026-07-01',
      toDate: '2026-07-31',
    })).toEqual({
      from_date_input: '2026-07-01',
      to_date_input: '2026-07-31',
    });
  });

  it('maps messages and lifecycle RPC payloads', () => {
    expect(mapSupabaseMessageRow({
      id: 'msg-1',
      booking_id: 'booking-1',
      customer_profile_id: 'profile-1',
      channel: 'in_app',
      audience: 'owner',
      direction: 'inbound',
      body: 'Can I move this?',
      created_at: '2026-07-02T15:00:00.000Z',
    })).toEqual({
      id: 'msg-1',
      bookingId: 'booking-1',
      customerProfileId: 'profile-1',
      channel: 'in_app',
      audience: 'owner',
      direction: 'inbound',
      body: 'Can I move this?',
      createdAt: '2026-07-02T15:00:00.000Z',
    });

    expect(buildSupabaseCancelPayload({
      bookingId: 'booking-1',
      claimToken: 'claim-token',
      reason: 'Schedule changed',
    })).toEqual({
      booking_id_input: 'booking-1',
      claim_token_hash_input: 'claim-token',
      reason_input: 'Schedule changed',
    });

    expect(buildSupabaseCustomerBookingReadPayload({
      bookingId: 'booking-1',
      claimToken: 'claim-token',
    })).toEqual({
      booking_id_input: 'booking-1',
      claim_token_hash_input: 'claim-token',
    });

    expect(buildSupabaseReschedulePayload({
      bookingId: 'booking-1',
      newStartAt: '2026-07-07T15:00:00.000Z',
      timeLabel: '10:00 AM',
      claimToken: 'claim-token',
      reason: 'Better day',
    })).toEqual({
      booking_id_input: 'booking-1',
      new_start_at_input: '2026-07-07T15:00:00.000Z',
      time_label_input: '10:00 AM',
      claim_token_hash_input: 'claim-token',
      reason_input: 'Better day',
    });

    expect(buildSupabaseMessagePayload({
      bookingId: 'booking-1',
      body: 'Can I move this?',
      claimToken: 'claim-token',
    })).toEqual({
      booking_id_input: 'booking-1',
      body_input: 'Can I move this?',
      claim_token_hash_input: 'claim-token',
    });

    expect(buildSupabaseOwnerJobsPayload({
      fromAt: '2026-07-01T00:00:00.000Z',
      toAt: '2026-08-01T00:00:00.000Z',
      statusFilter: 'needs_ack',
    })).toEqual({
      from_at_input: '2026-07-01T00:00:00.000Z',
      to_at_input: '2026-08-01T00:00:00.000Z',
      status_filter_input: 'needs_ack',
    });
  });

  it('maps owner notification rows without exposing backend internals', () => {
    expect(mapSupabaseOwnerNotificationRow({
      id: 'sms-1',
      booking_id: 'booking-1',
      notification_type: 'owner_sms_placeholder',
      audience: 'owner',
      provider: 'not_connected',
      status: 'would_send',
      cost_estimate_cents: 1,
      cost_status: 'estimated_not_billed',
      body_preview: 'New short-notice request from Tim.',
      action_required: true,
      created_at: '2026-07-02T15:00:00.000Z',
      booking: {
        id: 'booking-1',
        service_id: 'basic',
        service_title: 'Basic Detail',
        price_cents: 15000,
        start_at: '2026-07-05T14:00:00.000Z',
        status: 'requested',
        short_notice_request: true,
        owner_ack_status: 'approval_needed',
        guest_name: 'Tim',
        guest_phone: '(615) 555-0123',
        guest_vehicle_label: 'Daily driver',
      },
    })).toMatchObject({
      id: 'sms-1',
      bookingId: 'booking-1',
      notificationType: 'owner_sms_placeholder',
      provider: 'not_connected',
      status: 'would_send',
      costEstimateCents: 1,
      costStatus: 'estimated_not_billed',
      bodyPreview: 'New short-notice request from Tim.',
      actionRequired: true,
      booking: {
        id: 'booking-1',
        serviceId: 'basic',
        status: 'requested',
        shortNoticeRequest: true,
        ownerAckStatus: 'approval_needed',
      },
    });

    expect(buildSupabaseOwnerNotificationsPayload({
      fromAt: '2026-07-01T00:00:00.000Z',
      toAt: '2026-08-01T00:00:00.000Z',
      statusFilter: 'would_send',
    })).toEqual({
      from_at_input: '2026-07-01T00:00:00.000Z',
      to_at_input: '2026-08-01T00:00:00.000Z',
      status_filter_input: 'would_send',
    });
  });

  it('builds developer admin RPC payloads', () => {
    expect(buildSupabaseServiceUpdatePayload({
      id: 'basic',
      title: 'Basic Detail',
      priceCents: 15500,
      durationHours: 3,
      bufferMinutes: 30,
      visible: true,
    })).toEqual({
      service_id_input: 'basic',
      title_input: 'Basic Detail',
      price_cents_input: 15500,
      duration_minutes_input: 180,
      buffer_minutes_input: 30,
      visible_input: true,
    });

    expect(buildSupabaseBusinessSettingPayload({
      key: 'deposit_cents',
      value: 2500,
    })).toEqual({
      setting_key_input: 'deposit_cents',
      setting_value_input: 2500,
    });

    expect(buildSupabaseIntegrationStatusPayload({
      integrationId: 'stripe_live_mode',
      status: 'locked',
      details: 'Live payments require approval.',
    })).toEqual({
      integration_id_input: 'stripe_live_mode',
      status_input: 'locked',
      details_input: 'Live payments require approval.',
    });

    expect(buildSupabaseRoleAssignmentPayload({
      targetUserId: 'user-1',
      role: 'owner',
      name: 'Dane',
      phone: '(931) 334-0730',
    })).toEqual({
      target_user_id: 'user-1',
      new_role: 'owner',
      name_input: 'Dane',
      phone_input: '(931) 334-0730',
    });
  });

  it('maps the developer admin snapshot into safe admin shapes', () => {
    expect(mapSupabaseDeveloperAdminSnapshot({
      services: [
        { id: 'basic', title: 'Basic Detail', price_cents: 15000, duration_minutes: 180, buffer_minutes: 30, visible: true },
      ],
      developer_settings: {
        deposit_cents: 2500,
        company_app_fee_cents: 300,
        customer_pays_card_processing_fee: true,
        stripe_live_mode: 'locked',
        sms_provider: 'not_connected',
      },
      integrations: [
        { id: 'stripe_live_mode', status: 'locked', details: 'Live payments require approval.' },
      ],
      money_flow: {
        customer_sees_app_fee: false,
        app_fee_routing_status: 'ledger_only',
      },
      live_mode_locks: {
        stripe_live_mode: 'locked_until_explicit_approval',
      },
    })).toMatchObject({
      services: [{ id: 'basic', priceCents: 15000, durationMinutes: 180 }],
      developerSettings: {
        depositCents: 2500,
        companyAppFeeCents: 300,
        customerPaysCardProcessingFee: true,
        stripeLiveMode: 'locked',
        smsProvider: 'not_connected',
      },
      integrations: [{ id: 'stripe_live_mode', status: 'locked' }],
      moneyFlow: {
        customer_sees_app_fee: false,
        app_fee_routing_status: 'ledger_only',
      },
      liveModeLocks: {
        stripe_live_mode: 'locked_until_explicit_approval',
      },
    });
  });
});
