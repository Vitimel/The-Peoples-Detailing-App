/* ==== MOCK DATA ==== */
export const SERVICES = [
  {
    id:"basic", title:"Basic Detail", priceCents:15000, durationHours:"2-3",
    cadence:"Every 2-3 months",
    blurb:"Essential clean for your daily driver.",
    bullets:[
      "Hand wash & dry using premium microfiber towels",
      "Clay bar treatment to remove light contaminants",
      "Carnauba wax application for glossy finish",
      "Wheel & tire clean with shine",
      "Interior vacuum & surface wipe",
      "Window & mirror cleaning inside",
      "Basic upholstery/leather wipe and deodorizer",
    ],
  },
  {
    id:"deluxe", title:"Deluxe Detail", priceCents:22000, durationHours:"4-5",
    cadence:"Every 3-4 months",
    blurb:"Deeper clean. Longer protection. Premium feel.",
    bullets:[
      "Includes all Basic services",
      "Machine polish removes minor swirls",
      "Synthetic paint sealant for long protection",
      "Deep wheel cleaning & tire dressing",
      "Steam clean carpets & upholstery",
      "Leather conditioning and deep panel clean",
      "Ozone odor treatment if needed",
    ],
  },
  {
    id:"premium", title:"Premium Detail", priceCents:32000, durationHours:"6-8",
    cadence:"Every 6-12 months",
    blurb:"The ultimate in protection & shine.",
    bullets:[
      "All Deluxe services included",
      "Multi-stage paint correction",
      "Ceramic coating (6-12 months protection)",
      "Engine bay cleaning & dressing",
      "Headlight restoration & glass sealant",
      "Full interior steam extraction",
      "Deep leather/fabric treatment & sanitization",
    ],
  },
  {
    id:"monthly", title:"Monthly Maintenance", priceCents:10000, durationHours:"1-2",
    cadence:"Between details",
    blurb:"Keep your ride clean every month.",
    bullets:[
      "Hand wash & quick wax",
      "Light wheel & tire clean",
      "Interior vacuum & surface wipe",
      "Spot stain cleaning as needed",
      "Window & mirror cleaning",
      "Light deodorizing",
    ],
    badge:"/mo",
  },
];

export const SETTINGS = {
  availabilityDefaultsVersion: 2,
  companyAppFeeCents: 300,
  depositCents: 2500,
  appFeeRoutingStatus: "ledger_only",
  customerPaysCardProcessingFee: true,
  cardProcessingPercent: 2.9,
  cardProcessingFixedCents: 30,
  cardProcessingInfoText: "Card payments include the processing fee. Deposit plus cash balance is available if you prefer to pay the rest at service.",
  appFeeInfoText: "The $3 app cost is not shown to customers. It is tracked as a Dane-side ledger cost from each online purchase or deposit until future backend routing is approved.",
  brandNewInfoUrl: "#brandnew-info-link-needed",
  businessPhone: "(931) 334-0730",
  bookingSubmissionMode: "request_only",
  ownerNotificationMethod: "sms",
  customerNotificationMethod: "email",
  bufferMinutes: 30,
  cancelDepositForfeitDays: 7,
  cancellationFeeCents: 2500,
  freeTravelRadiusMiles: 10,
  perMileFeeCents: 150,    // $1.50/mile
  rescheduleCutoffHours: 48,
  minimumBookingNoticeHours: 48,
  workingHoursStart: 8,
  workingHoursEnd: 19.5,
  blockedDates: [],
  blockedSlots: [],
  baseAddress: "Murfreesboro, TN",
  homeTagline: "We come to you, we treat it like ours.",
  homeTaglineKicker: "Mobile service",
  homeFooterPhone: "Phone (931) 334-0730 · Free estimates",
};

export const PROMO_CODES = [
  { code:"PEOPLES10", type:"amountOff", amountCents:1000, label:"$10 off" },
  { code:"FIRSTRIDE", type:"percentOff", percent:15, label:"15% off" },
];

export const seedVehicles = () => ([
  {
    id:"vehicle-demo-1",
    year:"2023",
    make:"Demo",
    model:"Vehicle",
    color:"",
    plate:"",
    vin:"",
    nickname:"Daily driver",
    source:"manual",
    isDefault:true,
  }
]);

