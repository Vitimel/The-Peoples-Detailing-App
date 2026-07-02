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

export const mapSupabaseDeveloperAdminSnapshot = snapshot => {
  const settingsRows = Object.entries(snapshot?.developer_settings || {}).map(([key, value]) => ({ key, value }));
  return {
    services: (snapshot?.services || []).map(mapSupabaseServiceRow),
    developerSettings: mapSupabaseBusinessSettingsRows(settingsRows),
    integrations: Array.isArray(snapshot?.integrations) ? snapshot.integrations : [],
    moneyFlow: snapshot?.money_flow || {},
    liveModeLocks: snapshot?.live_mode_locks || {},
  };
};

export const mapSupabaseLaunchReadiness = snapshot => ({
  status: snapshot?.status || "needs_attention",
  freePath: Boolean(snapshot?.free_path),
  missingTables: Array.isArray(snapshot?.missing_tables) ? snapshot.missing_tables : [],
  missingFunctions: Array.isArray(snapshot?.missing_functions) ? snapshot.missing_functions : [],
  unprotectedTables: Array.isArray(snapshot?.unprotected_tables) ? snapshot.unprotected_tables : [],
  integrationStatus: snapshot?.integration_status || {},
  businessLocks: snapshot?.business_locks || {},
  requiredBeforeCustomerData: Array.isArray(snapshot?.required_before_customer_data) ? snapshot.required_before_customer_data : [],
  notes: snapshot?.notes || {},
});

export const mapSupabaseCheckoutQuote = quote => ({
  serviceId: quote?.service_id || "",
  serviceTitle: quote?.service_title || "",
  servicePriceCents: numberOrNull(quote?.service_price_cents) ?? 0,
  travelFeeCents: numberOrNull(quote?.travel_fee_cents) ?? 0,
  discountCents: numberOrNull(quote?.discount_cents) ?? 0,
  subtotalCents: numberOrNull(quote?.subtotal_cents) ?? 0,
  jobTotalCents: numberOrNull(quote?.job_total_cents) ?? 0,
  paymentChoice: quote?.payment_choice || "deposit_cash_balance",
  amountPaidBeforeCardFeeCents: numberOrNull(quote?.amount_paid_before_card_fee_cents) ?? 0,
  cardProcessingFeeCents: numberOrNull(quote?.card_processing_fee_cents) ?? 0,
  totalDueTodayCents: numberOrNull(quote?.total_due_today_cents) ?? 0,
  balanceDueCents: numberOrNull(quote?.balance_due_cents) ?? 0,
  paymentStatus: quote?.payment_status || "not_collected",
  customerPaysCardProcessingFee: Boolean(quote?.customer_pays_card_processing_fee),
  cardProcessingPercent: numberOrNull(quote?.card_processing_percent) ?? 0,
  cardProcessingFixedCents: numberOrNull(quote?.card_processing_fixed_cents) ?? 0,
  appFeeVisibleToCustomer: Boolean(quote?.app_fee_visible_to_customer),
  appFeeRoutingStatus: quote?.app_fee_routing_status || "ledger_only",
  livePaymentStatus: quote?.live_payment_status || "not_connected",
  noRealPaymentCollected: quote?.no_real_payment_collected !== false,
});

export const mapSupabaseVehicleRow = row => ({
  id: row?.id,
  nickname: row?.nickname || "",
  year: row?.year || "",
  make: row?.make || "",
  model: row?.model || "",
  color: row?.color || "",
  plate: row?.plate || "",
  vin: row?.vin || "",
  isDefault: Boolean(row?.is_default),
  createdAt: row?.created_at || null,
  updatedAt: row?.updated_at || null,
});

export const mapSupabaseCustomerProfile = profile => ({
  id: profile?.id,
  userId: profile?.user_id || null,
  name: profile?.name || "",
  phone: profile?.phone || "",
  defaultVehicleId: profile?.default_vehicle_id || null,
  notificationPreference: profile?.notification_preference || "email",
  vehicles: (Array.isArray(profile?.vehicles) ? profile.vehicles : []).map(mapSupabaseVehicleRow),
  createdAt: profile?.created_at || null,
  updatedAt: profile?.updated_at || null,
});

