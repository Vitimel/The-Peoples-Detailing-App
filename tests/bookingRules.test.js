import { describe, expect, it, vi } from 'vitest';
import {
  SLOT_LABELS,
  availableSlotInfo,
  canCustomerReschedule,
  customerCancelOutcome,
  dateKey,
  normalizedSettings,
  serviceDurationMinutes,
  slotKey,
} from '../src/utils/bookingRules.js';
import { SERVICES, SETTINGS } from '../src/data/prototypeState.js';

const basic = SERVICES.find(service => service.id === 'basic');
const deluxe = SERVICES.find(service => service.id === 'deluxe');
const premium = SERVICES.find(service => service.id === 'premium');

const at = (daysFromNow, hour) => {
  const d = new Date('2026-07-02T12:00:00-05:00');
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, 0, 0, 0);
  return d;
};

describe('booking rules', () => {
  it('keeps service duration based on the longest range value', () => {
    expect(serviceDurationMinutes(basic)).toBe(180);
    expect(serviceDurationMinutes(deluxe)).toBe(300);
  });

  it('blocks explicit full days and individual time slots', () => {
    const date = at(5, 10);
    const settings = normalizedSettings({
      ...SETTINGS,
      blockedDates: [dateKey(date)],
      blockedSlots: [slotKey(date, '12:00 PM')],
    });

    expect(availableSlotInfo({ date, label: '10:00 AM', bookings: [], services: SERVICES, service: basic, settings }).reason).toBe('Blocked day');
    expect(availableSlotInfo({
      date,
      label: '12:00 PM',
      bookings: [],
      services: SERVICES,
      service: basic,
      settings: { ...settings, blockedDates: [] },
    }).reason).toBe('Blocked time');
  });

  it('prevents overlapping active bookings using service duration plus buffer', () => {
    const date = at(5, 10);
    const bookings = [{
      id: 'existing',
      serviceId: 'deluxe',
      status: 'confirmed',
      startIso: date.toISOString(),
    }];

    const result = availableSlotInfo({
      date,
      label: '12:00 PM',
      bookings,
      services: SERVICES,
      service: basic,
      settings: SETTINGS,
    });

    expect(result).toMatchObject({ available: false, reason: 'Booked' });
  });

  it('keeps otherwise open short-notice slots selectable but needing approval', () => {
    const now = at(0, 12).getTime();
    const date = at(1, 10);
    const result = availableSlotInfo({
      date,
      label: '10:00 AM',
      bookings: [],
      services: SERVICES,
      service: basic,
      settings: { ...SETTINGS, minimumBookingNoticeHours: 48 },
      nowMs: now,
    });

    expect(result).toEqual({ available: true, reason: 'Needs approval', shortNotice: true });
  });

  it('blocks long jobs that would end after the workday even when they cross midnight', () => {
    const date = at(5, 16);
    const result = availableSlotInfo({
      date,
      label: '4:00 PM',
      bookings: [],
      services: SERVICES,
      service: premium,
      settings: SETTINGS,
    });

    expect(result).toMatchObject({ available: false, reason: 'Needs more time' });
  });

  it('allows owner availability to expose the expected appointment slots', () => {
    expect(SLOT_LABELS).toEqual(['8:00 AM', '10:00 AM', '12:00 PM', '2:00 PM', '4:00 PM']);
  });

  it('enforces customer reschedule cutoff and cancellation deposit outcome', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-02T12:00:00-05:00'));

    const farBooking = { status: 'confirmed', amountPaidTodayCents: 2500, paymentStatus: 'balance_due', startIso: at(10, 10).toISOString() };
    const nearBooking = { status: 'confirmed', amountPaidTodayCents: 2500, paymentStatus: 'balance_due', startIso: at(1, 10).toISOString() };

    expect(canCustomerReschedule(farBooking, SETTINGS)).toBe(true);
    expect(canCustomerReschedule(nearBooking, SETTINGS)).toBe(false);
    expect(customerCancelOutcome(farBooking, SETTINGS)).toMatchObject({ forfeit: false, paymentStatus: 'refunded' });
    expect(customerCancelOutcome(nearBooking, SETTINGS)).toMatchObject({ forfeit: true, paymentStatus: 'cancelled_deposit_forfeited' });

    vi.useRealTimers();
  });
});
