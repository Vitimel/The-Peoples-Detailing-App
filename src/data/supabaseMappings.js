const SERVICE_PRESENTATION_FALLBACKS = {
  basic: {
    cadence: "Every 2-3 months",
    blurb: "Essential clean for your daily driver.",
    bullets: [
      "Hand wash & dry using premium microfiber towels",
      "Clay bar treatment to remove light contaminants",
      "Carnauba wax application for glossy finish",
      "Wheel & tire clean with shine",
      "Interior vacuum & surface wipe",
      "Window & mirror cleaning inside",
      "Basic upholstery/leather wipe and deodorizer",
    ],
  },
  deluxe: {
    cadence: "Every 3-4 months",
    blurb: "Deeper clean. Longer protection. Premium feel.",
    bullets: [
      "Includes all Basic services",
      "Machine polish removes minor swirls",
      "Synthetic paint sealant for long protection",
      "Deep wheel cleaning & tire dressing",
      "Steam clean carpets & upholstery",
      "Leather conditioning and deep panel clean",
      "Ozone odor treatment if needed",
    ],
  },
  premium: {
    cadence: "Every 6-12 months",
    blurb: "The ultimate in protection & shine.",
    bullets: [
      "All Deluxe services included",
      "Multi-stage paint correction",
      "Ceramic coating (6-12 months protection)",
      "Engine bay cleaning & dressing",
      "Headlight restoration & glass sealant",
      "Full interior steam extraction",
      "Deep leather/fabric treatment & sanitization",
    ],
  },
  monthly: {
    cadence: "Between details",
    blurb: "Keep your ride clean every month.",
    bullets: [
      "Hand wash & quick wax",
      "Light wheel & tire clean",
      "Interior vacuum & surface wipe",
      "Spot stain cleaning as needed",
      "Window & mirror cleaning",
      "Light deodorizing",
    ],
    badge: "/mo",
  },
};

const SETTINGS_KEY_MAP = {
  business_name: "businessName",
  business_phone: "businessPhone",
  base_address: "baseAddress",
  working_hours_start: "workingHoursStart",
  working_hours_end: "workingHoursEnd",
  minimum_booking_notice_hours: "minimumBookingNoticeHours",
  reschedule_cutoff_hours: "rescheduleCutoffHours",
  cancel_deposit_forfeit_days: "cancelDepositForfeitDays",
  free_travel_radius_miles: "freeTravelRadiusMiles",
  per_mile_fee_cents: "perMileFeeCents",
  company_app_fee_cents: "companyAppFeeCents",
  deposit_cents: "depositCents",
  customer_pays_card_processing_fee: "customerPaysCardProcessingFee",
  card_processing_percent: "cardProcessingPercent",
  card_processing_fixed_cents: "cardProcessingFixedCents",
  card_processing_info_text: "cardProcessingInfoText",
  owner_sms_estimate_cents: "ownerSmsEstimateCents",
  booking_submit_mode: "bookingSubmissionMode",
  stripe_live_mode: "stripeLiveMode",
  sms_provider: "smsProvider",
};

const numberOrNull = value => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const durationLabelFromRow = row => {
  const minutes = numberOrNull(row?.duration_minutes);
  if (minutes) {
    const hours = minutes / 60;
    return Number.isInteger(hours) ? String(hours) : String(hours).replace(/\.0$/, "");
  }
  return String(row?.duration_hours || "2");
};

export const mapSupabaseServiceRow = row => {
  const fallback = SERVICE_PRESENTATION_FALLBACKS[row?.id] || {};
  return {
    id: row?.id,
    title: row?.title || "Detail Service",
    priceCents: numberOrNull(row?.price_cents) ?? 0,
    durationHours: durationLabelFromRow(row),
    durationMinutes: numberOrNull(row?.duration_minutes) ?? null,
    bufferMinutes: numberOrNull(row?.buffer_minutes) ?? null,
    visible: row?.visible !== false,
    ...fallback,
  };
};

export const mapSupabaseBusinessSettingsRows = rows => {
  return (Array.isArray(rows) ? rows : []).reduce((settings, row) => {
    const key = SETTINGS_KEY_MAP[row?.key];
    if (!key) return settings;
    return {
      ...settings,
      [key]: row.value,
    };
  }, {});
};

