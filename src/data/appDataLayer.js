import {
  buildSupabaseAvailabilityBlockPayload,
  buildSupabaseGuestBookingPayload,
  mapSupabaseAvailabilityBlockRow,
  mapSupabaseBookingRow,
  mapSupabaseBusinessSettingsRows,
  mapSupabaseServiceRow,
} from "./supabaseMappings.js";

export const DATA_ADAPTER_IDS = {
  LOCAL_STORAGE: "localStorage",
  SUPABASE: "supabase",
};

const SUPABASE_ENABLE_FLAG = "VITE_USE_SUPABASE";

export const getSupabaseConfigStatus = () => {
  const env = typeof import.meta !== "undefined" && import.meta.env ? import.meta.env : {};
  const hasUrl = Boolean(env.VITE_SUPABASE_URL);
  const hasAnonKey = Boolean(env.VITE_SUPABASE_ANON_KEY);
  const enabled = env[SUPABASE_ENABLE_FLAG] === "1" || env[SUPABASE_ENABLE_FLAG] === "true";
  return {
    hasUrl,
    hasAnonKey,
    enabled,
    configured: hasUrl && hasAnonKey,
    active: enabled && hasUrl && hasAnonKey,
    status: hasUrl && hasAnonKey
      ? enabled ? "configured_enabled" : "configured_not_active"
      : "missing_frontend_env",
  };
};

export const createSupabaseRestAdapter = ({ url, anonKey, fetchImpl = globalThis.fetch } = {}) => {
  const baseUrl = String(url || "").replace(/\/+$/, "");
  const headers = {
    apikey: anonKey || "",
    Authorization: `Bearer ${anonKey || ""}`,
    "Content-Type": "application/json",
  };

  const requestJson = async (path, options = {}) => {
    if (!baseUrl || !anonKey) throw new Error("Supabase URL and anon key are required");
    if (!fetchImpl) throw new Error("Fetch is unavailable");
    const response = await fetchImpl(`${baseUrl}${path}`, {
      ...options,
      headers: { ...headers, ...(options.headers || {}) },
    });
    if (!response.ok) {
      const message = await response.text().catch(() => "");
      throw new Error(message || `Supabase request failed (${response.status})`);
    }
    if (response.status === 204) return null;
    return response.json();
  };

  return {
    id: DATA_ADAPTER_IDS.SUPABASE,
    label: "Supabase REST",
    status: "configured_enabled",
    loadServices: async () => (await requestJson("/rest/v1/services?select=*&visible=eq.true&order=title.asc")).map(mapSupabaseServiceRow),
    loadBusinessSettings: async () => mapSupabaseBusinessSettingsRows(await requestJson("/rest/v1/business_settings?select=key,value")),
    loadCustomerBookings: async () => (await requestJson("/rest/v1/bookings?select=*&order=start_at.asc")).map(mapSupabaseBookingRow),
    loadAvailabilityBlocks: async () => (await requestJson("/rest/v1/availability_blocks?select=*&order=block_date.asc")).map(mapSupabaseAvailabilityBlockRow),
    createGuestBooking: draft => requestJson("/rest/v1/rpc/create_guest_booking", {
      method: "POST",
      body: JSON.stringify({ payload: buildSupabaseGuestBookingPayload(draft) }),
    }),
    ownerAcknowledgeBooking: bookingId => requestJson("/rest/v1/rpc/owner_acknowledge_booking", {
      method: "POST",
      body: JSON.stringify({ booking_id_input: bookingId }),
    }),
    ownerDecideBookingRequest: ({ bookingId, decision }) => requestJson("/rest/v1/rpc/owner_decide_booking_request", {
      method: "POST",
      body: JSON.stringify({ booking_id_input: bookingId, decision }),
    }),
    ownerRequestBookingReschedule: bookingId => requestJson("/rest/v1/rpc/owner_request_booking_reschedule", {
      method: "POST",
      body: JSON.stringify({ booking_id_input: bookingId }),
    }),
    ownerUpdateBookingTracker: ({ bookingId, trackerStatus }) => requestJson("/rest/v1/rpc/owner_update_booking_tracker", {
      method: "POST",
      body: JSON.stringify({ booking_id_input: bookingId, tracker_status_input: trackerStatus }),
    }),
    ownerSetAvailabilityBlock: block => requestJson("/rest/v1/rpc/owner_set_availability_block", {
      method: "POST",
      body: JSON.stringify(buildSupabaseAvailabilityBlockPayload(block)),
    }),
    ownerRemoveAvailabilityBlock: blockId => requestJson("/rest/v1/rpc/owner_remove_availability_block", {
      method: "POST",
      body: JSON.stringify({ block_id_input: blockId }),
    }),
  };
};

export const DATA_ADAPTERS = {
  [DATA_ADAPTER_IDS.LOCAL_STORAGE]: {
    id: DATA_ADAPTER_IDS.LOCAL_STORAGE,
    label: "Local demo storage",
    status: "active_demo",
    load: key => {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    },
    save: (key, value) => {
      try {
        localStorage.setItem(key, JSON.stringify(value));
        return { ok: true };
      } catch (error) {
        return { ok: false, error };
      }
    },
    clear: key => {
      try { localStorage.removeItem(key); } catch {}
    },
  },
  [DATA_ADAPTER_IDS.SUPABASE]: {
    id: DATA_ADAPTER_IDS.SUPABASE,
    label: "Supabase",
    status: "planned_disabled",
    enabled: false,
    reason: "Disabled until credentials, auth, and Row Level Security are approved.",
  },
};

export const getActiveDataAdapter = () => {
  return DATA_ADAPTERS[DATA_ADAPTER_IDS.LOCAL_STORAGE];
};

export const getConfiguredBackendAdapter = () => {
  const env = typeof import.meta !== "undefined" && import.meta.env ? import.meta.env : {};
  const supabase = getSupabaseConfigStatus();
  if (!supabase.active) return null;
  return createSupabaseRestAdapter({
    url: env.VITE_SUPABASE_URL,
    anonKey: env.VITE_SUPABASE_ANON_KEY,
  });
};

export const getIntegrationStatus = () => {
  const supabaseConfig = getSupabaseConfigStatus();
  return {
    dataAdapter: {
      active: DATA_ADAPTER_IDS.LOCAL_STORAGE,
      localStorage: "active_demo",
      supabase: supabaseConfig.active ? "configured_enabled" : "repo_ready_disabled",
      supabaseConfig,
      supabaseReason: DATA_ADAPTERS[DATA_ADAPTER_IDS.SUPABASE].reason,
      bookingRpc: "repo_ready_not_applied",
      ownerOperationRpcs: "repo_ready_not_applied",
    },
    payments: {
      stripeTestMode: "planned_not_connected",
      stripeLiveMode: "locked",
      stripeConnect: "planned_not_connected",
    },
    notifications: {
      smsProvider: "planned_not_connected",
      ownerSms: "queued_locally_only",
      customerSms: "not_enabled",
    },
    auth: {
      supabaseAuth: "required_before_real_customer_data",
      rowLevelSecurity: "repo_ready_requires_live_verification",
    },
    hosting: {
      frontend: "github_pages_active",
    },
  };
};
