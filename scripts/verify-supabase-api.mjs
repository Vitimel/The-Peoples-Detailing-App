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
  if (!ownerBooking.claim_token_hash) fail("claim token hash", "Created booking did not store claim_token_hash");
  if (ownerBooking.claim_token_hash === claimToken) fail("claim token storage", "Raw claim token was stored instead of a hash");
  log("pass", "owner reads created booking with hashed claim token");

  const customerBBooking = await select("bookings", `select=*&id=eq.${bookingId}`, customerB.token);
  if (Array.isArray(customerBBooking.data) && customerBBooking.data.length === 0) {
    log("pass", "unclaimed customer cannot read another booking");
  } else {
    fail("customer isolation before claim", "Customer B could see the unclaimed booking");
  }

  await rpc("owner_acknowledge_booking", { booking_id_input: bookingId }, owner.token);
  log("pass", "owner can acknowledge booking");

  await rpc("claim_guest_booking", {
    booking_id_input: bookingId,
    claim_token_hash_input: claimToken,
  }, customerA.token);
  log("pass", "customer A can claim booking with raw token");

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
