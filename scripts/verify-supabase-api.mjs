#!/usr/bin/env node

const requiredEnv = [
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_DEVELOPER_EMAIL",
  "SUPABASE_DEVELOPER_PASSWORD",
  "SUPABASE_OWNER_EMAIL",
  "SUPABASE_OWNER_PASSWORD",
  "SUPABASE_CUSTOMER_A_EMAIL",
  "SUPABASE_CUSTOMER_A_PASSWORD",
  "SUPABASE_CUSTOMER_B_EMAIL",
  "SUPABASE_CUSTOMER_B_PASSWORD",
];

const args = new Set(process.argv.slice(2));
const allowMutating = args.has("--mutating");

const env = key => process.env[key] || "";
const baseUrl = env("SUPABASE_URL").replace(/\/+$/, "");
const anonKey = env("SUPABASE_ANON_KEY");
const unique = `api-smoke-${Date.now()}`;
const results = [];

const log = (status, label, details = "") => {
  const line = `${status === "pass" ? "PASS" : "FAIL"} ${label}${details ? ` - ${details}` : ""}`;
  results.push({ status, label, details });
  console.log(line);
};

const fail = (label, details) => {
  log("fail", label, details);
  throw new Error(`${label}: ${details}`);
};

const requireEnvironment = () => {
  const missing = requiredEnv.filter(key => !env(key));
  if (missing.length) {
    fail("environment", `Missing ${missing.join(", ")}`);
  }
  if (!allowMutating) {
    fail("mutating flag", "Run with --mutating against a fresh/test Supabase project. This script creates verification records.");
  }
};

const headersFor = token => ({
  apikey: anonKey,
  Authorization: `Bearer ${token || anonKey}`,
  "Content-Type": "application/json",
});

const request = async (path, { token, method = "GET", body, ok = true } = {}) => {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: headersFor(token),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (ok && !response.ok) {
    throw new Error(`${method} ${path} failed ${response.status}: ${text}`);
  }
  return { response, data, text };
};

const expectRejected = async (label, call) => {
  const { response, text } = await call();
  if (response.ok) {
    fail(label, "Expected request to be rejected, but it succeeded");
  }
  log("pass", label, `rejected with ${response.status}${text ? ` (${text.slice(0, 120)})` : ""}`);
};

const signIn = async ({ email, password, label }) => {
  const { data } = await request("/auth/v1/token?grant_type=password", {
    method: "POST",
    body: { email, password },
  });
  if (!data?.access_token || !data?.user?.id) {
    fail(`${label} sign in`, "Supabase Auth did not return an access token and user id");
  }
  log("pass", `${label} sign in`, data.user.id);
  return { token: data.access_token, userId: data.user.id, email };
};

const rpc = (name, body, token, options = {}) => request(`/rest/v1/rpc/${name}`, {
  method: "POST",
  body,
  token,
  ...options,
});

const select = (table, query = "select=*", token, options = {}) => request(`/rest/v1/${table}?${query}`, {
  token,
  ...options,
});

