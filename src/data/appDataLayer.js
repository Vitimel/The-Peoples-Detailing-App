import {
  buildSupabaseAvailabilityBlockPayload,
  buildSupabaseCancelPayload,
  buildSupabaseCustomerBookingReadPayload,
  buildSupabaseCustomerProfilePayload,
  buildSupabaseBusinessSettingPayload,
  buildSupabaseGuestBookingPayload,
  buildSupabaseIntegrationStatusPayload,
  buildSupabaseMessagePayload,
  buildSupabaseOwnerJobsPayload,
  buildSupabaseOwnerNotificationsPayload,
  buildSupabaseOwnerReportPayload,
  buildSupabasePublicAvailabilityPayload,
  buildSupabaseReschedulePayload,
  buildSupabaseRoleAssignmentPayload,
  buildSupabaseServiceUpdatePayload,
  buildSupabaseVehiclePayload,
  mapSupabaseAvailabilityBlockRow,
  mapSupabaseBookingRow,
  mapSupabaseBusinessSettingsRows,
  mapSupabaseDeveloperAdminSnapshot,
  mapSupabaseCustomerProfile,
  mapSupabaseMessageRow,
  mapSupabaseOwnerNotificationRow,
  mapSupabaseOwnerReportSnapshot,
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

export const createSupabaseRestAdapter = ({
  url,
  anonKey,
  accessToken,
  getAccessToken,
  fetchImpl = globalThis.fetch,
} = {}) => {
  const baseUrl = String(url || "").replace(/\/+$/, "");
  const resolveBearerToken = async () => {
    if (typeof getAccessToken === "function") {
      const token = await getAccessToken();
      if (token) return token;
    }
    return accessToken || anonKey || "";
  };

  const requestJson = async (path, options = {}) => {
    if (!baseUrl || !anonKey) throw new Error("Supabase URL and anon key are required");
    if (!fetchImpl) throw new Error("Fetch is unavailable");
    const bearerToken = await resolveBearerToken();
    const response = await fetchImpl(`${baseUrl}${path}`, {
      ...options,
      headers: {
        apikey: anonKey || "",
        Authorization: `Bearer ${bearerToken}`,
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
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
    loadIntegrationStatus: () => requestJson("/rest/v1/integration_status?select=*&order=id.asc"),
    loadDeveloperAdminSnapshot: () => requestJson("/rest/v1/rpc/developer_get_admin_snapshot", {
      method: "POST",
      body: JSON.stringify({}),
    }).then(mapSupabaseDeveloperAdminSnapshot),
    loadCustomerBookings: async () => requestJson("/rest/v1/rpc/get_customer_bookings", {
      method: "POST",
      body: JSON.stringify({}),
    }).then(rows => (Array.isArray(rows) ? rows : []).map(mapSupabaseBookingRow)),
    loadMyCustomerProfile: () => requestJson("/rest/v1/rpc/get_my_customer_profile", {
      method: "POST",
      body: JSON.stringify({}),
    }).then(mapSupabaseCustomerProfile),
    loadAvailabilityBlocks: async input => requestJson("/rest/v1/rpc/get_public_availability", {
      method: "POST",
      body: JSON.stringify(buildSupabasePublicAvailabilityPayload(input)),
    }).then(rows => (Array.isArray(rows) ? rows : []).map(mapSupabaseAvailabilityBlockRow)),
    loadBookingMessages: input => requestJson("/rest/v1/rpc/get_customer_booking_messages", {
      method: "POST",
      body: JSON.stringify(buildSupabaseCustomerBookingReadPayload(input)),
    }).then(rows => (Array.isArray(rows) ? rows : []).map(mapSupabaseMessageRow)),
    loadCustomerBooking: input => requestJson("/rest/v1/rpc/get_customer_booking", {
      method: "POST",
      body: JSON.stringify(buildSupabaseCustomerBookingReadPayload(input)),
    }).then(mapSupabaseBookingRow),
    loadCustomerBookingMessages: input => requestJson("/rest/v1/rpc/get_customer_booking_messages", {
      method: "POST",
      body: JSON.stringify(buildSupabaseCustomerBookingReadPayload(input)),
    }).then(rows => (Array.isArray(rows) ? rows : []).map(mapSupabaseMessageRow)),
    loadOwnerJobs: input => requestJson("/rest/v1/rpc/owner_list_jobs", {
      method: "POST",
      body: JSON.stringify(buildSupabaseOwnerJobsPayload(input)),
    }).then(rows => (Array.isArray(rows) ? rows : []).map(mapSupabaseBookingRow)),
    loadOwnerNotifications: input => requestJson("/rest/v1/rpc/owner_list_notifications", {
      method: "POST",
      body: JSON.stringify(buildSupabaseOwnerNotificationsPayload(input)),
    }).then(rows => (Array.isArray(rows) ? rows : []).map(mapSupabaseOwnerNotificationRow)),
    loadOwnerReportSnapshot: input => requestJson("/rest/v1/rpc/owner_get_report_snapshot", {
      method: "POST",
      body: JSON.stringify(buildSupabaseOwnerReportPayload(input)),
    }).then(mapSupabaseOwnerReportSnapshot),
    createGuestBooking: async draft => {
      const result = await requestJson("/rest/v1/rpc/create_guest_booking", {
        method: "POST",
        body: JSON.stringify({ payload: buildSupabaseGuestBookingPayload(draft) }),
      });
      if (result && typeof result === "object" && result.booking_id) {
        return {
          bookingId: result.booking_id,
          claimToken: result.claim_token || null,
          status: result.status || null,
          shortNoticeRequest: Boolean(result.short_notice_request),
        };
      }
      return result;
    },
    cancelBooking: input => requestJson("/rest/v1/rpc/customer_cancel_booking", {
      method: "POST",
      body: JSON.stringify(buildSupabaseCancelPayload(input)),
    }),
    rescheduleBooking: input => requestJson("/rest/v1/rpc/reschedule_booking", {
      method: "POST",
      body: JSON.stringify(buildSupabaseReschedulePayload(input)),
    }),
    createBookingMessage: input => requestJson("/rest/v1/rpc/create_booking_message", {
      method: "POST",
      body: JSON.stringify(buildSupabaseMessagePayload(input)),
    }),
    upsertMyCustomerProfile: input => requestJson("/rest/v1/rpc/upsert_my_customer_profile", {
      method: "POST",
      body: JSON.stringify(buildSupabaseCustomerProfilePayload(input)),
    }).then(mapSupabaseCustomerProfile),
    upsertMyVehicle: input => requestJson("/rest/v1/rpc/upsert_my_vehicle", {
      method: "POST",
      body: JSON.stringify(buildSupabaseVehiclePayload(input)),
    }).then(mapSupabaseCustomerProfile),
    deleteMyVehicle: vehicleId => requestJson("/rest/v1/rpc/delete_my_vehicle", {
      method: "POST",
      body: JSON.stringify({ vehicle_id_input: vehicleId }),
    }).then(mapSupabaseCustomerProfile),
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
    developerUpdateService: service => requestJson("/rest/v1/rpc/developer_update_service", {
      method: "POST",
      body: JSON.stringify(buildSupabaseServiceUpdatePayload(service)),
    }),
    developerUpdateBusinessSetting: setting => requestJson("/rest/v1/rpc/developer_update_business_setting", {
      method: "POST",
      body: JSON.stringify(buildSupabaseBusinessSettingPayload(setting)),
    }),
    developerUpdateIntegrationStatus: integration => requestJson("/rest/v1/rpc/developer_update_integration_status", {
      method: "POST",
      body: JSON.stringify(buildSupabaseIntegrationStatusPayload(integration)),
    }),
    developerAssignAppRole: assignment => requestJson("/rest/v1/rpc/developer_assign_app_role", {
      method: "POST",
      body: JSON.stringify(buildSupabaseRoleAssignmentPayload(assignment)),
    }),
  };
};

export const createSupabaseAuthAdapter = ({
  url,
  anonKey,
  fetchImpl = globalThis.fetch,
} = {}) => {
  const baseUrl = String(url || "").replace(/\/+$/, "");

  const requestAuth = async (path, { accessToken, method = "POST", body } = {}) => {
    if (!baseUrl || !anonKey) throw new Error("Supabase URL and anon key are required");
    if (!fetchImpl) throw new Error("Fetch is unavailable");
    const response = await fetchImpl(`${baseUrl}${path}`, {
      method,
      headers: {
        apikey: anonKey || "",
        Authorization: `Bearer ${accessToken || anonKey || ""}`,
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    const data = text ? JSON.parse(text) : null;
    if (!response.ok) {
      const message = data?.msg || data?.message || text || `Supabase auth request failed (${response.status})`;
      throw new Error(message);
    }
    return data;
  };

  const normalizeSession = data => ({
    accessToken: data?.access_token || null,
    refreshToken: data?.refresh_token || null,
    expiresIn: data?.expires_in || null,
    tokenType: data?.token_type || null,
    user: data?.user || data || null,
  });

  return {
    id: "supabaseAuth",
    signUpWithEmail: ({ email, password, name, phone } = {}) => requestAuth("/auth/v1/signup", {
      body: {
        email,
        password,
        data: {
          name: name || null,
          phone: phone || null,
        },
      },
    }).then(normalizeSession),
    signInWithPassword: ({ email, password } = {}) => requestAuth("/auth/v1/token?grant_type=password", {
      body: { email, password },
    }).then(normalizeSession),
    signOut: accessToken => requestAuth("/auth/v1/logout", {
      accessToken,
      body: {},
    }).then(() => ({ ok: true })),
    getUser: accessToken => requestAuth("/auth/v1/user", {
      accessToken,
      method: "GET",
    }).then(normalizeSession),
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

export const getConfiguredAuthAdapter = () => {
  const env = typeof import.meta !== "undefined" && import.meta.env ? import.meta.env : {};
  const supabase = getSupabaseConfigStatus();
  if (!supabase.configured) return null;
  return createSupabaseAuthAdapter({
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
      bookingOverlapConstraint: "repo_ready_not_applied",
      ownerOperationRpcs: "repo_ready_not_applied",
      ownerReadRpcs: "repo_ready_not_applied",
      ownerNotificationReadRpcs: "repo_ready_not_applied",
      ownerReportReadRpcs: "repo_ready_not_applied",
      customerLifecycleRpcs: "repo_ready_not_applied",
      customerReadRpcs: "repo_ready_not_applied",
      customerHistoryReadRpcs: "repo_ready_not_applied",
      customerProfileVehicleRpcs: "repo_ready_not_applied",
      messageReadRpcs: "repo_ready_not_applied",
      publicAvailabilityReadRpcs: "repo_ready_not_applied",
      developerAdminRpcs: "repo_ready_not_applied",
      developerAdminReadRpcs: "repo_ready_not_applied",
      authRoleRpcs: "repo_ready_not_applied",
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
      supabaseAuthAdapter: supabaseConfig.configured ? "configured_not_active" : "repo_ready_not_configured",
      supabaseAccessTokenAdapter: "repo_ready_not_live",
      rowLevelSecurity: "repo_ready_requires_live_verification",
    },
    hosting: {
      frontend: "github_pages_active",
    },
  };
};