export const mapSupabaseBookingRow = row => ({
  id: row?.id,
  serviceId: row?.service_id,
  serviceTitle: row?.service_title,
  priceCents: numberOrNull(row?.price_cents) ?? 0,
  startIso: row?.start_at,
  endIso: row?.end_at || null,
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
  customerAccessMode: row?.customer_access_mode || (row?.claimed_by_user_id ? "profile" : "guest"),
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
  messageCount: numberOrNull(row?.message_count) ?? 0,
  ownerSmsStatus: row?.owner_sms_status || null,
  ownerSmsCostStatus: row?.owner_sms_cost_status || null,
  closeoutStatus: row?.closeout_status || null,
  ownerAdjustmentCents: numberOrNull(row?.owner_adjustment_cents) ?? 0,
  ownerAdjustmentLabel: row?.owner_adjustment_label || "",
  adjustedJobTotalCents: numberOrNull(row?.adjusted_job_total_cents) ?? null,
  cashCollectedCents: numberOrNull(row?.cash_collected_cents) ?? 0,
  originalBalanceDueCents: numberOrNull(row?.original_balance_due_cents) ?? null,
  balanceDueCents: numberOrNull(row?.balance_due_cents) ?? null,
  refundNeededCents: numberOrNull(row?.refund_needed_cents) ?? 0,
  closeoutNote: row?.closeout_note || "",
  closedOutAt: row?.closed_out_at || null,
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
  source: row?.source || "owner_block",
  status: row?.status || null,
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

export const mapSupabaseTimelineEventRow = row => ({
  id: row?.id,
  bookingId: row?.booking_id || null,
  eventType: row?.event_type || "",
  status: row?.status || "",
  displayGroup: row?.display_group || "system",
  createdAt: row?.created_at || null,
});

export const mapSupabaseOwnerNotificationRow = row => ({
  id: row?.id,
  bookingId: row?.booking_id || row?.booking?.id || null,
  notificationType: row?.notification_type || "owner_sms_placeholder",
  audience: row?.audience || "owner",
  provider: row?.provider || "not_connected",
  status: row?.status || "would_send",
  costEstimateCents: numberOrNull(row?.cost_estimate_cents) ?? 0,
  costStatus: row?.cost_status || "estimated_not_billed",
  bodyPreview: row?.body_preview || "",
  actionRequired: Boolean(row?.action_required),
  sentAt: row?.sent_at || null,
  createdAt: row?.created_at || null,
  booking: row?.booking ? mapSupabaseBookingRow(row.booking) : null,
});

export const mapSupabaseOwnerReportSnapshot = snapshot => ({
  fromAt: snapshot?.from_at || null,
  toAt: snapshot?.to_at || null,
  summary: {
    bookingCount: numberOrNull(snapshot?.summary?.booking_count) ?? 0,
    completedCount: numberOrNull(snapshot?.summary?.completed_count) ?? 0,
    requestedCount: numberOrNull(snapshot?.summary?.requested_count) ?? 0,
    cancelledCount: numberOrNull(snapshot?.summary?.cancelled_count) ?? 0,
    grossJobTotalCents: numberOrNull(snapshot?.summary?.gross_job_total_cents) ?? 0,
    adjustedJobTotalCents: numberOrNull(snapshot?.summary?.adjusted_job_total_cents) ?? 0,
    onlinePaidCents: numberOrNull(snapshot?.summary?.online_paid_cents) ?? 0,
    cashCollectedCents: numberOrNull(snapshot?.summary?.cash_collected_cents) ?? 0,
    cashBalanceDueCents: numberOrNull(snapshot?.summary?.cash_balance_due_cents) ?? 0,
    ownerAdjustmentCents: numberOrNull(snapshot?.summary?.owner_adjustment_cents) ?? 0,
    cardProcessingFeeCents: numberOrNull(snapshot?.summary?.card_processing_fee_cents) ?? 0,
    appFeeCents: numberOrNull(snapshot?.summary?.app_fee_cents) ?? 0,
    smsEstimateCents: numberOrNull(snapshot?.summary?.sms_estimate_cents) ?? 0,
    brandnewNetEstimateCents: numberOrNull(snapshot?.summary?.brandnew_net_estimate_cents) ?? 0,
    forfeitedDepositCents: numberOrNull(snapshot?.summary?.forfeited_deposit_cents) ?? 0,
    refundNeededCents: numberOrNull(snapshot?.summary?.refund_needed_cents) ?? 0,
    routingStatus: snapshot?.summary?.routing_status || "ledger_only",
    smsCostStatus: snapshot?.summary?.sms_cost_status || "estimated_not_billed",
  },
  rows: (Array.isArray(snapshot?.rows) ? snapshot.rows : []).map(row => ({
    bookingId: row?.booking_id,
    serviceTitle: row?.service_title || "",
    startAt: row?.start_at || null,
    completedAt: row?.completed_at || null,
    status: row?.status || "",
    paymentStatus: row?.payment_status || "",
    cancellationOutcome: row?.cancellation_outcome || null,
    priceCents: numberOrNull(row?.price_cents) ?? 0,
    travelFeeCents: numberOrNull(row?.travel_fee_cents) ?? 0,
    discountCents: numberOrNull(row?.discount_cents) ?? 0,
    totalCents: numberOrNull(row?.total_cents) ?? 0,
    adjustedJobTotalCents: numberOrNull(row?.adjusted_job_total_cents) ?? null,
    ownerAdjustmentCents: numberOrNull(row?.owner_adjustment_cents) ?? 0,
    ownerAdjustmentLabel: row?.owner_adjustment_label || "",
    onlinePaidCents: numberOrNull(row?.online_paid_cents) ?? 0,
    depositCents: numberOrNull(row?.deposit_cents) ?? 0,
    cashCollectedCents: numberOrNull(row?.cash_collected_cents) ?? 0,
    cashBalanceDueCents: numberOrNull(row?.cash_balance_due_cents) ?? 0,
    refundNeededCents: numberOrNull(row?.refund_needed_cents) ?? 0,
    closeoutStatus: row?.closeout_status || null,
    cardProcessingFeeCents: numberOrNull(row?.card_processing_fee_cents) ?? 0,
    appFeeCents: numberOrNull(row?.app_fee_cents) ?? 0,
    smsEstimateCents: numberOrNull(row?.sms_estimate_cents) ?? 0,
    brandnewNetEstimateCents: numberOrNull(row?.brandnew_net_estimate_cents) ?? 0,
    appFeeRoutingStatus: row?.app_fee_routing_status || "ledger_only",
    smsCostStatus: row?.sms_cost_status || "estimated_not_billed",
    forfeitedDepositCents: numberOrNull(row?.forfeited_deposit_cents) ?? 0,
  })),
  notes: snapshot?.notes || {},
});

export const buildSupabaseAvailabilityBlockPayload = block => ({
  block_type_input: block?.block_type || block?.type || "full_day",
  block_date_input: block?.block_date || block?.date || "",
  time_label_input: block?.time_label || block?.timeLabel || null,
  reason_input: block?.reason || null,
});

export const buildSupabasePublicAvailabilityPayload = input => ({
  from_date_input: input?.from_date || input?.fromDate || null,
  to_date_input: input?.to_date || input?.toDate || null,
});

export const buildSupabaseCheckoutQuotePayload = input => ({
  payload: {
    service_id: input?.service_id || input?.serviceId || "",
    travel_fee_cents: input?.travel_fee_cents ?? input?.travelFeeCents ?? 0,
    discount_cents: input?.discount_cents ?? input?.discountCents ?? 0,
    payment_choice: input?.payment_choice || input?.paymentChoice || "deposit_cash_balance",
  },
});

export const buildSupabaseCancelPayload = input => ({
  booking_id_input: input?.booking_id || input?.bookingId || input,
  claim_token_hash_input: input?.claim_token || input?.claimToken || input?.claim_token_hash || input?.claimTokenHash || null,
  reason_input: input?.reason || null,
});

export const buildSupabaseCustomerBookingReadPayload = input => ({
  booking_id_input: input?.booking_id || input?.bookingId || input,
  claim_token_hash_input: input?.claim_token || input?.claimToken || input?.claim_token_hash || input?.claimTokenHash || null,
});

export const buildSupabaseBookingTimelinePayload = input => ({
  booking_id_input: input?.booking_id || input?.bookingId || input,
  claim_token_hash_input: input?.claim_token || input?.claimToken || input?.claim_token_hash || input?.claimTokenHash || null,
});

export const buildSupabaseGuestClaimPayload = input => ({
  booking_id_input: input?.booking_id || input?.bookingId || "",
  claim_token_hash_input: input?.claim_token || input?.claimToken || input?.claim_token_hash || input?.claimTokenHash || null,
});

export const buildSupabaseReschedulePayload = input => ({
  booking_id_input: input?.booking_id || input?.bookingId || "",
  new_start_at_input: input?.new_start_at || input?.newStartAt || input?.startIso || input?.date || "",
  time_label_input: input?.time_label || input?.timeLabel || timeLabelFromDate(input?.new_start_at || input?.newStartAt || input?.startIso || input?.date),
  claim_token_hash_input: input?.claim_token || input?.claimToken || input?.claim_token_hash || input?.claimTokenHash || null,
  reason_input: input?.reason || null,
});

export const buildSupabaseMessagePayload = input => ({
  booking_id_input: input?.booking_id || input?.bookingId || "",
  body_input: input?.body || "",
  claim_token_hash_input: input?.claim_token || input?.claimToken || input?.claim_token_hash || input?.claimTokenHash || null,
});

export const buildSupabaseOwnerJobsPayload = input => ({
  from_at_input: input?.from_at || input?.fromAt || null,
  to_at_input: input?.to_at || input?.toAt || null,
  status_filter_input: input?.status_filter || input?.statusFilter || null,
});

export const buildSupabaseOwnerNotificationsPayload = input => ({
  from_at_input: input?.from_at || input?.fromAt || null,
  to_at_input: input?.to_at || input?.toAt || null,
  status_filter_input: input?.status_filter || input?.statusFilter || null,
});

export const buildSupabaseOwnerReportPayload = input => ({
  from_at_input: input?.from_at || input?.fromAt || null,
  to_at_input: input?.to_at || input?.toAt || null,
});

export const buildSupabaseOwnerCloseoutPayload = input => ({
  booking_id_input: input?.booking_id || input?.bookingId || "",
  owner_adjustment_cents_input: input?.owner_adjustment_cents ?? input?.ownerAdjustmentCents ?? input?.adjustmentCents ?? 0,
  owner_adjustment_label_input: input?.owner_adjustment_label || input?.ownerAdjustmentLabel || input?.adjustmentLabel || null,
  cash_collected_cents_input: input?.cash_collected_cents ?? input?.cashCollectedCents ?? 0,
  closeout_note_input: input?.closeout_note || input?.closeoutNote || null,
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

export const buildSupabaseRoleAssignmentPayload = input => ({
  target_user_id: input?.target_user_id || input?.targetUserId || "",
  new_role: input?.new_role || input?.role || "customer",
  name_input: input?.name || null,
  phone_input: input?.phone || null,
});

export const buildSupabaseCustomerProfilePayload = input => ({
  name_input: input?.name || null,
  phone_input: input?.phone || null,
  notification_preference_input: input?.notification_preference || input?.notificationPreference || "email",
});

export const buildSupabaseVehiclePayload = input => ({
  vehicle_id_input: input?.vehicle_id || input?.vehicleId || input?.id || null,
  nickname_input: input?.nickname || input?.name || "",
  year_input: input?.year || null,
  make_input: input?.make || null,
  model_input: input?.model || null,
  color_input: input?.color || null,
  plate_input: input?.plate || null,
  vin_input: input?.vin || null,
  is_default_input: Boolean(input?.is_default ?? input?.isDefault),
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
