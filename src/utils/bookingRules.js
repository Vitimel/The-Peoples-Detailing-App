import { SETTINGS } from '../data/prototypeState.js';

export const SLOT_LABELS = ['8:00 AM', '10:00 AM', '12:00 PM', '2:00 PM', '4:00 PM'];

export const dateKey = dateLike => {
  const date = new Date(dateLike);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export const slotKey = (dateLike, label) => `${dateKey(dateLike)}|${label}`;

export const parseSlotLabel = label => {
  const [hStr, m] = label.split(/[: ]/);
  let h = parseInt(hStr, 10);
  if (label.includes('PM') && h !== 12) h += 12;
  if (label.includes('AM') && h === 12) h = 0;
  return { h, m: parseInt(m, 10) };
};

export const setDateTimeFromSlot = (dateLike, label) => {
  const { h, m } = parseSlotLabel(label);
  const d = new Date(dateLike);
  d.setHours(h, m, 0, 0);
  return d;
};

export const serviceDurationMinutes = service => {
  const nums = String(service?.durationHours || '2').match(/\d+(\.\d+)?/g)?.map(Number) || [2];
  return Math.max(...nums) * 60;
};

export const rangesOverlap = (aStart, aEnd, bStart, bEnd) => aStart < bEnd && bStart < aEnd;

export const normalizedSettings = settings => ({
  ...SETTINGS,
  ...(settings || {}),
  availabilityDefaultsVersion: SETTINGS.availabilityDefaultsVersion,
  depositCents: settings?.depositCents ?? SETTINGS.depositCents,
  companyAppFeeCents: settings?.companyAppFeeCents ?? SETTINGS.companyAppFeeCents,
  customerPaysCardProcessingFee: settings?.customerPaysCardProcessingFee ?? SETTINGS.customerPaysCardProcessingFee,
  cancelDepositForfeitDays: settings?.cancelDepositForfeitDays ?? SETTINGS.cancelDepositForfeitDays,
  rescheduleCutoffHours: settings?.rescheduleCutoffHours ?? settings?.rescheduleTimeoutHours ?? SETTINGS.rescheduleCutoffHours,
  minimumBookingNoticeHours: settings?.minimumBookingNoticeHours ?? SETTINGS.minimumBookingNoticeHours,
  workingHoursStart: settings?.workingHoursStart ?? SETTINGS.workingHoursStart,
  bufferMinutes: (settings?.availabilityDefaultsVersion ?? 0) >= SETTINGS.availabilityDefaultsVersion ? settings?.bufferMinutes ?? SETTINGS.bufferMinutes : SETTINGS.bufferMinutes,
  workingHoursEnd: (settings?.availabilityDefaultsVersion ?? 0) >= SETTINGS.availabilityDefaultsVersion ? settings?.workingHoursEnd ?? SETTINGS.workingHoursEnd : SETTINGS.workingHoursEnd,
  blockedDates: settings?.blockedDates || [],
  blockedSlots: settings?.blockedSlots || [],
});

export const hoursUntilBooking = booking => (new Date(booking.startIso).getTime() - Date.now()) / 36e5;

export const daysUntilBooking = booking => hoursUntilBooking(booking) / 24;

export const canCustomerReschedule = (booking, settings) => hoursUntilBooking(booking) >= (normalizedSettings(settings).rescheduleCutoffHours || 48);

export const customerCancelOutcome = (booking, settings) => {
  const paidOnline = booking.amountPaidTodayCents || 0;
  if (booking.status === 'requested' || paidOnline <= 0 || booking.paymentStatus === 'request_pending') {
    return {
      forfeit: false,
      paymentStatus: 'not_collected',
      cancellationOutcome: 'No payment collected',
    };
  }
  const forfeit = daysUntilBooking(booking) < (normalizedSettings(settings).cancelDepositForfeitDays || 7);
  return {
    forfeit,
    paymentStatus: forfeit ? 'cancelled_deposit_forfeited' : 'refunded',
    cancellationOutcome: forfeit ? 'Deposit forfeited' : 'Deposit refundable',
  };
};

export const availableSlotInfo = ({
  date,
  label,
  bookings = [],
  services = [],
  service,
  settings,
  activeBookingId,
  enforceMinimumNotice = true,
  nowMs = Date.now(),
}) => {
  const s = normalizedSettings(settings);
  const slotStart = setDateTimeFromSlot(date, label);
  const startHour = slotStart.getHours() + slotStart.getMinutes() / 60;
  const durationMinutes = serviceDurationMinutes(service) + (s.bufferMinutes || 0);
  const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60_000);
  const shortNotice = enforceMinimumNotice && slotStart.getTime() < nowMs + (s.minimumBookingNoticeHours || 0) * 60 * 60_000;

  if (s.blockedDates.includes(dateKey(slotStart))) return { available: false, reason: 'Blocked day' };
  if (s.blockedSlots.includes(slotKey(slotStart, label))) return { available: false, reason: 'Blocked time' };
  if (startHour < s.workingHoursStart || startHour >= s.workingHoursEnd) return { available: false, reason: 'Outside hours' };
  if (slotEnd.getHours() + slotEnd.getMinutes() / 60 > s.workingHoursEnd) return { available: false, reason: 'Needs more time' };

  const overlaps = bookings.some(b => {
    if (b.id === activeBookingId || b.status === 'cancelled' || b.status === 'declined') return false;
    const existingService = services.find(svc => svc.id === b.serviceId);
    const existingStart = new Date(b.startIso);
    const existingEnd = new Date(existingStart.getTime() + (serviceDurationMinutes(existingService) + (s.bufferMinutes || 0)) * 60_000);
    return rangesOverlap(slotStart, slotEnd, existingStart, existingEnd);
  });

  if (overlaps) return { available: false, reason: 'Booked' };
  return { available: true, reason: shortNotice ? 'Needs approval' : '', shortNotice };
};
