import { describe, expect, it } from 'vitest';
import {
  buildSupabaseGuestBookingPayload,
  mapSupabaseBookingRow,
  mapSupabaseBusinessSettingsRows,
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
      { key: 'unknown_future_key', value: 'ignored' },
    ])).toEqual({
      businessPhone: '(931) 334-0730',
      workingHoursEnd: 19.5,
      minimumBookingNoticeHours: 48,
      bookingSubmissionMode: 'instant_book_no_payment',
    });
  });

  it('maps booking rows into the current app booking shape', () => {
    expect(mapSupabaseBookingRow({
      id: 'booking-1',
      service_id: 'basic',
      service_title: 'Basic Detail',
      price_cents: 15000,
      start_at: '2026-07-05T14:00:00.000Z',
      address: '218 Demo Ave, Murfreesboro, TN',
      travel_miles: '12.4',
      travel_fee_cents: 400,
      discount_cents: 0,
      total_cents: 15400,
      status: 'requested',
      short_notice_request: true,
      owner_ack_status: 'approval_needed',
      guest_name: 'Tim',
      guest_phone: '(615) 555-0123',
      guest_vehicle_label: 'Daily driver',
      claim_token_hash: 'hash',
      claimed_by_user_id: null,
      created_at: '2026-07-02T15:00:00.000Z',
    })).toMatchObject({
      id: 'booking-1',
      serviceId: 'basic',
      serviceTitle: 'Basic Detail',
      priceCents: 15000,
      startIso: '2026-07-05T14:00:00.000Z',
      travelMiles: 12.4,
      totalCents: 15400,
      status: 'requested',
      shortNoticeRequest: true,
      ownerAckStatus: 'approval_needed',
      customerAccessMode: 'guest',
      guestName: 'Tim',
      customer: {
        name: 'Tim',
        phone: '(615) 555-0123',
        vehicle: 'Daily driver',
      },
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
});
