export const DATA_ADAPTER_IDS = {
  LOCAL_STORAGE: "localStorage",
  SUPABASE: "supabase",
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

export const getSupabaseConfigStatus = () => {
  const env = typeof import.meta !== "undefined" && import.meta.env ? import.meta.env : {};
  const hasUrl = Boolean(env.VITE_SUPABASE_URL);
  const hasAnonKey = Boolean(env.VITE_SUPABASE_ANON_KEY);
  return {
    hasUrl,
    hasAnonKey,
    configured: hasUrl && hasAnonKey,
    status: hasUrl && hasAnonKey ? "configured_not_active" : "missing_frontend_env",
  };
};

export const getActiveDataAdapter = () => DATA_ADAPTERS[DATA_ADAPTER_IDS.LOCAL_STORAGE];

export const getIntegrationStatus = () => {
  const supabaseConfig = getSupabaseConfigStatus();
  return {
    dataAdapter: {
      active: DATA_ADAPTER_IDS.LOCAL_STORAGE,
      localStorage: "active_demo",
      supabase: "repo_ready_disabled",
      supabaseConfig,
      supabaseReason: DATA_ADAPTERS[DATA_ADAPTER_IDS.SUPABASE].reason,
      bookingRpc: "repo_ready_not_applied",
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
