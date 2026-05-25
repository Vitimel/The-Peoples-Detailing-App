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

export const getActiveDataAdapter = () => DATA_ADAPTERS[DATA_ADAPTER_IDS.LOCAL_STORAGE];

export const getIntegrationStatus = () => ({
  dataAdapter: {
    active: DATA_ADAPTER_IDS.LOCAL_STORAGE,
    localStorage: "active_demo",
    supabase: "planned_disabled",
    supabaseReason: DATA_ADAPTERS[DATA_ADAPTER_IDS.SUPABASE].reason,
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
    rowLevelSecurity: "required_before_real_customer_data",
  },
  hosting: {
    frontend: "github_pages_active",
  },
});