const centralDate = daysAhead => {
  const now = new Date();
  now.setUTCDate(now.getUTCDate() + daysAhead);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now).reduce((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
};

const bookingPayload = ({ daysAhead, timeLabel = "10:00 AM", name, addressSuffix = "" }) => ({
  service_id: "basic",
  start_at: `${centralDate(daysAhead)} ${timeLabel} America/Chicago`,
  time_label: timeLabel,
  address: `218 Demo Ave ${addressSuffix}, Murfreesboro, TN`,
  guest_name: name,
  guest_phone: "(615) 555-0100",
  guest_vehicle_label: "API smoke vehicle",
  travel_fee_cents: 0,
});

const singleRow = (rows, label) => {
  if (!Array.isArray(rows) || rows.length !== 1) {
    fail(label, `Expected exactly one row, got ${Array.isArray(rows) ? rows.length : typeof rows}`);
  }
  return rows[0];
};

const main = async () => {
  requireEnvironment();

  const services = await select("services", "select=*&visible=eq.true&order=title.asc");
  if (!Array.isArray(services.data) || services.data.length < 1) fail("public services", "No visible services returned to anon");
  log("pass", "anon can read public services", `${services.data.length} visible services`);

  const settings = await select("business_settings", "select=key,value");
  const settingKeys = new Set((settings.data || []).map(row => row.key));
  if (!settingKeys.has("business_name") || !settingKeys.has("minimum_booking_notice_hours")) {
    fail("public safe business settings", "Expected business_name and minimum_booking_notice_hours");
  }
  for (const hiddenKey of ["company_app_fee_cents", "owner_sms_estimate_cents", "sms_provider"]) {
    if (settingKeys.has(hiddenKey)) fail("hidden business settings", `${hiddenKey} was visible through anon REST`);
  }
  log("pass", "anon reads only safe business settings");

  const quote = await rpc("get_checkout_quote", {
    payload: {
      service_id: "basic",
      travel_fee_cents: 400,
      discount_cents: 0,
      payment_choice: "deposit_cash_balance",
    },
  });
  if (quote.data?.service_id !== "basic" || quote.data?.payment_choice !== "deposit_cash_balance") {
    fail("anon checkout quote", "Checkout quote did not return the requested service/payment shape");
  }
  if (quote.data?.app_fee_visible_to_customer !== false) {
    fail("anon checkout quote", "Checkout quote made the hidden app fee visible");
  }
  if (quote.data?.live_payment_status !== "not_connected" || quote.data?.no_real_payment_collected !== true) {
    fail("anon checkout quote", "Checkout quote did not preserve no-real-payment status");
  }
  const quoteText = JSON.stringify(quote.data);
  for (const forbidden of ["company_app_fee_cents", "app_fee_cents", "payment_placeholders", "app_fee_ledger_entries", "sms_notifications"]) {
    if (quoteText.includes(forbidden)) fail("anon checkout quote", `Checkout quote exposed ${forbidden}`);
  }
  log("pass", "anon can load customer-safe checkout quote");

  const developer = await signIn({
    email: env("SUPABASE_DEVELOPER_EMAIL"),
    password: env("SUPABASE_DEVELOPER_PASSWORD"),
    label: "developer",
  });
  const owner = await signIn({
    email: env("SUPABASE_OWNER_EMAIL"),
    password: env("SUPABASE_OWNER_PASSWORD"),
    label: "owner",
  });
  const customerA = await signIn({
    email: env("SUPABASE_CUSTOMER_A_EMAIL"),
    password: env("SUPABASE_CUSTOMER_A_PASSWORD"),
    label: "customer A",
  });
  const customerB = await signIn({
    email: env("SUPABASE_CUSTOMER_B_EMAIL"),
    password: env("SUPABASE_CUSTOMER_B_PASSWORD"),
    label: "customer B",
  });

  await rpc("developer_assign_app_role", {
    target_user_id: owner.userId,
    new_role: "owner",
    name_input: "Dane API Smoke",
    phone_input: "(931) 334-0730",
  }, developer.token);
  log("pass", "developer can assign owner role");

  await rpc("developer_assign_app_role", {
    target_user_id: customerA.userId,
    new_role: "customer",
    name_input: "Customer A API Smoke",
    phone_input: "(615) 555-0101",
  }, developer.token);
  await rpc("developer_assign_app_role", {
    target_user_id: customerB.userId,
    new_role: "customer",
    name_input: "Customer B API Smoke",
    phone_input: "(615) 555-0102",
  }, developer.token);
  log("pass", "developer can keep test customers as customer role");

  await expectRejected("customer cannot call owner RPC", () => rpc("owner_acknowledge_booking", {
    booking_id_input: "00000000-0000-0000-0000-000000000000",
  }, customerA.token, { ok: false }));

  await expectRejected("customer cannot call owner job queue RPC", () => rpc("owner_list_jobs", {
    from_at_input: null,
    to_at_input: null,
    status_filter_input: null,
  }, customerA.token, { ok: false }));

  await expectRejected("customer cannot call owner notification RPC", () => rpc("owner_list_notifications", {
    from_at_input: null,
    to_at_input: null,
    status_filter_input: null,
  }, customerA.token, { ok: false }));

  await expectRejected("customer cannot call owner report RPC", () => rpc("owner_get_report_snapshot", {
    from_at_input: null,
    to_at_input: null,
  }, customerA.token, { ok: false }));

  await expectRejected("customer cannot call developer admin snapshot RPC", () => rpc("developer_get_admin_snapshot", {}, customerA.token, { ok: false }));

  await expectRejected("owner cannot call developer admin snapshot RPC", () => rpc("developer_get_admin_snapshot", {}, owner.token, { ok: false }));

  await expectRejected("customer cannot call developer launch readiness RPC", () => rpc("developer_get_launch_readiness", {}, customerA.token, { ok: false }));

  await expectRejected("owner cannot call developer launch readiness RPC", () => rpc("developer_get_launch_readiness", {}, owner.token, { ok: false }));

  await expectRejected("owner cannot call developer pricing RPC", () => rpc("developer_update_service", {
    service_id_input: "basic",
    title_input: "Basic Detail",
    price_cents_input: 15000,
    duration_minutes_input: 180,
    buffer_minutes_input: 30,
    visible_input: true,
  }, owner.token, { ok: false }));

  await expectRejected("developer cannot unlock Stripe live mode", () => rpc("developer_update_business_setting", {
    setting_key_input: "stripe_live_mode",
    setting_value_input: "enabled",
  }, developer.token, { ok: false }));

  await expectRejected("developer cannot activate real SMS provider", () => rpc("developer_update_business_setting", {
    setting_key_input: "sms_provider",
    setting_value_input: "connected_provider",
  }, developer.token, { ok: false }));

  const developerSnapshot = await rpc("developer_get_admin_snapshot", {}, developer.token);
  if (!Array.isArray(developerSnapshot.data?.services) || !developerSnapshot.data.services.some(service => service.id === "basic")) {
    fail("developer admin snapshot", "Developer snapshot did not include service pricing data");
  }
  if (developerSnapshot.data?.money_flow?.customer_sees_app_fee !== false) {
    fail("developer admin snapshot", "Developer snapshot did not preserve hidden app-fee rule");
  }
  if (developerSnapshot.data?.money_flow?.app_fee_routing_status !== "ledger_only") {
    fail("developer admin snapshot", "Developer snapshot did not keep app fee ledger-only");
  }
  const snapshotText = JSON.stringify(developerSnapshot.data);
  for (const forbidden of ["claim_token_hash", "payment_placeholders", "sms_notifications"]) {
    if (snapshotText.includes(forbidden)) fail("developer admin snapshot", `Snapshot exposed ${forbidden}`);
  }
  log("pass", "developer can load safe admin snapshot");

  const readiness = await rpc("developer_get_launch_readiness", {}, developer.token);
  if (readiness.data?.status !== "repo_ready_requires_live_verification") {
    fail("developer launch readiness", `Unexpected launch readiness status: ${readiness.data?.status}`);
  }
  if (readiness.data?.free_path !== true) {
    fail("developer launch readiness", "Readiness snapshot did not preserve free_path=true");
  }
  if (readiness.data?.business_locks?.stripe_live_mode !== "locked") {
    fail("developer launch readiness", "Stripe live mode was not locked in readiness snapshot");
  }
  if (readiness.data?.business_locks?.sms_provider !== "not_connected") {
    fail("developer launch readiness", "SMS provider was not not_connected in readiness snapshot");
  }
  const readinessText = JSON.stringify(readiness.data);
  for (const forbidden of ["claim_token_hash", "payment_placeholders", "sms_notifications"]) {
    if (readinessText.includes(forbidden)) fail("developer launch readiness", `Readiness exposed ${forbidden}`);
  }
  log("pass", "developer can load launch readiness safety gate");

  const booking = await rpc("create_guest_booking", {
    payload: bookingPayload({
      daysAhead: 60,
      name: `Normal ${unique}`,
      addressSuffix: unique,
    }),
  });
  const bookingId = booking.data?.booking_id;
  const claimToken = booking.data?.claim_token;
  if (!bookingId || !claimToken) fail("anon create guest booking", "No booking id or claim token returned");
  log("pass", "anon can create guest booking", bookingId);

  const guestBookingRead = await rpc("get_customer_booking", {
    booking_id_input: bookingId,
    claim_token_hash_input: claimToken,
  });
  if (guestBookingRead.data?.id !== bookingId) fail("guest token booking read", "Guest token did not return the expected booking");
  if (!guestBookingRead.data?.end_at) fail("guest token booking read", "Safe customer booking read did not include end_at");
  if ("claim_token_hash" in guestBookingRead.data) fail("guest token booking read", "Safe customer booking read exposed claim_token_hash");
  if ("claimed_by_user_id" in guestBookingRead.data) fail("guest token booking read", "Safe customer booking read exposed auth user id");
  log("pass", "guest token can read safe booking details");

  const guestMessageRead = await rpc("get_customer_booking_messages", {
    booking_id_input: bookingId,
    claim_token_hash_input: claimToken,
  });
  if (!Array.isArray(guestMessageRead.data)) fail("guest token message read", "Expected message array for guest token");
  log("pass", "guest token can read safe message list");

  const guestTimelineRead = await rpc("get_booking_timeline", {
    booking_id_input: bookingId,
    claim_token_hash_input: claimToken,
  });
  if (!Array.isArray(guestTimelineRead.data)) fail("guest token timeline read", "Expected timeline array for guest token");
  if (!guestTimelineRead.data.some(event => event.booking_id === bookingId && event.event_type === "booking_confirmed")) {
    fail("guest token timeline read", "Timeline did not include the booking creation/confirmation event");
  }
  const guestTimelineText = JSON.stringify(guestTimelineRead.data);
  for (const forbidden of ["created_by", "claim_token_hash", "payment_placeholders", "sms_notifications", "app_fee_ledger_entries"]) {
    if (guestTimelineText.includes(forbidden)) fail("guest token timeline read", `Timeline exposed ${forbidden}`);
  }
  log("pass", "guest token can read safe booking timeline");

  const publicAvailability = await rpc("get_public_availability", {
    from_date_input: centralDate(55),
    to_date_input: centralDate(65),
  });
  if (!Array.isArray(publicAvailability.data) || !publicAvailability.data.some(item => item.id === bookingId && item.source === "booking")) {
    fail("public availability", "Safe public availability did not include the booked slot");
  }
  const availabilityText = JSON.stringify(publicAvailability.data);
  for (const forbidden of ["guest_name", "guest_phone", "claim_token_hash", "reason"]) {
    if (availabilityText.includes(forbidden)) fail("public availability", `Availability exposed ${forbidden}`);
  }
  log("pass", "anon can load safe public availability");

  await expectRejected("overlap rejects second active booking", () => rpc("create_guest_booking", {
    payload: bookingPayload({
      daysAhead: 60,
      name: `Overlap ${unique}`,
      addressSuffix: unique,
    }),
  }, undefined, { ok: false }));

  const ownerBookings = await select("bookings", `select=*&id=eq.${bookingId}`, owner.token);
  const ownerBooking = singleRow(ownerBookings.data, "owner reads created booking");
  if (ownerBooking.status !== "confirmed" || ownerBooking.owner_ack_status !== "needs_ack") {
    fail("normal booking state", `Expected confirmed/needs_ack, got ${ownerBooking.status}/${ownerBooking.owner_ack_status}`);
  }
  if (!ownerBooking.end_at) fail("booking end_at", "Created booking did not have database-computed end_at");
  if (!ownerBooking.claim_token_hash) fail("claim token hash", "Created booking did not store claim_token_hash");
  if (ownerBooking.claim_token_hash === claimToken) fail("claim token storage", "Raw claim token was stored instead of a hash");
  log("pass", "owner reads created booking with hashed claim token");

  const ownerPayments = await select("payment_placeholders", `select=*&booking_id=eq.${bookingId}`, owner.token);
  const ownerPayment = singleRow(ownerPayments.data, "owner reads payment placeholder");
  if (ownerPayment.live_mode !== false || ownerPayment.amount_cents !== 0 || ownerPayment.no_real_payment_collected !== true) {
    fail("payment placeholder state", "Payment placeholder did not preserve no-real-payment state");
  }
  if (
    ownerPayment.payment_choice !== "deposit_cash_balance" ||
    ownerPayment.quoted_due_today_cents <= 0 ||
    ownerPayment.quoted_job_total_cents !== 15000 ||
    ownerPayment.balance_due_cents !== 12500
  ) {
    fail("payment quote intent", "Payment placeholder did not store the expected future checkout quote values");
  }
  log("pass", "booking stores checkout quote intent without collecting money");

  const ownerJobQueue = await rpc("owner_list_jobs", {
    from_at_input: null,
    to_at_input: null,
    status_filter_input: null,
  }, owner.token);
  if (!Array.isArray(ownerJobQueue.data) || !ownerJobQueue.data.some(job => job.id === bookingId)) {
    fail("owner job queue", "Owner job queue did not include created booking");
  }
  if ("claim_token_hash" in ownerJobQueue.data.find(job => job.id === bookingId)) {
    fail("owner job queue", "Owner job queue exposed claim_token_hash");
  }
  log("pass", "owner can load operational job queue");

  const customerBBooking = await select("bookings", `select=*&id=eq.${bookingId}`, customerB.token);
  if (Array.isArray(customerBBooking.data) && customerBBooking.data.length === 0) {
    log("pass", "unclaimed customer cannot read another booking");
  } else {
    fail("customer isolation before claim", "Customer B could see the unclaimed booking");
  }

  await rpc("owner_acknowledge_booking", { booking_id_input: bookingId }, owner.token);
  log("pass", "owner can acknowledge booking");

  const closeout = await rpc("owner_closeout_booking", {
    booking_id_input: bookingId,
    owner_adjustment_cents_input: 500,
    owner_adjustment_label_input: "API smoke adjustment",
    cash_collected_cents_input: 14500,
    closeout_note_input: "API smoke closeout",
  }, owner.token);
  if (closeout.data?.closeout_status !== "closed" || closeout.data?.cash_collected_cents !== 14500) {
    fail("owner closeout", "Owner closeout did not close the job with expected cash collection");
  }
  log("pass", "owner can close out booking without live payment provider");

  const ownerTimelineRead = await rpc("get_booking_timeline", {
    booking_id_input: bookingId,
    claim_token_hash_input: null,
  }, owner.token);
  if (!Array.isArray(ownerTimelineRead.data) || !ownerTimelineRead.data.some(event => event.event_type === "owner_closed_out_booking")) {
    fail("owner timeline read", "Owner timeline did not include closeout event");
  }
  log("pass", "owner can read safe booking timeline with closeout history");

  await rpc("claim_guest_booking", {
    booking_id_input: bookingId,
    claim_token_hash_input: claimToken,
  }, customerA.token);
  log("pass", "customer A can claim booking with raw token");

  const claimedTimelineRead = await rpc("get_booking_timeline", {
    booking_id_input: bookingId,
    claim_token_hash_input: null,
  }, customerA.token);
  if (!Array.isArray(claimedTimelineRead.data) || !claimedTimelineRead.data.some(event => event.event_type === "guest_booking_claimed")) {
    fail("claimed customer timeline read", "Claimed customer timeline did not include guest_booking_claimed event");
  }
  log("pass", "claimed customer can read claim event in safe timeline");

  const customerAHistory = await rpc("get_customer_bookings", {}, customerA.token);
  if (!Array.isArray(customerAHistory.data) || !customerAHistory.data.some(row => row.id === bookingId)) {
    fail("customer A safe booking history", "Claimed booking was missing from customer-safe history");
  }
  const customerAHistoryText = JSON.stringify(customerAHistory.data);
  for (const forbidden of ["claim_token_hash", "claimed_by_user_id", "payment_placeholders", "sms_notifications"]) {
    if (customerAHistoryText.includes(forbidden)) fail("customer A safe booking history", `History exposed ${forbidden}`);
  }
  log("pass", "customer A can load safe claimed booking history");

  const customerProfile = await rpc("get_my_customer_profile", {}, customerA.token);
  if (!customerProfile.data?.id || !Array.isArray(customerProfile.data?.vehicles)) {
    fail("customer profile read", "Signed-in customer profile did not include safe profile and vehicles");
  }
  if (!customerProfile.data.vehicles.some(vehicle => vehicle.nickname === "API smoke vehicle")) {
    fail("customer profile read", "Claimed booking vehicle was not available in saved vehicles");
  }
  log("pass", "customer A can load own profile and saved vehicles");

  const updatedProfile = await rpc("upsert_my_customer_profile", {
    name_input: "Customer A Updated",
    phone_input: "(615) 555-0199",
    notification_preference_input: "email",
  }, customerA.token);
  if (updatedProfile.data?.name !== "Customer A Updated" || updatedProfile.data?.phone !== "(615) 555-0199") {
    fail("customer profile update", "Profile update did not return updated safe profile fields");
  }
  log("pass", "customer A can update own profile");

  const updatedVehicles = await rpc("upsert_my_vehicle", {
    vehicle_id_input: null,
    nickname_input: `Weekend car ${unique}`,
    year_input: "2022",
    make_input: "Toyota",
    model_input: "Camry",
    color_input: "Black",
    plate_input: null,
    vin_input: null,
    is_default_input: true,
  }, customerA.token);
  const weekendVehicle = (updatedVehicles.data?.vehicles || []).find(vehicle => vehicle.nickname === `Weekend car ${unique}`);
  if (!weekendVehicle?.id || weekendVehicle.is_default !== true) {
    fail("customer vehicle upsert", "Vehicle upsert did not save the new default vehicle");
  }
  log("pass", "customer A can save a default vehicle");

  const afterVehicleDelete = await rpc("delete_my_vehicle", {
    vehicle_id_input: weekendVehicle.id,
  }, customerA.token);
  if ((afterVehicleDelete.data?.vehicles || []).some(vehicle => vehicle.id === weekendVehicle.id)) {
    fail("customer vehicle delete", "Deleted vehicle still appeared in profile response");
  }
  log("pass", "customer A can delete own vehicle");

  const customerBHistory = await rpc("get_customer_bookings", {}, customerB.token);
  if (!Array.isArray(customerBHistory.data) || customerBHistory.data.some(row => row.id === bookingId)) {
    fail("customer B safe booking history", "Customer B history included Customer A booking");
  }
  log("pass", "customer B history excludes Customer A booking");

  const customerABooking = await select("bookings", `select=*&id=eq.${bookingId}`, customerA.token);
  singleRow(customerABooking.data, "customer A reads claimed booking");
  log("pass", "customer A reads claimed booking");

  const afterClaimCustomerB = await select("bookings", `select=*&id=eq.${bookingId}`, customerB.token);
  if (Array.isArray(afterClaimCustomerB.data) && afterClaimCustomerB.data.length === 0) {
    log("pass", "customer B cannot read customer A claimed booking");
  } else {
    fail("customer isolation after claim", "Customer B could see Customer A booking");
  }

  await rpc("create_booking_message", {
    booking_id_input: bookingId,
    body_input: `Can you confirm this test message? ${unique}`,
    claim_token_hash_input: null,
  }, customerA.token);
  log("pass", "customer A can send in-app message");

  const smsRows = await select("sms_notifications", `select=*&booking_id=eq.${bookingId}`, owner.token);
  if (!Array.isArray(smsRows.data) || !smsRows.data.some(row => row.provider === "not_connected" && row.status === "would_send")) {
    fail("owner SMS placeholder", "Expected a not_connected/would_send SMS placeholder");
  }
  log("pass", "owner SMS remains placeholder-only");

  const ownerNotifications = await rpc("owner_list_notifications", {
    from_at_input: null,
    to_at_input: null,
    status_filter_input: null,
  }, owner.token);
  if (!Array.isArray(ownerNotifications.data) || !ownerNotifications.data.some(row => row.booking_id === bookingId && row.provider === "not_connected")) {
    fail("owner notification inbox", "Owner notification feed did not include the SMS placeholder");
  }
  const ownerNotificationText = JSON.stringify(ownerNotifications.data);
  for (const forbidden of ["claim_token_hash", "payment_placeholders", "app_fee_ledger_entries"]) {
    if (ownerNotificationText.includes(forbidden)) fail("owner notification inbox", `Notification feed exposed ${forbidden}`);
  }
  log("pass", "owner can load SMS-placeholder notification inbox");

  const ownerReport = await rpc("owner_get_report_snapshot", {
    from_at_input: `${centralDate(55)} 00:00 America/Chicago`,
    to_at_input: `${centralDate(65)} 23:59 America/Chicago`,
  }, owner.token);
  if (!ownerReport.data?.summary || !Array.isArray(ownerReport.data?.rows)) {
    fail("owner report snapshot", "Owner report did not return summary and rows");
  }
  if (!ownerReport.data.rows.some(row => row.booking_id === bookingId && row.app_fee_routing_status === "ledger_only")) {
    fail("owner report snapshot", "Owner report did not include the created booking with ledger-only app fee");
  }
  const reportBookingRow = ownerReport.data.rows.find(row => row.booking_id === bookingId);
  if (reportBookingRow.closeout_status !== "closed" || reportBookingRow.cash_collected_cents !== 14500 || reportBookingRow.owner_adjustment_cents !== 500) {
    fail("owner report snapshot", "Owner report did not include closeout adjustment and cash collection");
  }
  const ownerReportText = JSON.stringify(ownerReport.data);
  for (const forbidden of ["claim_token_hash", "checkout_session_id", "payment_intent_id", "connected_account_id"]) {
    if (ownerReportText.includes(forbidden)) fail("owner report snapshot", `Report exposed ${forbidden}`);
  }
  log("pass", "owner can load ledger-only report snapshot");

  const customerLedger = await select("app_fee_ledger_entries", `select=*&booking_id=eq.${bookingId}`, customerA.token);
  if (Array.isArray(customerLedger.data) && customerLedger.data.length === 0) {
    log("pass", "customer cannot read hidden app-fee ledger");
  } else {
    fail("hidden app-fee ledger", "Customer could read app-fee ledger rows");
  }

  const ownerLedger = await select("app_fee_ledger_entries", `select=*&booking_id=eq.${bookingId}`, owner.token);
  const ledgerRow = singleRow(ownerLedger.data, "owner reads app-fee ledger");
  if (ledgerRow.visible_to_customer !== false || ledgerRow.routing_status !== "ledger_only") {
    fail("ledger state", `Expected hidden ledger_only entry, got visible=${ledgerRow.visible_to_customer} routing=${ledgerRow.routing_status}`);
  }
  log("pass", "owner sees hidden ledger-only app fee");

  const blockDate = centralDate(65);
  const block = await rpc("owner_set_availability_block", {
    block_type_input: "time_slot",
    block_date_input: blockDate,
    time_label_input: "10:00 AM",
    reason_input: `API smoke ${unique}`,
  }, owner.token);
  const blockId = block.data;
  log("pass", "owner can block a time slot", blockId);

  await expectRejected("blocked time rejects customer booking", () => rpc("create_guest_booking", {
    payload: {
      ...bookingPayload({
        daysAhead: 65,
        name: `Blocked ${unique}`,
        addressSuffix: unique,
      }),
      start_at: `${blockDate} 10:00 America/Chicago`,
    },
  }, undefined, { ok: false }));

  await rpc("owner_remove_availability_block", { block_id_input: blockId }, owner.token);
  log("pass", "owner can remove blocked time slot");

  const shortNotice = await rpc("create_guest_booking", {
    payload: bookingPayload({
      daysAhead: 1,
      name: `Short notice ${unique}`,
      addressSuffix: unique,
    }),
  });
  const shortNoticeId = shortNotice.data?.booking_id;
  if (!shortNoticeId || !shortNotice.data?.claim_token) {
    fail("short-notice claim token", "Short-notice booking did not return booking id and claim token");
  }
  const shortRows = await select("bookings", `select=*&id=eq.${shortNoticeId}`, owner.token);
  const shortRow = singleRow(shortRows.data, "owner reads short-notice booking");
  if (shortRow.status !== "requested" || shortRow.owner_ack_status !== "approval_needed" || shortRow.short_notice_request !== true) {
    fail("short-notice state", `Expected requested/approval_needed/true, got ${shortRow.status}/${shortRow.owner_ack_status}/${shortRow.short_notice_request}`);
  }
  log("pass", "short-notice booking requires owner approval");

  await rpc("owner_decide_booking_request", {
    booking_id_input: shortNoticeId,
    decision: "confirm",
  }, owner.token);
  log("pass", "owner can confirm short-notice request");

  await expectRejected("customer cannot remove own developer role guard", () => rpc("developer_assign_app_role", {
    target_user_id: developer.userId,
    new_role: "customer",
    name_input: "Should fail",
    phone_input: null,
  }, developer.token, { ok: false }));

  const failed = results.filter(result => result.status === "fail");
  if (failed.length) {
    process.exitCode = 1;
    return;
  }
  console.log(`\nSupabase API/RLS verification passed with ${results.length} checks.`);
};

main().catch(error => {
  console.error(`\nSupabase API/RLS verification failed: ${error.message}`);
  process.exit(1);
});