export const mapSupabaseBookingRow = row => ({
  id: row?.id,
  serviceId: row?.service_id,
  serviceTitle: row?.service_title,
  priceCents: numberOrNull(row?.price_cents) ?? 0,
  startIso: row?.start_at,
  address: row?.address || "",
  lat: numberOrNull(row?.lat),
  lng: numberOrNull(row?.lng),
  travelMiles: numberOrNull(row?.travel_miles) ?? 0,
  travelFeeCents: numberOrNull(row?.travel_fee_cents) ?? 0,
  discountCents: numberOrNull(row?.discount_cents) ?? 0,
  totalCents: numberOrNull(row?.total_cents) ?? 0,
  status: row?.status || "confirmed",
  trackerStatus: row?.tracker_status || null,
  lastTrackerAt: row?.last_tracker_at || null,
  shortNoticeRequest: Boolean(row?.short_notice_request),
  ownerAckStatus: row?.owner_ack_status || null,
  customerAccessMode: row?.claimed_by_user_id ? "profile" : "guest",
  guestName: row?.guest_name || "",
  guestPhone: row?.guest_phone || "",
  guestVehicleLabel: row?.guest_vehicle_label || "",
  customer: {
    name: row?.guest_name || "Customer",
    phone: row?.guest_phone || "",
    vehicle: row?.guest_vehicle_label || "",
  },
  claimTokenHash: row?.claim_token_hash || null,
  claimedByUserId: row?.claimed_by_user_id || null,
  claimedAt: row?.claimed_at || null,
  confirmedAt: row?.confirmed_at || null,
  declinedAt: row?.declined_at || null,
  rescheduleRequestedAt: row?.reschedule_requested_at || null,
  cancelledAt: row?.cancelled_at || null,
  completedAt: row?.completed_at || null,
  paymentStatus: row?.payment_status || null,
  cancellationOutcome: row?.cancellation_outcome || null,
  requestedAt: row?.status === "requested" ? row?.created_at || null : null,
  createdAt: row?.created_at || null,
  updatedAt: row?.updated_at || null,
});

export const mapSupabaseAvailabilityBlockRow = row => ({
  id: row?.id,
  type: row?.block_type,
  date: row?.block_date,
  timeLabel: row?.time_label || null,
  reason: row?.reason || "",
  createdBy: row?.created_by || null,
  createdAt: row?.created_at || null,
});

export const mapSupabaseMessageRow = row => ({
  id: row?.id,
  bookingId: row?.booking_id || null,
  customerProfileId: row?.customer_profile_id || null,
  channel: row?.channel || "in_app",
  audience: row?.audience || "",
  direction: row?.direction || "",
  body: row?.body || "",
  createdAt: row?.created_at || null,
});

export const buildSupabaseAvailabilityBlockPayload = block => ({
  block_type_input: block?.block_type || block?.type || "full_day",
  block_date_input: block?.block_date || block?.date || "",
  time_label_input: block?.time_label || block?.timeLabel || null,
  reason_input: block?.reason || null,
});

export const buildSupabaseCancelPayload = input => ({
  booking_id_input: input?.booking_id || input?.bookingId || input,
  claim_token_hash_input: input?.claim_token_hash || input?.claimTokenHash || null,
  reason_input: input?.reason || null,
});

export const buildSupabaseReschedulePayload = input => ({
  booking_id_input: input?.booking_id || input?.bookingId || "",
  new_start_at_input: input?.new_start_at || input?.newStartAt || input?.startIso || input?.date || "",
  time_label_input: input?.time_label || input?.timeLabel || timeLabelFromDate(input?.new_start_at || input?.newStartAt || input?.startIso || input?.date),
  claim_token_hash_input: input?.claim_token_hash || input?.claimTokenHash || null,
  reason_input: input?.reason || null,
});

export const buildSupabaseMessagePayload = input => ({
  booking_id_input: input?.booking_id || input?.bookingId || "",
  body_input: input?.body || "",
  claim_token_hash_input: input?.claim_token_hash || input?.claimTokenHash || null,
});

export const buildSupabaseServiceUpdatePayload = service => {
  const durationMinutes = service?.duration_minutes
    ?? service?.durationMinutes
    ?? Math.round(Number(service?.durationHours || service?.duration_hours || 2) * 60);
  return {
    service_id_input: service?.id || service?.serviceId || "",
    title_input: service?.title || "",
    price_cents_input: service?.price_cents ?? service?.priceCents ?? 0,
    duration_minutes_input: durationMinutes,
    buffer_minutes_input: service?.buffer_minutes ?? service?.bufferMinutes ?? 30,
    visible_input: service?.visible ?? true,
  };
};

export const buildSupabaseBusinessSettingPayload = ({ key, value }) => ({
  setting_key_input: key,
  setting_value_input: value,
});

export const buildSupabaseIntegrationStatusPayload = input => ({
  integration_id_input: input?.id || input?.integrationId || "",
  status_input: input?.status || "",
  details_input: input?.details || null,
});

const timeLabelFromDate = dateLike => {
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
};

export const buildSupabaseGuestBookingPayload = draft => {
  const startAt = draft?.start_at || draft?.startIso || draft?.date || "";
  return {
    service_id: draft?.service_id || draft?.serviceId || "",
    start_at: startAt,
    time_label: draft?.time_label || draft?.timeLabel || timeLabelFromDate(startAt),
    address: draft?.address || "",
    lat: draft?.lat ?? null,
    lng: draft?.lng ?? null,
    travel_miles: draft?.travel_miles ?? draft?.travelMiles ?? 0,
    travel_fee_cents: draft?.travel_fee_cents ?? draft?.travelFeeCents ?? 0,
    discount_cents: draft?.discount_cents ?? draft?.discountCents ?? 0,
    guest_name: draft?.guest_name || draft?.guestName || draft?.customer?.name || "",
    guest_phone: draft?.guest_phone || draft?.guestPhone || draft?.customer?.phone || "",
    guest_vehicle_label: draft?.guest_vehicle_label || draft?.guestVehicleLabel || draft?.vehicleLabel || draft?.customer?.vehicle || "",
  };
};