export const vehicleLabel = v => {
  if (!v) return "No vehicle selected";
  return v.nickname || [v.year, v.make, v.model].filter(Boolean).join(" ") || "Vehicle";
};

export const demoDecodeVin = vin => {
  const clean = (vin || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (clean.length < 11) return null;
  const samples = {
    "5J6RS": { year:"2024", make:"Honda", model:"CR-V", source:"demo VIN lookup" },
    "7SAYG": { year:"2024", make:"Tesla", model:"Model Y", source:"demo VIN lookup" },
    "JTMWF": { year:"2019", make:"Toyota", model:"RAV4", source:"demo VIN lookup" },
    "1GNSK": { year:"2023", make:"Chevrolet", model:"Tahoe", source:"demo VIN lookup" },
    "1FTEW": { year:"2022", make:"Ford", model:"F-150", source:"demo VIN lookup" },
  };
  const prefix = Object.keys(samples).find(k => clean.startsWith(k));
  if (prefix) return samples[prefix];
  return null;
};

/* ==== HELPERS ==== */
export const cents = c => "$" + (c/100).toFixed(2);
export const fmtCents = c => "$" + (c/100).toFixed(2);
export const isoToDay = iso => {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"});
};
export const isoToTime = iso => {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"});
};
export const todayPlus = (days, hour=10, min=0) => {
  const d = new Date(); d.setDate(d.getDate()+days); d.setHours(hour,min,0,0);
  return d.toISOString();
};
export const uuid = () => "b_" + Math.random().toString(36).slice(2,10);

/* ==== STORAGE ==== */
export const LS_KEY = "tpd_proto_v1";
export const loadState = () => {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
};
export const saveState = s => {
  try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch {}
};

export const seedBookings = () => ([
  {
    id: uuid(),
    serviceId:"deluxe", serviceTitle:"Deluxe Detail", priceCents:22000,
    startIso: todayPlus(2, 10),
    address:"123 Main St, Murfreesboro, TN 37130",
    travelMiles: 12.4, travelFeeCents: 2000,
    discountCents: 0, totalCents: 22000+2000, amountPaidTodayCents: 24000, balanceDueCents: 0,
    paymentChoice:"card_full", depositCents:2500, cardProcessingFeeCents:0, companyAppFeeCents:300, appFeeRoutingStatus:"ledger_only", paymentStatus:"paid_full",
    status:"confirmed",
    customer:{ name:"Sarah Johnson", phone:"(615) 555-0142", vehicle:"2022 Honda CR-V" },
    liveLocationOptIn: true,
    paid: true,
  },
  {
    id: uuid(),
    serviceId:"premium", serviceTitle:"Premium Detail", priceCents:32000,
    startIso: todayPlus(5, 13),
    address:"742 Park Ave, Murfreesboro, TN 37129",
    travelMiles: 6.8, travelFeeCents: 0,
    discountCents: 0, totalCents: 32000, amountPaidTodayCents: 32000, balanceDueCents: 0,
    paymentChoice:"card_full", depositCents:2500, cardProcessingFeeCents:0, companyAppFeeCents:300, appFeeRoutingStatus:"ledger_only", paymentStatus:"paid_full",
    status:"confirmed",
    customer:{ name:"Mike Chen", phone:"(615) 555-0117", vehicle:"2024 Tesla Model Y" },
    liveLocationOptIn: false,
    paid: true,
  },
  {
    id: uuid(),
    serviceId:"basic", serviceTitle:"Basic Detail", priceCents:15000,
    startIso: todayPlus(-7, 9),
    address:"55 Oak Ridge Ln, Smyrna, TN 37167",
    travelMiles: 14.2, travelFeeCents: 2000,
    discountCents: 1000, totalCents: 15000+2000-1000, amountPaidTodayCents: 16000, balanceDueCents: 0,
    paymentChoice:"card_full", depositCents:2500, cardProcessingFeeCents:0, companyAppFeeCents:300, appFeeRoutingStatus:"ledger_only", paymentStatus:"complete",
    status:"complete",
    customer:{ name:"Emily Davis", phone:"(615) 555-0193", vehicle:"2019 Toyota RAV4" },
    liveLocationOptIn: true,
    paid: true,
  },
]);
