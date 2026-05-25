import { getIntegrationStatus } from "../data/appDataLayer.js";

export const DEFAULT_OWNER_SMS_COST_CENTS = 1;

export const PRODUCTION_RECORD_BUCKETS = [
  "customers",
  "availabilityBlocks",
  "messages",
  "ownerAcknowledgments",
  "statusEvents",
  "paymentIntents",
  "appFeeLedgerEntries",
  "smsNotifications",
];

export function ensureProductionState(state = {}) {
  const normalized = { ...state };
  PRODUCTION_RECORD_BUCKETS.forEach(bucket => {
    normalized[bucket] = Array.isArray(normalized[bucket]) ? normalized[bucket] : [];
  });
  normalized.integrationStatus = normalized.integrationStatus || getIntegrationStatus();
  return normalized;
}

export function calculateOwnerSmsEstimateCents(count = 1, costCents = DEFAULT_OWNER_SMS_COST_CENTS) {
  return Math.max(0, Math.round(count * costCents));
}

export function calculateAppFeeLedgerNetCents(appFeeCents = 0, smsCostCents = 0) {
  return Math.max(0, Math.round(appFeeCents) - Math.round(smsCostCents));
}

export function createNearLiveRecordsForBooking(booking, settings = {}) {
  const now = Date.now();
  const appFeeCents = Math.max(0, booking.companyAppFeeCents ?? settings.companyAppFeeCents ?? 300);
  const smsCostCents = calculateOwnerSmsEstimateCents(1, settings.ownerSmsEstimateCents ?? DEFAULT_OWNER_SMS_COST_CENTS);
  const baseId = booking.id;
  const customerId = booking.customerId || `customer_${baseId}`;
  const paymentIntentId = `pi_preview_${baseId}`;

  return {
    customer: {
      id: customerId,
      bookingId: baseId,
      name: booking.customer?.name || "Customer",
      phone: booking.customer?.phone || "",
      vehicle: booking.customer?.vehicle || "",
      source: "booking_flow",
      createdAt: now,
    },
    message: {
      id: `msg_${baseId}_owner_notice`,
      bookingId: baseId,
      customerId,
      channel: "in_app",
      audience: "owner",
      direction: "system_to_owner",
      body: booking.status === "requested"
        ? "Short-notice/request booking needs Dane approval."
        : "New booking needs Dane acknowledgment.",
      createdAt: now,
    },
    ownerAcknowledgment: {
      id: `ack_${baseId}`,
      bookingId: baseId,
      status: booking.status === "confirmed" ? (booking.ownerAckStatus || "needs_ack") : "approval_needed",
      createdAt: now,
      acknowledgedAt: booking.ownerAcknowledgedAt || null,
    },
    statusEvent: {
      id: `event_${baseId}_created`,
      bookingId: baseId,
      type: booking.status === "requested" ? "booking_requested" : "booking_confirmed",
      status: booking.status,
      createdAt: now,
    },
    paymentIntent: {
      id: paymentIntentId,
      bookingId: baseId,
      provider: "stripe",
      mode: "test_mode_ready_not_connected",
      checkoutSessionId: null,
      paymentIntentId: null,
      connectedAccountId: null,
      applicationFeeAmountCents: appFeeCents,
      amountCents: booking.amountPaidTodayCents || 0,
      futureAmountCents: booking.totalCents || 0,
      depositCents: booking.depositCents ?? settings.depositCents ?? 2500,
      cardProcessingFeeCents: booking.cardProcessingFeeCents || 0,
      routingStatus: booking.appFeeRoutingStatus || "ledger_only",
      liveMode: false,
      createdAt: now,
    },
    appFeeLedgerEntry: {
      id: `ledger_${baseId}`,
      bookingId: baseId,
      paymentRecordId: paymentIntentId,
      grossAppFeeCents: appFeeCents,
      smsEstimateCents: smsCostCents,
      netBrandNewEstimateCents: calculateAppFeeLedgerNetCents(appFeeCents, smsCostCents),
      routingStatus: booking.appFeeRoutingStatus || "ledger_only",
      smsCostStatus: "estimated_not_billed",
      visibleToCustomer: false,
      createdAt: now,
    },
    smsNotification: {
      id: `sms_${baseId}_owner_new_booking`,
      bookingId: baseId,
      audience: "owner",
      provider: "not_connected",
      toRole: "owner",
      status: "would_send",
      costEstimateCents: smsCostCents,
      costStatus: "estimated_not_billed",
      bodyPreview: booking.status === "requested"
        ? `${booking.serviceTitle} request needs approval for ${booking.address || "service address"}.`
        : `${booking.serviceTitle} booked for ${booking.address || "service address"}.`,
      createdAt: now,
    },
  };
}

export function upsertById(list = [], record) {
  if (!record?.id) return list;
  const without = list.filter(item => item.id !== record.id);
  return [record, ...without];
}
