import React, { useEffect, useMemo, useState } from 'react';
import LOGO_DATA_URI from '../assets/The_Peoples_Detailing_Primary_Crest_Logo.webp';
import MASCOT_DATA_URI from '../assets/Booking_App_Hero_Concept_Mascot_Car_Logo.png';
import { calculateCheckoutTotals } from '../utils/fees.js';
import { calculateTravelFeeCents, estimateMilesFromAddress, milesBetween, MURFREESBORO_BASE } from '../utils/travel.js';
import { decodeVinSample, lookupVinDetails, normalizeVin } from '../utils/vin.js';

import {
  LS_KEY,
  PROMO_CODES,
  SERVICES,
  SETTINGS,
  cents,
  isoToDay,
  isoToTime,
  loadState,
  saveState,
  seedBookings,
  seedVehicles,
  todayPlus,
  uuid,
  vehicleLabel,
} from '../data/prototypeState.js';

/* ==== ICONS ==== */
const Icon = ({ name, className="w-5 h-5", strokeWidth=2 }) => {
  const paths = {
    home:"M3 9.5L12 3l9 6.5V21h-6v-7H9v7H3z",
    book:"M5 4h11a3 3 0 0 1 3 3v14H8a3 3 0 0 1-3-3V4z M5 4v17",
    msg:"M21 11.5a8.38 8.38 0 0 1-1.9 5.4A8.5 8.5 0 0 1 3 11.5a8.38 8.38 0 0 1 .9-3.8L3 21l5.3-1.4a8.5 8.5 0 0 0 4.2 1.1c4.7 0 8.5-3.8 8.5-8.5z",
    user:"M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
    chevR:"M9 6l6 6-6 6",
    chevL:"M15 6l-9 6 9 6",
    pin:"M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 1 1 18 0z M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
    nav:"M3 11l19-9-9 19-2-8-8-2z",
    bell:"M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9 M13.7 21a2 2 0 0 1-3.4 0",
    car:"M5 17h14 M3 12l2-5h14l2 5 M3 12v5h2v-2 M19 17v2h2v-2 M3 12h18 M7 14h.01 M17 14h.01",
    clock:"M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z M12 6v6l4 2",
    check:"M5 12l5 5 9-13",
    x:"M18 6 6 18 M6 6l12 12",
    plus:"M12 5v14 M5 12h14",
    minus:"M5 12h14",
    pencil:"M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z",
    cal:"M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z M16 2v4 M8 2v4 M3 10h18",
    download:"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3",
    receipt:"M16 3H8a2 2 0 0 0-2 2v16l3-2 3 2 3-2 3 2V5a2 2 0 0 0-2-2z",
    shield:"M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
    settings:"M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.32.78 1.07 1.27 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z",
    flag:"M4 22V4 M4 4l16 6-16 6 M4 16h16",
    truck:"M3 7h11v9H3z M14 10h4l3 3v3h-7 M5 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z M17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
    dollar:"M12 2v20 M17 5H9.5a3.5 3.5 0 0 0 0 7H14a3.5 3.5 0 0 1 0 7H6",
    chart:"M3 3v18h18 M7 14l4-4 4 4 6-6",
    users:"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M22 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75",
    play:"M6 4l14 8-14 8z",
    stop:"M6 6h12v12H6z",
    locate:"M12 2v3 M12 19v3 M2 12h3 M19 12h3 M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12z M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z",
    refresh:"M21 12a9 9 0 1 1-3-6.7L21 8 M21 3v5h-5",
  };
  const d = paths[name] || "";
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {d.split(" M").map((seg,i)=> <path key={i} d={(i===0?seg:"M"+seg)} />)}
    </svg>
  );
};

/* ==== BOTTOM NAV (rendered outside scroll-area) ==== */
const CUSTOMER_NAV_SCREENS = ["home","priceList","serviceDetail","myBookings","bookingDetail","messages","profile"];
const OWNER_NAV_SCREENS = ["ownerDash","ownerJobs","ownerJobDetail","ownerTracker","ownerReports","ownerServices","ownerSettings"];

const customerActiveTab = (screen) => {
  if (screen === "myBookings" || screen === "bookingDetail") return "myBookings";
  if (screen === "messages") return "messages";
  if (screen === "profile") return "profile";
  return "home";
};
const ownerActiveTab = (screen) => {
  if (screen === "ownerJobs" || screen === "ownerJobDetail") return "jobs";
  if (screen === "ownerTracker") return "tracker";
  if (screen === "ownerReports") return "reports";
  if (screen === "ownerSettings" || screen === "ownerServices") return "settings";
  return "dash";
};

const TRACKER_STEPS = [
  { id:"on_my_way", label:"On the Way", icon:"truck", customerMessage:"Dane is on the way." },
  { id:"arrived", label:"I'm Here", icon:"locate", customerMessage:"Dane has arrived." },
  { id:"complete", label:"Completed", icon:"check", customerMessage:"The job is marked complete." },
];

const isReadyExternalUrl = (url) => /^https?:\/\//i.test(url || "");

const BottomNavShell = ({ role, screen, setScreen }) => {
  if (role === "customer" && CUSTOMER_NAV_SCREENS.includes(screen)) {
    return (
      <div className="bottom-nav-shell">
        <div className="flex items-center justify-around py-2 px-3">
          {[
            { id:"home", icon:"home", label:"Home" },
            { id:"myBookings", icon:"book", label:"Bookings" },
            { id:"messages", icon:"msg", label:"Messages" },
            { id:"profile", icon:"user", label:"Profile" },
          ].map(t => {
            const active = customerActiveTab(screen) === t.id;
            return (
              <button key={t.id} onClick={()=> setScreen(t.id)} className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl ${active?"nav-chip-active":"text-[#9FB3C8]"}`}>
                <Icon name={t.icon} className="w-5 h-5" />
                <span className="text-[10px] font-semibold">{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }
  if (role === "owner" && OWNER_NAV_SCREENS.includes(screen)) {
    return (
      <div className="bottom-nav-shell">
        <div className="flex items-center justify-around py-2 px-3">
          {[
            { id:"dash", target:"ownerDash", icon:"home", label:"Dash" },
            { id:"jobs", target:"ownerJobs", icon:"cal", label:"Jobs" },
            { id:"tracker", target:"ownerTracker", icon:"flag", label:"Tracker" },
            { id:"reports", target:"ownerReports", icon:"chart", label:"Reports" },
            { id:"settings", target:"ownerSettings", icon:"settings", label:"Settings" },
          ].map(t => {
            const active = ownerActiveTab(screen) === t.id;
            return (
              <button key={t.id} onClick={()=> setScreen(t.target)} className={`flex flex-col items-center gap-1 py-1 px-2 rounded-xl ${active?"nav-chip-active":"text-[#9FB3C8]"}`}>
                <Icon name={t.icon} className="w-5 h-5" />
                <span className="text-[10px] font-semibold">{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }
  return null;
};

/* ==== APP ==== */
const App = () => {
  const initial = loadState();
  const [role, setRole] = useState(initial?.role || "customer"); // customer | owner
  const [screen, setScreen] = useState(initial?.screen || "splash");
  const [bookings, setBookings] = useState(initial?.bookings || seedBookings());
  const [services, setServices] = useState(initial?.services || SERVICES);
  const [draft, setDraft] = useState(initial?.draft || null);
  const [activeBookingId, setActiveBookingId] = useState(initial?.activeBookingId || null);
  const [toast, setToast] = useState(null);
  const [settings, setSettings] = useState(() => ({ ...SETTINGS, ...(initial?.settings || {}) }));
  const [vehicles, setVehicles] = useState(initial?.vehicles || seedVehicles());
  const [activeVehicleId, setActiveVehicleId] = useState(initial?.activeVehicleId || (initial?.vehicles?.find(v=>v.isDefault)?.id) || "vehicle-demo-1");
  const activeVehicle = vehicles.find(v => v.id === activeVehicleId) || vehicles[0];

  // Persist
  useEffect(() => {
    saveState({ role, screen, bookings, services, draft, settings, activeBookingId, vehicles, activeVehicleId });
  }, [role, screen, bookings, services, draft, settings, activeBookingId, vehicles, activeVehicleId]);

  // Clear toast whenever the screen or role changes (prevents toast leak across screens)
  useEffect(() => { setToast(null); }, [screen, role]);

  const showToast = msg => {
    setToast(msg);
    setTimeout(()=> setToast(null), 2600);
  };

  const resetApp = () => {
    localStorage.removeItem(LS_KEY);
    setRole("customer"); setScreen("splash"); setBookings(seedBookings()); setServices(SERVICES); setDraft(null); setActiveBookingId(null); setSettings({...SETTINGS}); setVehicles(seedVehicles()); setActiveVehicleId("vehicle-demo-1");
    showToast("Demo reset");
  };

  // Customer flow helpers
  const startBooking = serviceId => {
    const svc = services.find(s=>s.id===serviceId);
    setDraft({
      serviceId,
      serviceTitle: svc.title,
      priceCents: svc.priceCents,
      date: todayPlus(3, 10),
      address: "",
      lat: null, lng: null,
      liveLocationOptIn: false,
      vehicleId: activeVehicle?.id || "vehicle-demo-1",
      vehicleLabel: vehicleLabel(activeVehicle),
      travelMiles: 0,
      travelFeeCents: 0,
      promoCode: "",
      discountCents: 0,
    });
    setScreen("book");
  };

  const beginReschedule = bookingId => {
    const booking = bookings.find(b => b.id === bookingId);
    if (!booking || booking.status !== "confirmed") {
      showToast("Only confirmed bookings can be rescheduled");
      return;
    }
    const svc = services.find(s => s.id === booking.serviceId) || services[0];
    setDraft({
      rescheduleBookingId: booking.id,
      serviceId: booking.serviceId,
      serviceTitle: booking.serviceTitle,
      priceCents: booking.priceCents || svc.priceCents,
      date: booking.startIso,
      address: booking.address,
      lat: null, lng: null,
      liveLocationOptIn: booking.liveLocationOptIn,
      vehicleId: activeVehicle?.id || "vehicle-demo-1",
      vehicleLabel: booking.customer?.vehicle || vehicleLabel(activeVehicle),
      travelMiles: booking.travelMiles || 0,
      travelFeeCents: booking.travelFeeCents || 0,
      promoCode: booking.promoCode || "",
      discountCents: booking.discountCents || 0,
    });
    setActiveBookingId(booking.id);
    setScreen("book");
    showToast("Pick a new date or time");
  };

  const finishReschedule = ({ date, liveLocationOptIn, vehicleLabel }) => {
    const bookingId = draft?.rescheduleBookingId;
    if (!bookingId) return;
    setBookings(bs => bs.map(b => b.id === bookingId ? {
      ...b,
      startIso: date,
      liveLocationOptIn,
      customer: { ...b.customer, vehicle: vehicleLabel || b.customer?.vehicle },
      rescheduledAt: Date.now(),
    } : b));
    setActiveBookingId(bookingId);
    setDraft(null);
    setScreen("bookingDetail");
    showToast("Booking rescheduled");
  };

  const confirmBooking = (draftOverride = null) => {
    const finalDraft = draftOverride || draft;
    if (!finalDraft) {
      showToast("Start a booking first");
      setScreen("home");
      return;
    }
    // Tim/Mac v46 protected fix: booking total must match checkout total.
    // Include app fee and card-processing fee so the confirmation/owner screens do not
    // fall back to service + travel - discount only after the customer pays.
    const serviceAndTravelCents = finalDraft.priceCents + finalDraft.travelFeeCents;
    const totalCents = serviceAndTravelCents - finalDraft.discountCents + (finalDraft.appFeeCents || 0) + (finalDraft.cardProcessingFeeCents || 0);
    const booking = {
      id: uuid(),
      serviceId: finalDraft.serviceId,
      serviceTitle: finalDraft.serviceTitle,
      priceCents: finalDraft.priceCents,
      startIso: finalDraft.date,
      address: finalDraft.address || "123 Demo St, Murfreesboro, TN 37130",
      travelMiles: finalDraft.travelMiles,
      travelFeeCents: finalDraft.travelFeeCents,
      discountCents: finalDraft.discountCents,
      appFeeCents: finalDraft.appFeeCents || 0,
      customerPaysCardProcessingFee: finalDraft.customerPaysCardProcessingFee ?? true,
      cardProcessingFeeCents: finalDraft.cardProcessingFeeCents || 0,
      cardProcessingPercent: finalDraft.cardProcessingPercent,
      cardProcessingFixedCents: finalDraft.cardProcessingFixedCents,
      customerNotificationMethod: finalDraft.customerNotificationMethod || "email",
      ownerNotificationMethod: finalDraft.ownerNotificationMethod || "sms",
      totalCents,
      status:"confirmed",
      customer:{ name:"You (Demo)", phone:"(615) 555-0123", vehicle: finalDraft.vehicleLabel || vehicleLabel(activeVehicle) },
      liveLocationOptIn: finalDraft.liveLocationOptIn,
      paid: true,
      promoCode: finalDraft.promoCode || null,
    };
    setBookings(b => [booking, ...b]);
    setDraft(null);
    setActiveBookingId(booking.id);
    setScreen("confirmation");
  };

  // Owner tracker state on a booking
  const updateTracker = (bookingId, status) => {
    setBookings(bs => bs.map(b => b.id===bookingId ? {...b, trackerStatus: status, lastTrackerAt: Date.now()} : b));
    showToast(`Marked: ${status}`);
  };

  const completeJob = bookingId => {
    setBookings(bs => bs.map(b => b.id===bookingId ? {...b, status:"complete", trackerStatus:"complete"} : b));
    showToast("Job complete");
  };

  const cancelBooking = bookingId => {
    setBookings(bs => bs.map(b => b.id===bookingId ? {...b, status:"cancelled"} : b));
    showToast("Booking cancelled");
  };

  const props = {
    role, setRole,
    screen, setScreen,
    bookings, setBookings,
    services, setServices,
    draft, setDraft,
    activeBookingId, setActiveBookingId,
    settings, setSettings,
    vehicles, setVehicles, activeVehicleId, setActiveVehicleId, activeVehicle,
    confirmBooking, startBooking, beginReschedule, finishReschedule,
    updateTracker, completeJob, cancelBooking,
    resetApp, showToast,
  };

  return (
    <div className="min-h-screen flex flex-col items-center">
      <DemoBar role={role} setRole={setRole} setScreen={setScreen} resetApp={resetApp} />
      <div className="py-8 flex justify-center w-full">
        <div className="phone-shell">
          <div className="notch" />
          <div className="scroll-area">
            <Screen {...props} />
          </div>
          <BottomNavShell role={role} screen={screen} setScreen={setScreen} />
          {toast && <div className="toast">{toast}</div>}
        </div>
      </div>
      <FooterNote />
    </div>
  );
};

const DemoBar = ({ role, setRole, setScreen, resetApp }) => (
  <div className="demo-bar w-full">
    <div className="max-w-[800px] mx-auto px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-3">
        <img src={LOGO_DATA_URI} alt="" className="w-9 h-9 rounded-md" />
        <div className="leading-tight">
          <div className="text-sm font-semibold text-white">The Peoples Detailing — Booking Prototype</div>
          <div className="text-[11px] text-[--muted]" style={{color:"#9FB3C8"}}>Demo only · mock data · all flows clickable</div>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <div className="role-toggle flex">
          <button className={`px-3 py-1.5 rounded-full text-xs font-semibold ${role==="customer"?"active":"text-[--muted]"}`} style={{color:role==="customer"?"#fff":"#9FB3C8"}} onClick={()=>{setRole("customer"); setScreen("home");}}>Customer</button>
          <button className={`px-3 py-1.5 rounded-full text-xs font-semibold ${role==="owner"?"active":"text-[--muted]"}`} style={{color:role==="owner"?"#fff":"#9FB3C8"}} onClick={()=>{setRole("owner"); setScreen("ownerDash");}}>Owner</button>
        </div>
        <button onClick={resetApp} className="text-xs px-3 py-1.5 rounded-full border border-[#1f3b5c] text-[#9FB3C8] hover:text-white">Reset demo</button>
      </div>
    </div>
  </div>
);

const FooterNote = () => {
  const isDebug = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("demo") === "1";
  if (!isDebug) return null;
  return (
    <div className="text-center text-xs text-[#5e7894] pb-8 px-4 max-w-[600px]">
      Prototype built from <code>App_Build_Master_Spec.md</code>. Browser GPS estimate only; no real payments or calendar.
      The next step is "make it active" — see <code>App_Build_Packet/HOW_TO_MAKE_IT_ACTIVE.md</code>.
    </div>
  );
};

/* ==== SCREEN ROUTER ==== */
const Screen = (p) => {
  if (p.role === "customer") {
    switch (p.screen) {
      case "splash": return <Splash {...p} />;
      case "home": return <Home {...p} />;
      case "priceList": return <PriceList {...p} />;
      case "serviceDetail": return <ServiceDetail {...p} />;
      case "book": return <BookForm {...p} />;
      case "location": return <LocationStep {...p} />;
      case "checkout": return <Checkout {...p} />;
      case "confirmation": return <Confirmation {...p} />;
      case "myBookings": return <MyBookings {...p} />;
      case "bookingDetail": return <BookingDetail {...p} />;
      case "profile": return <CustomerProfile {...p} />;
      case "vehicles": return <VehicleManager {...p} />;
      case "messages": return <CustomerMessages {...p} />;
      default: return <Home {...p} />;
    }
  } else {
    switch (p.screen) {
      case "ownerDash": return <OwnerDash {...p} />;
      case "ownerJobs": return <OwnerJobs {...p} />;
      case "ownerJobDetail": return <OwnerJobDetail {...p} />;
      case "ownerTracker": return <OwnerTracker {...p} />;
      case "ownerReports": return <OwnerReports {...p} />;
      case "ownerServices": return <OwnerServices {...p} />;
      case "ownerSettings": return <OwnerSettings {...p} />;
      default: return <OwnerDash {...p} />;
    }
  }
};

/* ==== CUSTOMER SCREENS ==== */
const Splash = ({ setScreen }) => (
  <div className="splash-glow h-full flex flex-col items-center justify-between px-7 pt-16 pb-10 text-center">
    <div className="flex flex-col items-center gap-3 mt-6">
      <img src={LOGO_DATA_URI} alt="The Peoples Detailing" className="w-28 h-28 rounded-2xl" />
      <div className="text-[11px] tracking-[.2em] text-[#9FB3C8] uppercase mt-1">EST. 2018</div>
    </div>
    <div className="flex-1 flex items-center">
      <img src={MASCOT_DATA_URI} alt="The Peoples Detailing mascot" className="w-72 max-h-72 object-contain drop-shadow-[0_20px_30px_rgba(0,0,0,.5)]" />
    </div>
    <div className="w-full flex flex-col gap-2 items-center">
      <h1 className="text-3xl font-extrabold tracking-tight">The Peoples Detailing</h1>
      <p className="text-[#9FB3C8] text-sm mb-4">Mobile car detailing — we come to you</p>
      <button className="btn-primary" onClick={()=> setScreen("home")}>Book Now</button>
      <button className="btn-secondary mt-2" onClick={()=> setScreen("priceList")}>Browse Services</button>
    </div>
  </div>
);

const HeaderBar = ({ title, subtitle, onBack, right }) => (
  <div className="px-5 pt-12 pb-4 flex items-center gap-3">
    {onBack && (
      <button aria-label="Go back" onClick={onBack} className="w-9 h-9 rounded-full border border-[#1f3b5c] flex items-center justify-center text-white">
        <Icon name="chevL" className="w-4 h-4" />
      </button>
    )}
    <div className="flex-1 min-w-0">
      {subtitle && <div className="text-[11px] text-[#9FB3C8] tracking-wider uppercase">{subtitle}</div>}
      <div role="heading" aria-level="1" className="text-xl font-bold text-white truncate">{title}</div>
    </div>
    {right}
  </div>
);

const TopBrandHeader = ({ onNotifications }) => (
  <div className="px-5 pt-12 pb-2 flex items-center justify-between">
    <div className="flex items-center gap-2">
      <img src={LOGO_DATA_URI} alt="" className="w-9 h-9 rounded-md" />
      <div className="leading-tight">
        <div className="text-sm font-bold">The Peoples</div>
        <div className="text-[10px] text-[#9FB3C8] tracking-wider uppercase">Detailing</div>
      </div>
    </div>
    <div className="flex items-center gap-2">
      <button
        aria-label="Open messages and notifications"
        className="w-9 h-9 rounded-full bg-[#102A43] border border-[#1f3b5c] flex items-center justify-center"
        onClick={onNotifications}
      >
        <Icon name="bell" className="w-4 h-4 text-white" />
      </button>
    </div>
  </div>
);

const Home = (p) => (
  <div className="pb-6">
    <TopBrandHeader onNotifications={()=> p.setScreen("messages")} />

    <div className="px-5 pt-2">
      <div className="gradient-hero rounded-2xl p-5 min-h-[150px] flex items-center gap-4 border border-[#1a3553] overflow-hidden">
        <img src={MASCOT_DATA_URI} alt="The Peoples Detailing mascot" className="w-28 h-32 shrink-0 object-contain object-bottom drop-shadow-[0_12px_20px_rgba(0,0,0,.45)]" />
        <div className="flex-1">
          <div className="text-[11px] uppercase tracking-wider text-[var(--orange)] font-semibold">{p.settings.homeTaglineKicker}</div>
          <div className="text-lg font-bold leading-tight mt-1">{p.settings.homeTagline}</div>
          <div className="text-xs text-[#9FB3C8] mt-1">Free estimates · Premium products · Local team</div>
        </div>
      </div>
    </div>

    <div className="flex items-center justify-between px-5 mt-5 mb-2">
      <div className="text-base font-bold">Our Services</div>
      <div className="text-xs text-[#9FB3C8]">{p.services.filter(s=>s.visible!==false).length} packages</div>
    </div>

    <div className="px-5 flex flex-col gap-3">
      {p.services.filter(s=>s.visible!==false).map(svc => (
        <button key={svc.id} className="card flex items-center justify-between text-left active:scale-[.99] transition" onClick={()=>{ p.setActiveBookingId(svc.id); p.setScreen("serviceDetail"); }}>
          <div className="flex-1 min-w-0">
            <div className="text-base font-bold truncate">{svc.title}</div>
            <div className="text-xs text-[#9FB3C8] mt-1 clamp-2">{svc.blurb}</div>
            <div className="text-[11px] text-[#9FB3C8] mt-1">{svc.durationHours} hrs · {svc.cadence}</div>
          </div>
          <div className="flex flex-col items-end">
            <div className="price-orange text-lg">{cents(svc.priceCents)}{svc.badge && <span className="text-xs">{svc.badge}</span>}</div>
            <Icon name="chevR" className="w-5 h-5 text-[#9FB3C8] mt-1" />
          </div>
        </button>
      ))}
    </div>

    <div className="mt-6">
      <div className="px-5 flex items-center justify-between mb-2">
        <div className="text-xs text-[#9FB3C8] uppercase tracking-wider">Also available</div>
        <div className="text-[10px] text-[#9FB3C8]">Swipe →</div>
      </div>
      <div className="flex gap-2 overflow-x-auto px-5 pb-1" style={{scrollbarWidth:"none"}}>
        {["Pressure Washing","Shampooing","Waxing","Vacuuming","Window Detail"].map(t => (
          <span key={t} className="whitespace-nowrap text-xs px-3 py-2 bg-[#0d2236] border border-[#1f3b5c] rounded-full text-white flex-shrink-0">{t}</span>
        ))}
      </div>
      <div className="px-5 text-[11px] text-[#9FB3C8] mt-3">{p.settings.homeFooterPhone}</div>
    </div>

    </div>
);

const PriceList = (p) => (
  <div className="pb-6">
    <HeaderBar title="Price List" subtitle="Saved service menu" onBack={()=> p.setScreen("splash")} />
    <div className="px-5">
      <div className="card">
        <div className="text-sm font-semibold">Detailing packages</div>
        <div className="text-xs text-[#9FB3C8] mt-1">
          These are the saved package prices used by checkout. Travel, discounts, and the app fee are shown before payment.
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {p.services.filter(s=>s.visible!==false).map(svc => (
          <div key={svc.id} className="card">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-base font-bold">{svc.title}</div>
                <div className="text-xs text-[#9FB3C8] mt-1">{svc.durationHours} hrs · {svc.cadence}</div>
              </div>
              <div className="price-orange text-lg whitespace-nowrap">{cents(svc.priceCents)}{svc.badge && <span className="text-xs">{svc.badge}</span>}</div>
            </div>
            <div className="text-xs text-[#9FB3C8] mt-2">{svc.blurb}</div>
            <div className="mt-3 grid gap-1.5">
              {svc.bullets.map(item => (
                <div key={item} className="flex gap-2 text-xs text-[#d8e3ee]">
                  <Icon name="check" className="w-3.5 h-3.5 text-[var(--orange)] flex-shrink-0 mt-0.5" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
            <button className="btn-secondary mt-4" onClick={()=> p.startBooking(svc.id)}>Book {svc.title}</button>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const ServiceDetail = (p) => {
  const svc = p.services.find(s => s.id === p.activeBookingId) || p.services[0];
  return (
    <div className="pb-6">
      <HeaderBar title={svc.title} subtitle="Service" onBack={()=> p.setScreen("home")} />
      <div className="px-5 mt-2">
        <div className="card flex items-start justify-between">
          <div>
            <div className="text-2xl font-extrabold">{cents(svc.priceCents)}{svc.badge && <span className="text-base">{svc.badge}</span>}</div>
            <div className="text-xs text-[#9FB3C8] mt-1">{svc.blurb}</div>
          </div>
          <div className="text-right text-xs text-[#9FB3C8]">
            <div>Duration: {svc.durationHours} hrs</div>
            <div>Recommended: {svc.cadence}</div>
          </div>
        </div>
        <div className="mt-5">
          <div className="text-base font-bold mb-2">What's Included</div>
          <ul className="flex flex-col gap-2">
            {svc.bullets.map((b,i)=>(
              <li key={i} className="flex gap-2 items-start">
                <div className="w-5 h-5 rounded-full bg-[var(--orange)]/15 text-[var(--orange)] flex items-center justify-center mt-0.5">
                  <Icon name="check" className="w-3 h-3" strokeWidth={3} />
                </div>
                <div className="text-sm text-white">{b}</div>
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-6">
          <button className="btn-primary glow-orange" onClick={()=> p.startBooking(svc.id)}>Book {svc.title}</button>
        </div>
      </div>
    </div>
  );
};

const Stepper = ({ step }) => (
  <div className="flex items-center gap-2 px-5 mt-3 mb-3">
    {["Service","Location","Checkout"].map((label,i) => (
      <React.Fragment key={label}>
        <div className="flex flex-col items-center text-[10px] uppercase tracking-wider min-w-[60px]" style={{color:i<=step?"#fff":"#9FB3C8"}}>
          <div className={`step-dot ${i<=step?"active":""} mb-1`} />
          {label}
        </div>
        {i<2 && <div className={`step-line ${i<step?"active":""}`} />}
      </React.Fragment>
    ))}
  </div>
);

const BookForm = (p) => {
  const svc = p.services.find(s => s.id === p.draft?.serviceId) || p.services[0];
  const [time, setTime] = useState(() => new Date(p.draft?.date || Date.now()));
  const [shareLive, setShareLive] = useState(p.draft?.liveLocationOptIn ?? false);
  const [showCal, setShowCal] = useState(false);
  const isReschedule = Boolean(p.draft?.rescheduleBookingId);
  const slots = ["8:00 AM","10:00 AM","12:00 PM","2:00 PM","4:00 PM"];

  // Build availability map from existing bookings (same source as the calendar overlay)
  const busyMap = useMemo(() => {
    const map = {};
    p.bookings.forEach(b => {
      if (b.status === "cancelled") return;
      const d = new Date(b.startIso);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      map[key] = (map[key] || 0) + 1;
    });
    return map;
  }, [p.bookings]);
  const busyKey = d => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const FULL_THRESHOLD = 3;

  const setSlot = label => {
    const [hStr,m] = label.split(/[: ]/);
    let h = parseInt(hStr,10);
    if (label.includes("PM") && h !== 12) h += 12;
    if (label.includes("AM") && h === 12) h = 0;
    const d = new Date(time); d.setHours(h, parseInt(m,10), 0, 0);
    setTime(d);
  };

  const next = () => {
    const currentVehicle = p.vehicles.find(v => v.id === p.activeVehicleId) || p.vehicles[0];
    if (isReschedule) {
      p.finishReschedule({
        date: time.toISOString(),
        liveLocationOptIn: shareLive,
        vehicleLabel: p.draft?.vehicleLabel || vehicleLabel(currentVehicle),
      });
      return;
    }
    p.setDraft({...p.draft, date: time.toISOString(), liveLocationOptIn: shareLive, vehicleId: currentVehicle?.id, vehicleLabel: vehicleLabel(currentVehicle) });
    p.setScreen("location");
  };

  // Strip starts at the picked date and shows that day + the next 5
  const stripStart = useMemo(() => { const d = new Date(time); d.setHours(0,0,0,0); return d; }, [time]);
  const dates = useMemo(() => Array.from({length:6}, (_,i) => { const d = new Date(stripStart); d.setDate(d.getDate()+i); return d; }), [stripStart]);
  const today0 = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);

  return (
    <div className="pb-6">
      <HeaderBar title={isReschedule ? "Reschedule Booking" : "Book Appointment"} subtitle={isReschedule ? "Pick a new date or time" : "Step 1 of 3"} onBack={()=> p.setScreen(isReschedule ? "bookingDetail" : "serviceDetail")} />
      {!isReschedule && <Stepper step={0} />}
      <div className="px-5">
        {isReschedule && (
          <div className="card mb-3 bg-[var(--orange)]/10 border-[var(--orange)]/30">
            <div className="text-sm font-semibold">No new payment in this prototype.</div>
            <div className="text-xs text-[#9FB3C8] mt-1">Choose the new date and time, then save it back to this same booking.</div>
          </div>
        )}
        <div className="card flex items-center justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-[#9FB3C8]">Service</div>
            <div className="text-base font-bold">{svc.title}</div>
          </div>
          <div className="price-orange text-lg">{cents(svc.priceCents)}</div>
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs uppercase tracking-wider text-[#9FB3C8]">Select Date</div>
            <button onClick={()=> setShowCal(true)} className="flex items-center gap-1 text-xs text-[var(--orange)] font-semibold">
              <Icon name="cal" className="w-4 h-4" />
              Pick a date
            </button>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1" style={{scrollbarWidth:"none"}}>
            {dates.map((d,i)=>{
              const same = d.toDateString() === time.toDateString();
              const busy = busyMap[busyKey(d)] || 0;
              const isFull = busy >= FULL_THRESHOLD;
              const isToday = d.getTime() === today0.getTime();
              const past = d < today0;
              return (
                <button
                  key={i}
                  disabled={past || isFull}
                  onClick={()=>{ const nd=new Date(d); nd.setHours(time.getHours(),time.getMinutes()); setTime(nd); }}
                  className={`relative min-w-[64px] flex-shrink-0 py-2 px-2 rounded-xl border ${
                    past || isFull ? "bg-[#0a1a2c] border-[#1f3b5c] text-[#3e5775] cursor-not-allowed" :
                    same ? "bg-[var(--orange)] border-[var(--orange)] text-white" :
                    "bg-[#0d2236] border-[#1f3b5c] text-white"
                  } ${isToday && !same ? "ring-1 ring-[var(--orange)]/60" : ""}`}
                >
                  <div className="text-[10px] uppercase tracking-wider opacity-80">{d.toLocaleDateString("en-US",{weekday:"short"})}</div>
                  <div className="text-base font-bold">{d.getDate()}</div>
                  {busy > 0 && !isFull && !same && (
                    <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[var(--orange)]" />
                  )}
                  {isFull && (
                    <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-3 h-0.5 rounded-full bg-[#f87171]" />
                  )}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-3 mt-2 text-[10px] text-[#9FB3C8]">
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[var(--orange)]" /> Has bookings</span>
            <span className="flex items-center gap-1"><span className="w-3 h-0.5 rounded-full bg-[#f87171]" /> Full</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded ring-1 ring-[var(--orange)]/60" /> Today</span>
          </div>
        </div>

        <div className="mt-5">
          <div className="text-xs uppercase tracking-wider text-[#9FB3C8] mb-2">Select Time</div>
          <div className="grid grid-cols-3 gap-2">
            {slots.map(s => {
              const sameTime = isoToTime(time.toISOString()).replace(/\s/g,"") === s.replace(/\s/g,"");
              return (
                <button key={s} onClick={()=> setSlot(s)} className={`py-2.5 rounded-xl border text-sm ${sameTime?"bg-[var(--orange)] border-[var(--orange)] text-white":"bg-[#0d2236] border-[#1f3b5c] text-white"}`}>{s}</button>
              );
            })}
          </div>
        </div>

        <div className="mt-5">
          <div className="text-xs uppercase tracking-wider text-[#9FB3C8] mb-2">Vehicle</div>
          <button className="card w-full flex items-center justify-between text-left active:scale-[.99] transition" onClick={()=> p.setScreen("vehicles")}>
            <div>
              <div className="text-sm font-semibold">{vehicleLabel(p.activeVehicle)} <span className="text-[#9FB3C8] font-normal text-xs ml-1">(selected)</span></div>
              <div className="text-xs text-[#9FB3C8] mt-1">Pick a saved vehicle or add a quick new one. Saved vehicles stay available for future bookings.</div>
            </div>
            <Icon name="chevR" className="w-4 h-4 text-[#9FB3C8]" />
          </button>
        </div>

        <div className="mt-5">
          <button onClick={()=> setShareLive(v=>!v)} className="w-full flex items-start gap-3 text-left card">
            <span className={`checkbox ${shareLive?"checked":""} mt-0.5`}>
              {shareLive && <Icon name="check" className="w-3 h-3 text-white" strokeWidth={3} />}
            </span>
            <div>
              <div className="text-sm font-semibold">Share live location on day-of</div>
              <div className="text-xs text-[#9FB3C8] mt-0.5">Helps our team find you. Optional.</div>
            </div>
          </button>
        </div>

        <div className="mt-6">
          <button className="btn-primary" onClick={next}>{isReschedule ? "Save New Date & Time" : "Continue to Location & Travel Fee"}</button>
        </div>
      </div>
      {showCal && (
        <CalendarPicker
          selected={time}
          bookings={p.bookings}
          onClose={()=> setShowCal(false)}
          onPick={d => { const nd=new Date(d); nd.setHours(time.getHours(),time.getMinutes()); setTime(nd); setShowCal(false); }}
        />
      )}
    </div>
  );
};

const CalendarPicker = ({ selected, bookings, onClose, onPick }) => {
  const [month, setMonth] = useState(() => new Date(selected.getFullYear(), selected.getMonth(), 1));
  const [pending, setPending] = useState(new Date(selected));

  // Build a 6x7 grid for the month
  const firstDow = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  const daysInMonth = new Date(month.getFullYear(), month.getMonth()+1, 0).getDate();
  const today = new Date(); today.setHours(0,0,0,0);

  // Bookings per ISO day key
  const busyMap = useMemo(() => {
    const map = {};
    bookings.forEach(b => {
      if (b.status === "cancelled") return;
      const d = new Date(b.startIso);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      map[key] = (map[key] || 0) + 1;
    });
    return map;
  }, [bookings]);

  const cells = [];
  for (let i=0; i<firstDow; i++) cells.push(null);
  for (let d=1; d<=daysInMonth; d++) cells.push(new Date(month.getFullYear(), month.getMonth(), d));
  while (cells.length % 7 !== 0) cells.push(null);

  const sameDay = (a,b) => a && b && a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
  const shiftMonth = delta => {
    const m = new Date(month); m.setMonth(m.getMonth() + delta); setMonth(m);
  };

  const monthLabel = month.toLocaleDateString("en-US",{month:"long",year:"numeric"});

  return (
    <div className="absolute inset-0 z-50 flex items-end justify-center" style={{background:"rgba(3,10,20,.7)"}}>
      <div className="w-full bg-[#0c2238] border-t border-[#1f3b5c] rounded-t-3xl p-5 pb-7" style={{boxShadow:"0 -20px 50px rgba(0,0,0,.6)"}}>
        <div className="flex items-center justify-between mb-3">
          <button onClick={()=> shiftMonth(-1)} className="w-9 h-9 rounded-full border border-[#1f3b5c] flex items-center justify-center"><Icon name="chevL" className="w-4 h-4" /></button>
          <div className="text-base font-bold">{monthLabel}</div>
          <button onClick={()=> shiftMonth(1)} className="w-9 h-9 rounded-full border border-[#1f3b5c] flex items-center justify-center"><Icon name="chevR" className="w-4 h-4" /></button>
        </div>
        <div className="grid grid-cols-7 gap-1 mb-1">
          {["S","M","T","W","T","F","S"].map((d,i) => (
            <div key={i} className="text-center text-[10px] uppercase tracking-wider text-[#9FB3C8] py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((d,i) => {
            if (!d) return <div key={i} className="h-10" />;
            const past = d < today;
            const isToday = sameDay(d, today);
            const isPicked = sameDay(d, pending);
            const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
            const busy = busyMap[key] || 0;
            const fullyBusy = busy >= 3; // mock: 3+ bookings same day = no slots
            return (
              <button
                key={i}
                disabled={past || fullyBusy}
                onClick={()=> setPending(d)}
                className={`h-10 rounded-lg text-sm relative ${
                  past || fullyBusy ? "text-[#3e5775] cursor-not-allowed" :
                  isPicked ? "bg-[var(--orange)] text-white font-bold" :
                  "text-white hover:bg-[#16365B]"
                } ${isToday && !isPicked ? "ring-1 ring-[var(--orange)]/60" : ""}`}
              >
                {d.getDate()}
                {busy > 0 && !fullyBusy && !isPicked && (
                  <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[var(--orange)]" />
                )}
                {fullyBusy && (
                  <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-3 h-0.5 rounded-full bg-[#f87171]" />
                )}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-3 mt-3 text-[10px] text-[#9FB3C8]">
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[var(--orange)]" /> Has bookings</span>
          <span className="flex items-center gap-1"><span className="w-3 h-0.5 rounded-full bg-[#f87171]" /> Full</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded ring-1 ring-[var(--orange)]/60" /> Today</span>
        </div>
        <div className="flex gap-2 mt-4">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={()=> onPick(pending)}>Use this date</button>
        </div>
      </div>
    </div>
  );
};

const LocationStep = (p) => {
  const [address, setAddress] = useState(p.draft?.address || "");
  const [useGps, setUseGps] = useState(false);
  const [miles, setMiles] = useState(p.draft?.travelMiles || 0);
  const [travelChecked, setTravelChecked] = useState(Boolean(p.draft?.address));
  const [gpsStatus, setGpsStatus] = useState("");
  const [addressStatus, setAddressStatus] = useState("");

  const radius = p.settings.freeTravelRadiusMiles;
  const travelFeeCents = useMemo(() => {
    return calculateTravelFeeCents(miles, p.settings);
  }, [miles, radius, p.settings.perMileFeeCents]);

  const useCurrentLocation = () => {
    setUseGps(true);
    setGpsStatus("Requesting browser location...");

    const useDemoLocation = () => {
      setAddress("Current location (demo fallback) · 218 Demo Ave, Murfreesboro, TN");
      setMiles(12.4);
      setTravelChecked(true);
      setGpsStatus("Demo location used because browser GPS was unavailable.");
      setAddressStatus("");
      p.showToast("Using demo location");
    };

    if (!navigator.geolocation) {
      useDemoLocation();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const customerLocation = { lat: coords.latitude, lng: coords.longitude };
        const estimatedMiles = milesBetween(MURFREESBORO_BASE, customerLocation);
        setAddress(`GPS location captured · ${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`);
        setMiles(Number(estimatedMiles.toFixed(1)));
        setTravelChecked(true);
        setGpsStatus(`Browser GPS captured. Distance is estimated from ${p.settings.baseAddress || SETTINGS.baseAddress}.`);
        setAddressStatus("");
        p.showToast("GPS location captured");
      },
      () => useDemoLocation(),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 },
    );
  };

  const checkTravelFee = () => {
    const cleanAddress = address.trim();
    if (!cleanAddress) {
      setAddressStatus("Enter a service address or use current location before checking the travel fee.");
      return null;
    }

    if (useGps && miles > 0) {
      setTravelChecked(true);
      setAddressStatus("Travel fee checked from the current location estimate.");
      return { finalMiles: miles, finalAddress: cleanAddress };
    }

    const estimate = estimateMilesFromAddress(cleanAddress);
    if (!estimate) {
      setTravelChecked(false);
      setAddressStatus("I could not estimate that address yet. Add a supported city or ZIP like Franklin, TN 37064, or use current location.");
      return null;
    }

    const finalMiles = estimate.miles;
    const finalAddress = estimate.label === cleanAddress ? cleanAddress : `${cleanAddress} (${estimate.label})`;
    setMiles(finalMiles);
    setTravelChecked(true);
    setAddressStatus(`Travel fee checked from ${estimate.label} using the city or ZIP in the typed address.`);
    return { finalMiles, finalAddress };
  };

  const next = () => {
    const cleanAddress = address.trim();
    if (!cleanAddress) {
      setAddressStatus("Enter a service address or use current location before checkout.");
      return;
    }

    if (!travelChecked) {
      setAddressStatus("Check the travel fee before continuing to checkout.");
      return;
    }

    const checked = useGps ? { finalMiles: miles, finalAddress: cleanAddress } : checkTravelFee();
    if (!checked) return;

    const { finalMiles, finalAddress } = checked;
    const finalTravelFeeCents = calculateTravelFeeCents(finalMiles, p.settings);
    p.setDraft({...p.draft, address: finalAddress, travelMiles: finalMiles, travelFeeCents: finalTravelFeeCents });
    p.setScreen("checkout");
  };

  return (
    <div className="pb-6">
      <HeaderBar title="Location & Travel Fee" subtitle="Step 2 of 3" onBack={()=> p.setScreen("book")} />
      <Stepper step={1} />
      <div className="px-5">
        <div className="card">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 shrink-0 rounded-2xl bg-[var(--orange)]/15 border border-[var(--orange)]/35 text-[var(--orange)] flex items-center justify-center">
              <Icon name="locate" className="w-5 h-5" />
            </div>
            <div>
              <div className="label-up mb-1">Service Location</div>
              <div className="text-sm font-semibold">Check the address before checkout</div>
              <div className="text-xs text-[#9FB3C8] mt-1">
                Enter a city, ZIP, or service address so the app can show the travel fee on this step.
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4">
          <div className="text-xs uppercase tracking-wider text-[#9FB3C8] mb-2">Service Address</div>
          <input className="input" placeholder="Enter address, city, or ZIP, like 405 Main St, Franklin, TN 37064" value={address} onChange={e=> { setAddress(e.target.value); setAddressStatus(""); setGpsStatus(""); setUseGps(false); setTravelChecked(false); if (miles !== 0) setMiles(0); }} />
          <button className="btn-primary mt-2 flex items-center justify-center gap-2" onClick={checkTravelFee}>
            <Icon name="check" className="w-4 h-4" />
            <span>Check travel fee</span>
          </button>
          <button className="btn-secondary mt-2 flex items-center justify-center gap-2" onClick={useCurrentLocation}>
            <Icon name="locate" className="w-4 h-4" />
            <span>Use my current location</span>
          </button>
          {gpsStatus && <div className="text-[11px] text-[#9FB3C8] mt-2">{gpsStatus}</div>}
          {addressStatus && <div className="text-[11px] text-[#fed7aa] mt-2">{addressStatus}</div>}
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2">
          <div className="card text-center">
            <div className="text-[10px] uppercase tracking-wider text-[#9FB3C8]">Distance</div>
            <div className="text-base font-bold mt-1">{travelChecked ? `${miles.toFixed(1)} mi` : "—"}</div>
          </div>
          <div className="card text-center">
            <div className="text-[10px] uppercase tracking-wider text-[#9FB3C8]">ETA</div>
            <div className="text-base font-bold mt-1">{travelChecked ? `${Math.round(miles*1.5)} min` : "—"}</div>
          </div>
          <div className="card text-center">
            <div className="text-[10px] uppercase tracking-wider text-[#9FB3C8]">Travel Fee</div>
            <div className="text-base font-bold mt-1 price-orange">{!travelChecked ? "Pending" : travelFeeCents === 0 ? "Free" : cents(travelFeeCents)}</div>
          </div>
        </div>

        <div className="text-[11px] text-[#9FB3C8] mt-3">
          Free within {radius} miles of our base. Then {cents(p.settings.perMileFeeCents)}/mile beyond.
        </div>

        <div className="mt-6">
          <button className="btn-primary" onClick={next}>Continue to Checkout</button>
        </div>
      </div>
    </div>
  );
};

const Checkout = (p) => {
  const [promo, setPromo] = useState(p.draft?.promoCode || "");
  const [appliedPromo, setAppliedPromo] = useState(null);
  const [showAppFeeInfo, setShowAppFeeInfo] = useState(false);
  const [showCardFeeInfo, setShowCardFeeInfo] = useState(false);

  const subtotal = (p.draft?.priceCents||0) + (p.draft?.travelFeeCents||0);
  const discountCents = useMemo(() => {
    if (!appliedPromo) return 0;
    if (appliedPromo.type==="amountOff") return appliedPromo.amountCents;
    if (appliedPromo.type==="percentOff") return Math.round(subtotal * appliedPromo.percent / 100);
    return 0;
  }, [appliedPromo, subtotal]);
  const checkoutTotals = calculateCheckoutTotals({
    servicePriceCents: p.draft?.priceCents || 0,
    travelFeeCents: p.draft?.travelFeeCents || 0,
    discountCents,
    settings: p.settings,
  });
  const appFeeCents = checkoutTotals.appFeeCents;
  const customerPaysCardProcessingFee = p.settings?.customerPaysCardProcessingFee ?? SETTINGS.customerPaysCardProcessingFee;
  const brandNewInfoUrl = p.settings?.brandNewInfoUrl || SETTINGS.brandNewInfoUrl;
  const brandNewLinkReady = isReadyExternalUrl(brandNewInfoUrl);
  const cardProcessingPercent = p.settings?.cardProcessingPercent ?? 2.9;
  const cardProcessingFixedCents = p.settings?.cardProcessingFixedCents ?? 30;
  const cardProcessingFeeCents = checkoutTotals.cardProcessingFeeCents;
  const total = checkoutTotals.totalCents;

  const applyPromo = () => {
    const found = PROMO_CODES.find(c => c.code.toLowerCase() === promo.trim().toLowerCase());
    if (found) {
      setAppliedPromo(found);
      p.showToast(`Promo applied: ${found.label}`);
    } else {
      setAppliedPromo(null);
      p.showToast("Invalid code");
    }
  };

  const pay = () => {
    const finalDraft = {
      ...p.draft,
      discountCents,
      promoCode: appliedPromo?.code || "",
      appFeeCents,
      customerPaysCardProcessingFee,
      cardProcessingFeeCents,
      cardProcessingPercent,
      cardProcessingFixedCents,
      customerNotificationMethod: p.settings?.customerNotificationMethod || "email",
      ownerNotificationMethod: p.settings?.ownerNotificationMethod || "sms"
    };
    p.setDraft(finalDraft);
    setTimeout(() => p.confirmBooking(finalDraft), 350);
    p.showToast("Processing payment…");
  };

  return (
    <div className="pb-6">
      <HeaderBar title="Checkout" subtitle="Step 3 of 3" onBack={()=> p.setScreen("location")} />
      <Stepper step={2} />
      <div className="px-5">
        <div className="text-xs uppercase tracking-wider text-[#9FB3C8] mb-2">Service Summary</div>
        <div className="card flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">{p.draft?.serviceTitle}</div>
            <div className="text-xs text-[#9FB3C8] mt-0.5">{isoToDay(p.draft?.date)} · {isoToTime(p.draft?.date)}</div>
          </div>
          <div className="price-orange text-base">{cents(p.draft?.priceCents)}</div>
        </div>

        <div className="text-xs uppercase tracking-wider text-[#9FB3C8] mt-4 mb-2">Service Address</div>
        <div className="card text-sm">{p.draft?.address}</div>

        <div className="mt-4">
          <div className="text-xs uppercase tracking-wider text-[#9FB3C8] mb-2">Promo Code</div>
          <div className="flex gap-2">
            <input className="input flex-1" placeholder="Try PEOPLES10" value={promo} onChange={e=> setPromo(e.target.value)} />
            <button className="px-4 rounded-xl border border-[#1f3b5c] text-white text-sm" onClick={applyPromo}>Apply</button>
          </div>
          {appliedPromo && <div className="text-xs text-[#4ade80] mt-2">{appliedPromo.code} applied — {appliedPromo.label}</div>}
        </div>

        <div className="card mt-5">
          <Row label="Subtotal" value={cents(p.draft?.priceCents)} />
          <Row label="Travel fee" value={p.draft?.travelFeeCents===0 ? "Free" : cents(p.draft?.travelFeeCents)} />
          {discountCents>0 && <Row label="Discount" value={`- ${cents(discountCents)}`} valueClass="text-[#4ade80]" />}
          <Row
            label={
              <span className="inline-flex items-center gap-1">
                App fee
                <button
                  type="button"
                  onClick={() => setShowAppFeeInfo(v => !v)}
                  className="w-5 h-5 rounded-full border border-[#1f3b5c] text-[10px] text-[#9FB3C8] inline-flex items-center justify-center"
                  aria-label="What is the app fee?"
                >?</button>
              </span>
            }
            value={appFeeCents===0 ? "Free" : cents(appFeeCents)}
          />
          {showAppFeeInfo && (
            <div className="mt-2 rounded-xl border border-[#1f3b5c] bg-[#0d2236] p-3 text-xs text-[#9FB3C8] leading-relaxed">
              <div>{p.settings?.appFeeInfoText || SETTINGS.appFeeInfoText}</div>
              <div className="mt-3 pt-3 border-t border-[#1f3b5c]">
                {brandNewLinkReady ? (
                  <a
                    href={brandNewInfoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center rounded-xl border border-[#f97316]/60 px-3 py-2 text-[#fed7aa] hover:bg-[#f97316]/10"
                  >
                    Learn about BrandNew Design
                  </a>
                ) : (
                  <div className="inline-flex items-center justify-center rounded-xl border border-[#1f3b5c] px-3 py-2 text-[#9FB3C8]">
                    BrandNew Design link coming soon
                  </div>
                )}
                <div className="mt-2 text-[11px] text-[#9FB3C8]">
                  {p.settings?.brandNewReferralText || SETTINGS.brandNewReferralText}
                </div>
              </div>
            </div>
          )}
          <Row
            label={
              <span className="inline-flex items-center gap-1">
                Card processing fee
                <button
                  type="button"
                  onClick={() => setShowCardFeeInfo(v => !v)}
                  className="w-5 h-5 rounded-full border border-[#1f3b5c] text-[10px] text-[#9FB3C8] inline-flex items-center justify-center"
                  aria-label="What is the card processing fee?"
                >?</button>
              </span>
            }
            value={customerPaysCardProcessingFee ? cents(cardProcessingFeeCents) : "Covered by business"}
          />
          {showCardFeeInfo && (
            <div className="mt-2 rounded-xl border border-[#1f3b5c] bg-[#0d2236] p-3 text-xs text-[#9FB3C8] leading-relaxed">
              {p.settings?.cardProcessingInfoText || SETTINGS.cardProcessingInfoText}
            </div>
          )}
          <div className="divider my-2" />
          <Row label={<span className="text-white font-bold">Total due today</span>} value={<span className="price-orange text-lg">{cents(total)}</span>} bold />
          <div className="mt-2 text-[11px] text-[#9FB3C8] leading-relaxed">No surprise charges — this is your full total before payment.</div>
        </div>

        <div className="flex items-center gap-2 text-xs text-[#9FB3C8] mt-3">
          <Icon name="shield" className="w-4 h-4 text-[#4ade80]" />
          <span>Secure checkout placeholder - Stripe can be connected later - Full total shown before payment</span>
        </div>

        <div className="mt-5">
          <button className="btn-primary glow-orange flex items-center justify-center gap-2" onClick={pay}>
            <Icon name="receipt" className="w-4 h-4" />
            <span>Pay with Card · {cents(total)}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

const Row = ({ label, value, valueClass="", bold=false }) => (
  <div className="flex items-center justify-between text-sm py-1">
    <div className={`text-[#9FB3C8] ${bold?"text-white":""}`}>{label}</div>
    <div className={`text-white ${valueClass}`}>{value}</div>
  </div>
);

const Confirmation = (p) => {
  const b = p.bookings.find(b => b.id === p.activeBookingId) || p.bookings[0];
  if (!b) {
    return (
      <div className="p-6 text-center">
        <div className="text-base font-bold mb-2">No bookings yet</div>
        <button className="btn-primary" onClick={()=> p.setScreen("home")}>Back to Home</button>
      </div>
    );
  }
  return (
    <div className="pb-6">
      <div className="px-5 pt-12 flex justify-between items-center">
        <button onClick={()=> p.setScreen("home")} className="text-[#9FB3C8] text-sm">Home</button>
        <button onClick={()=> p.setScreen("myBookings")} className="text-[#9FB3C8] text-sm">My Bookings</button>
      </div>
      <div className="px-5 pt-4 flex flex-col items-center text-center">
        <div className="w-20 h-20 rounded-full bg-[#4ade80]/15 flex items-center justify-center mb-3">
          <Icon name="check" className="w-10 h-10 text-[#4ade80]" strokeWidth={3} />
        </div>
        <h2 className="text-2xl font-extrabold">You're All Set!</h2>
        <p className="text-sm text-[#9FB3C8] mt-1">Your booking is confirmed.</p>
      </div>

      <div className="px-5 mt-5">
        <div className="card flex justify-between items-center">
          <div>
            <div className="text-sm font-semibold">{b.serviceTitle}</div>
            <div className="text-xs text-[#9FB3C8] mt-0.5">{isoToDay(b.startIso)} · {isoToTime(b.startIso)}</div>
          </div>
          <div className="price-orange text-base">{cents(b.totalCents)}</div>
        </div>
        <div className="card mt-3 text-sm">
          <div className="text-[10px] uppercase tracking-wider text-[#9FB3C8] mb-1">Service Address</div>
          {b.address}
        </div>

        <div className="card mt-3 text-sm">
          <div className="text-[10px] uppercase tracking-wider text-[#9FB3C8] mb-1">Vehicle</div>
          {b.customer?.vehicle || "Saved vehicle"}
        </div>

        {b.promoCode && (
          <div className="card mt-3 text-sm flex items-center justify-between">
            <span className="text-[#9FB3C8]">Promo applied</span>
            <span className="text-[#4ade80] font-semibold">{b.promoCode}</span>
          </div>
        )}

        <div className="mt-5">
          <div className="text-xs uppercase tracking-wider text-[#9FB3C8] mb-2">What Happens Next</div>
          <div className="flex flex-col gap-2">
            <NextStepRow icon="receipt" title="Confirmation email" body="You'll get booking details, receipt, and the full total by email." />
            <NextStepRow icon="truck" title="Simple status updates" body="MVP status updates are limited to On the Way, I'm Here, and Completed." />
            <NextStepRow icon="bell" title="Low-cost notifications" body="Dane gets owner SMS alerts; customers can use email by default, with SMS for important status updates if enabled." />
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <button className="btn-secondary" onClick={()=> p.setScreen("home")}>Back to Home</button>
          <button className="btn-primary" onClick={()=> { p.setActiveBookingId(b.id); p.setScreen("bookingDetail"); }}>View Booking</button>
        </div>
      </div>
    </div>
  );
};

const NextStepRow = ({ icon, title, body }) => (
  <div className="row-tap">
    <div className="w-9 h-9 rounded-full bg-[var(--orange)]/15 text-[var(--orange)] flex items-center justify-center">
      <Icon name={icon} className="w-4 h-4" />
    </div>
    <div className="flex-1 min-w-0">
      <div className="text-sm font-semibold">{title}</div>
      <div className="text-xs text-[#9FB3C8] mt-0.5">{body}</div>
    </div>
  </div>
);

const MyBookings = (p) => {
  const [tab, setTab] = useState("upcoming");
  const list = useMemo(() => {
    const now = Date.now();
    return p.bookings.filter(b => {
      if (tab==="upcoming") return b.status==="confirmed" && new Date(b.startIso).getTime() >= now - 1000*60*60*4;
      if (tab==="past") return b.status==="complete" || (b.status==="confirmed" && new Date(b.startIso).getTime() < now - 1000*60*60*4);
      if (tab==="cancelled") return b.status==="cancelled";
      return true;
    }).sort((a,b)=> new Date(a.startIso) - new Date(b.startIso));
  }, [p.bookings, tab]);

  return (
    <div className="pb-6">
      <HeaderBar title="My Bookings" />
      <div className="px-5 flex gap-2">
        {["upcoming","past","cancelled"].map(t => (
          <button key={t} onClick={()=> setTab(t)} className={`px-4 py-2 rounded-full text-xs font-semibold ${tab===t?"bg-[var(--orange)] text-white":"bg-[#0d2236] border border-[#1f3b5c] text-[#9FB3C8]"}`}>{t.charAt(0).toUpperCase()+t.slice(1)}</button>
        ))}
      </div>

      <div className="px-5 mt-4 flex flex-col gap-2">
        {list.length === 0 && (
          <div className="card text-center py-8">
            <img src={MASCOT_DATA_URI} alt="" className="w-24 mx-auto opacity-90" />
            <div className="font-semibold mt-2">No {tab} bookings</div>
            <div className="text-xs text-[#9FB3C8] mt-1">Book a service to get started.</div>
            <button className="btn-primary mt-4" onClick={()=> p.setScreen("home")}>Book a Service</button>
          </div>
        )}
        {list.map(b => (
          <button key={b.id} className="card text-left active:scale-[.99] transition" onClick={()=>{ p.setActiveBookingId(b.id); p.setScreen("bookingDetail"); }}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-[var(--orange)]/12 text-[var(--orange)] flex items-center justify-center">
                  <Icon name="car" className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold truncate">{b.serviceTitle}</div>
                  <div className="text-xs text-[#9FB3C8] mt-0.5">{isoToDay(b.startIso)} · {isoToTime(b.startIso)}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm price-orange">{cents(b.totalCents)}</div>
                <span className={`pill ${b.status==="confirmed"?"pill-confirmed":b.status==="complete"?"pill-complete":b.status==="cancelled"?"pill-cancelled":"pill-pending"}`}>
                  {b.status}
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="px-5 mt-5">
        <button className="btn-secondary" onClick={()=> p.setScreen("home")}>Book a New Service</button>
      </div>

      </div>
  );
};

const BookingDetail = (p) => {
  const b = p.bookings.find(x => x.id === p.activeBookingId);
  const [share, setShare] = useState(b?.liveLocationOptIn ?? false);
  const [shareStatus, setShareStatus] = useState(() => {
    if (!b?.liveLocationOptIn) return "Off. Turn this on when you want to share day-of location.";
    if (b?.liveLocationSnapshot) return "GPS location was shared from this browser.";
    return "On. Exact GPS updates need the app open and browser permission allowed.";
  });
  if (!b) {
    return (
      <div className="p-6 text-center">
        <div className="text-base font-bold mb-2">Booking not found</div>
        <div className="text-xs text-[#9FB3C8] mb-4">It may have been removed or you refreshed before it was saved.</div>
        <button className="btn-primary" onClick={()=> p.setScreen("myBookings")}>Back to My Bookings</button>
      </div>
    );
  }
  const trackerStatus = b.trackerStatus || "on_my_way";
  const trackerIdx = Math.max(0, TRACKER_STEPS.findIndex(step => step.id === trackerStatus));
  const trackerCurrent = TRACKER_STEPS[trackerIdx] || TRACKER_STEPS[0];

  const toggleShare = () => {
    if (share) {
      setShare(false);
      setShareStatus("Off. Turn this on when you want to share day-of location.");
      p.setBookings(bs => bs.map(x => x.id===b.id ? {...x, liveLocationOptIn: false} : x));
      p.showToast("Live location sharing off");
      return;
    }

    setShare(true);
    setShareStatus("Requesting browser GPS permission...");
    const enableWithoutExactGps = () => {
      setShareStatus("Sharing is on, but exact GPS is unavailable in this browser. The route below is a demo preview.");
      p.setBookings(bs => bs.map(x => x.id===b.id ? {...x, liveLocationOptIn: true} : x));
      p.showToast("Live location sharing on");
    };

    if (!navigator.geolocation) {
      enableWithoutExactGps();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const snapshot = {
          lat: coords.latitude,
          lng: coords.longitude,
          accuracy: Math.round(coords.accuracy || 0),
          capturedAt: Date.now(),
        };
        setShareStatus(`GPS shared from this browser. Accuracy about ${snapshot.accuracy || "unknown"} meters.`);
        p.setBookings(bs => bs.map(x => x.id===b.id ? {...x, liveLocationOptIn: true, liveLocationSnapshot: snapshot} : x));
        p.showToast("Live GPS shared");
      },
      () => enableWithoutExactGps(),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 },
    );
  };

  return (
    <div className="pb-6">
      <HeaderBar title="Booking" onBack={()=> p.setScreen("myBookings")} right={<button className="w-9 h-9 rounded-full border border-[#1f3b5c] flex items-center justify-center"><Icon name="msg" className="w-4 h-4" /></button>} />
      <div className="px-5">
        <span className={`pill ${b.status==="confirmed"?"pill-confirmed":b.status==="complete"?"pill-complete":b.status==="cancelled"?"pill-cancelled":"pill-pending"}`}>{b.status}</span>
        <div className="text-base text-[#9FB3C8] mt-2">{isoToDay(b.startIso)} · {isoToTime(b.startIso)}</div>
        <div className="card mt-3 flex justify-between items-center">
          <div>
            <div className="text-sm font-bold">{b.serviceTitle}</div>
            <div className="text-xs text-[#9FB3C8]">Includes all package items</div>
          </div>
          <div className="price-orange text-base">{cents(b.totalCents)}</div>
        </div>

        <div className="card mt-3 text-sm">
          <div className="label-up mb-1">Service Address</div>
          {b.address}
        </div>

        <div className="card mt-3 text-sm">
          <div className="label-up mb-1">Vehicle</div>
          {b.customer?.vehicle || "Saved vehicle"}
        </div>

        <div className="card mt-3 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">Live Location Sharing</div>
            <div className="text-xs text-[#9FB3C8]">Lets our team find you on day-of.</div>
            <div className="text-[11px] text-[#9FB3C8] mt-1 max-w-[190px]">{shareStatus}</div>
          </div>
          <button aria-label="Toggle live location sharing" onClick={toggleShare} className={`w-12 h-7 rounded-full relative ${share?"bg-[var(--orange)]":"bg-[#1f3b5c]"}`}>
            <span className="absolute top-0.5 w-6 h-6 bg-white rounded-full transition-all" style={{left: share?"22px":"2px"}} />
          </button>
        </div>

        {b.status==="confirmed" && (
          <div className="card mt-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="label-up mb-1">Arrival Tracker</div>
                <div className="text-sm font-semibold">{trackerCurrent.customerMessage}</div>
                <div className="text-xs text-[#9FB3C8] mt-1">Status updates from the owner side, not live GPS.</div>
              </div>
              <div className="text-right">
                <div className="w-10 h-10 ml-auto rounded-2xl bg-[var(--orange)]/15 border border-[var(--orange)]/40 text-[var(--orange)] flex items-center justify-center">
                  <Icon name={trackerCurrent.icon} className="w-5 h-5" />
                </div>
                <div className="text-[10px] uppercase tracking-wider text-[#9FB3C8] mt-1">owner update</div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-4">
              {TRACKER_STEPS.map((step, index) => (
                <div key={step.id} className={`rounded-xl border px-2 py-2 text-center text-[11px] font-semibold ${index === trackerIdx ? "border-[var(--orange)] bg-[var(--orange)]/10 text-white" : index < trackerIdx ? "border-[#22c55e]/50 bg-[#22c55e]/10 text-[#bbf7d0]" : "border-[#1f3b5c] bg-[#0d2236] text-[#9FB3C8]"}`}>
                  {step.label}
                </div>
              ))}
            </div>
            <div className="mt-3 text-[11px] text-[#9FB3C8]">
              No ETA is shown until Dane adds one manually or real routing is approved.
            </div>
          </div>
        )}

        <div className="flex gap-2 mt-4">
          <button className="btn-secondary" onClick={()=> p.beginReschedule(b.id)}>Reschedule</button>
          {b.status==="confirmed" && <button className="btn-secondary" onClick={()=> { p.cancelBooking(b.id); p.setScreen("myBookings"); }}>Cancel</button>}
        </div>

        <div className="card mt-3">
          <div className="label-up mb-2">Receipt</div>
          <Row label="Service" value={cents(b.priceCents)} />
          <Row label="Travel fee" value={b.travelFeeCents===0?"Free":cents(b.travelFeeCents)} />
          {b.promoCode && <Row label="Promo code" value={b.promoCode} valueClass="text-[#4ade80]" />}
          {b.discountCents>0 && <Row label="Discount" value={`- ${cents(b.discountCents)}`} valueClass="text-[#4ade80]" />}
          <div className="divider my-2" />
          <Row label={<span className="text-white font-bold">Total paid</span>} value={<span className="price-orange">{cents(b.totalCents)}</span>} />
        </div>
      </div>
    </div>
  );
};

const CustomerProfile = (p) => (
  <div className="pb-6">
    <HeaderBar title="Profile" />
    <div className="px-5">
      <div className="card flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-[var(--orange)]/15 text-[var(--orange)] flex items-center justify-center font-bold">YD</div>
        <div>
          <div className="text-sm font-bold">You (Demo)</div>
          <div className="text-xs text-[#9FB3C8]">demo@peoplesdetailing.app</div>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2">
        <ProfileRow icon="car" title="My Vehicles" hint={`${vehicleLabel(p.activeVehicle)} (selected)`} onClick={()=> p.setScreen("vehicles")} />
        <ProfileRow icon="receipt" title="Payment Methods" hint="Add securely with Stripe later" />
        <ProfileRow icon="bell" title="Notifications" hint="Email & SMS" />
        <ProfileRow icon="shield" title="Privacy" hint="Live location off when not booking" />
        <ProfileRow icon="msg" title="Support" hint="Call (931) 334-0730" />
      </div>
    </div>
  </div>
);

const ProfileRow = ({ icon, title, hint, onClick }) => {
  const content = (
    <>
      <div className="w-9 h-9 rounded-full bg-[#16365B] text-white flex items-center justify-center"><Icon name={icon} className="w-4 h-4" /></div>
      <div className="flex-1">
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-xs text-[#9FB3C8]">{hint}</div>
      </div>
      <Icon name="chevR" className="w-4 h-4 text-[#9FB3C8]" />
    </>
  );
  return onClick ? <button className="row-tap w-full text-left" onClick={onClick}>{content}</button> : <div className="row-tap">{content}</div>;
};

const VehicleManager = (p) => {
  const active = p.vehicles.find(v => v.id === p.activeVehicleId) || p.vehicles[0];
  const [form, setForm] = useState(() => ({ ...(active || seedVehicles()[0]) }));
  const [editingVehicleId, setEditingVehicleId] = useState(null);
  const [isDecodingVin, setIsDecodingVin] = useState(false);
  const [decodeNote, setDecodeNote] = useState("VIN is optional. If entered, it can fill year, make, model, and trim from the free NHTSA database.");
  const update = (key, value) => setForm(f => ({...f, [key]: value}));
  const displayName = (v) => v?.nickname || vehicleLabel(v);
  const requiredVehicleFields = [
    ["Vehicle name", form.nickname],
    ["Year", form.year],
    ["Make", form.make],
    ["Model", form.model],
    ["Trim", form.trim],
    ["Color", form.color],
  ];
  const saveVehicle = () => {
    const missing = requiredVehicleFields.find(([, value]) => !(value || "").trim());
    if (missing) return p.showToast(`Add vehicle ${missing[0].toLowerCase()} first`);
    const hasQuickName = (form.nickname || "").trim();
    const clean = { ...form, id: form.id || uuid(), nickname: hasQuickName || vehicleLabel(form), isDefault: true };
    const isExistingVehicle = p.vehicles.some(v => v.id === clean.id);
    const next = [clean, ...p.vehicles.filter(v => v.id !== clean.id).map(v => ({...v, isDefault:false}))];
    p.setVehicles(next);
    p.setActiveVehicleId(clean.id);
    setEditingVehicleId(clean.id);
    if (p.draft) p.setDraft({...p.draft, vehicleId: clean.id, vehicleLabel: displayName(clean)});
    p.showToast(isExistingVehicle ? "Vehicle updated and selected." : "Vehicle saved. You can pick it next time without re-entering details.");
  };
  const addNew = () => {
    const fresh = { id: uuid(), year:"", make:"", model:"", trim:"", color:"", plate:"", notes:"", vin:"", nickname:"", source:"manual", isDefault:false };
    setForm(fresh);
    setEditingVehicleId(null);
    setDecodeNote("VIN is optional. If entered, it can fill year, make, model, and trim from the free NHTSA database.");
  };
  const chooseVehicle = v => {
    p.setActiveVehicleId(v.id);
    p.setVehicles(p.vehicles.map(x => ({...x, isDefault:x.id===v.id})));
    setForm({...v, isDefault:true});
    setEditingVehicleId(null);
    if (p.draft) p.setDraft({...p.draft, vehicleId:v.id, vehicleLabel:displayName(v)});
    p.showToast("Vehicle selected for this booking");
  };
  const editVehicle = v => {
    p.setActiveVehicleId(v.id);
    p.setVehicles(p.vehicles.map(x => ({...x, isDefault:x.id===v.id})));
    setForm({...v, isDefault:true});
    setEditingVehicleId(v.id);
    setDecodeNote("Editing saved vehicle. Plate number and notes are optional.");
    if (p.draft) p.setDraft({...p.draft, vehicleId:v.id, vehicleLabel:displayName(v)});
    p.showToast(`Editing ${displayName(v)}`);
  };
  const removeVehicle = id => {
    if (p.vehicles.length <= 1) return p.showToast("Keep at least one vehicle");
    const next = p.vehicles.filter(v => v.id !== id);
    p.setVehicles(next);
    const fallback = next[0];
    p.setActiveVehicleId(fallback.id);
    setForm({...fallback});
    setEditingVehicleId(null);
    p.showToast("Vehicle removed");
  };
  const applyVinResult = result => {
    setForm(f => ({...f, ...result, nickname: f.nickname || [result.year, result.make, result.model].filter(Boolean).join(" ")}));
  };
  const decodeVin = async () => {
    const cleanVin = normalizeVin(form.vin);
    if (cleanVin.length !== 17 || /[IOQ]/.test(cleanVin)) {
      setDecodeNote("Enter a full 17-character VIN. VINs do not use I, O, or Q.");
      return;
    }

    setIsDecodingVin(true);
    setDecodeNote("Checking the free NHTSA VIN database...");
    try {
      const result = await lookupVinDetails(cleanVin);
      applyVinResult(result);
      setDecodeNote("VIN decoded with the free NHTSA vPIC database. Confirm trim and color if the customer wants exact details.");
    } catch (error) {
      const sample = decodeVinSample(cleanVin);
      if (sample) {
        applyVinResult(sample);
        setDecodeNote("NHTSA lookup was unavailable, so the app used a saved demo match. Confirm details before relying on it.");
      } else {
        setDecodeNote(error?.message || "VIN lookup could not identify this vehicle. The customer can still save the vehicle manually.");
      }
    } finally {
      setIsDecodingVin(false);
    }
  };

  return (
    <div className="pb-6">
      <HeaderBar title="My Vehicles" subtitle="Save once, then pick your vehicle during booking" onBack={()=> p.setScreen(p.draft ? "book" : "profile")} />
      <div className="px-5">
        <div className="card bg-[var(--orange)]/10 border-[var(--orange)]/30">
          <div className="text-sm font-semibold">You should not have to type this every time.</div>
          <div className="text-xs text-[#C7D8EA] mt-1">Customers can save one or more vehicles. During booking they only choose the saved vehicle or add a quick new one.</div>
        </div>

        <div className="card mt-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-wider text-[#9FB3C8]">Selected vehicle</div>
              <div className="text-base font-bold mt-1">{displayName(active)}</div>
            </div>
            <button className="text-xs px-3 py-2 rounded-xl bg-[#16365B] text-white border border-[#1f3b5c]" onClick={addNew}>Add New</button>
          </div>
          <div className="mt-3 flex flex-col gap-2">
            {p.vehicles.map(v => (
              <div key={v.id} className={`p-3 rounded-xl border ${v.id===p.activeVehicleId ? "border-[var(--orange)] bg-[var(--orange)]/10" : "border-[#1f3b5c] bg-[#0d2236]"}`}>
                <button className="w-full text-left" onClick={()=> chooseVehicle(v)}>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold">{displayName(v)}</div>
                      <div className="text-xs text-[#9FB3C8]">{[v.year, v.make, v.model, v.trim].filter(Boolean).join(" ") || "Basic saved vehicle"}{v.color ? ` · ${v.color}` : ""}</div>
                    </div>
                    {v.id===p.activeVehicleId && <span className="text-[10px] uppercase tracking-wider text-[var(--orange)]">Selected</span>}
                  </div>
                </button>
                <div className="mt-2 flex gap-2">
                  <button className="text-xs px-3 py-1.5 rounded-lg border border-[#1f3b5c] text-[#C7D8EA]" onClick={()=> editVehicle(v)}>Edit</button>
                  <button className="text-xs px-3 py-1.5 rounded-lg border border-[#1f3b5c] text-[#9FB3C8]" onClick={()=> removeVehicle(v.id)}>Remove</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card mt-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="text-xs uppercase tracking-wider text-[#9FB3C8]">Vehicle setup</div>
            {editingVehicleId && <div className="text-[10px] uppercase tracking-wider text-[var(--orange)]">Editing saved vehicle</div>}
          </div>
          <label className="block text-xs text-[#9FB3C8] mb-1">Vehicle name<span className="text-[var(--orange)]"> *</span></label>
          <input aria-label="Vehicle name" required value={form.nickname || ""} onChange={e=>update("nickname", e.target.value)} placeholder="Example: White F-150, wife's SUV, daily driver" className="w-full bg-[#0d2236] border border-[#1f3b5c] rounded-xl px-3 py-2 text-sm outline-none focus:border-[var(--orange)]" />
          <div className="text-xs text-[#9FB3C8] mt-2">Save the main vehicle details now so booking is faster later. Plate number and notes are optional.</div>

          <div className="mt-4 rounded-xl border border-[#1f3b5c] bg-[#0d2236] p-3">
            <label className="block text-xs text-[#9FB3C8] mb-1">VIN lookup (optional)</label>
            <div className="flex gap-2">
              <input value={form.vin || ""} onChange={e=>update("vin", e.target.value.toUpperCase())} placeholder="Optional 17-character VIN" className="flex-1 bg-[#071a2b] border border-[#1f3b5c] rounded-xl px-3 py-2 text-sm outline-none focus:border-[var(--orange)]" />
              <button onClick={decodeVin} disabled={isDecodingVin} className="px-3 py-2 rounded-xl bg-[var(--orange)] disabled:bg-[#34506b] disabled:text-[#9FB3C8] text-white text-sm font-semibold">{isDecodingVin ? "Checking" : "Decode"}</button>
            </div>
            <div className="text-xs text-[#9FB3C8] mt-2">{decodeNote}</div>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-4">
            <Field label="Year" value={form.year || ""} onChange={v=>update("year", v)} required />
            <Field label="Make" value={form.make || ""} onChange={v=>update("make", v)} required />
            <Field label="Model" value={form.model || ""} onChange={v=>update("model", v)} required />
            <Field label="Trim" value={form.trim || ""} onChange={v=>update("trim", v)} required />
            <Field label="Color" value={form.color || ""} onChange={v=>update("color", v)} required />
            <Field label="Plate number (optional)" value={form.plate || ""} onChange={v=>update("plate", v)} />
          </div>
          <div className="mt-3">
            <Field label="Notes (optional)" value={form.notes || ""} onChange={v=>update("notes", v)} />
          </div>
        </div>

        <div className="mt-5">
          <button className="btn-primary w-full" onClick={saveVehicle}>{editingVehicleId ? "Update & Use Vehicle" : "Save & Use Vehicle"}</button>
        </div>
      </div>
    </div>
  );
};

const Field = ({ label, value, onChange, required=false }) => (
  <div>
    <label className="block text-xs text-[#9FB3C8] mb-1">{label}{required && <span className="text-[var(--orange)]"> *</span>}</label>
    <input aria-label={label} required={required} value={value} onChange={e=>onChange(e.target.value)} className="w-full bg-[#0d2236] border border-[#1f3b5c] rounded-xl px-3 py-2 text-sm outline-none focus:border-[var(--orange)]" />
  </div>
);

const CustomerMessages = (p) => (
  <div className="pb-6">
    <HeaderBar title="Messages" />
    <div className="px-5 flex flex-col gap-2">
      <div className="card">
        <div className="flex justify-between items-center">
          <div className="text-sm font-bold">The Peoples Detailing</div>
          <div className="text-[10px] text-[#9FB3C8]">2h ago</div>
        </div>
        <div className="text-xs text-[#9FB3C8] mt-1 clamp-2">Hey — confirming your Deluxe Detail for Saturday at 10 AM. We come to you. Reply if anything changes.</div>
      </div>
      <div className="card">
        <div className="text-sm font-bold">Auto reminder</div>
        <div className="text-xs text-[#9FB3C8] mt-1">Booking reminder · 24h before</div>
      </div>
    </div>
    </div>
);

const CustomerBottomNav = ({ active, setScreen }) => (
  <div className="absolute bottom-0 left-0 right-0 bg-[#08151f]/95 border-t border-[#1f3b5c] backdrop-blur">
    <div className="flex items-center justify-around py-2 px-3">
      {[
        { id:"home", icon:"home", label:"Home" },
        { id:"myBookings", icon:"book", label:"Bookings" },
        { id:"messages", icon:"msg", label:"Messages" },
        { id:"profile", icon:"user", label:"Profile" },
      ].map(t => (
        <button key={t.id} onClick={()=> setScreen(t.id)} className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl ${active===t.id?"nav-chip-active":"text-[#9FB3C8]"}`}>
          <Icon name={t.icon} className="w-5 h-5" />
          <span className="text-[10px] font-semibold">{t.label}</span>
        </button>
      ))}
    </div>
  </div>
);

/* ==== OWNER SCREENS ==== */
const OwnerDash = (p) => {
  const today = new Date(); today.setHours(0,0,0,0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate()+1);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const todays = p.bookings.filter(b => {
    const d = new Date(b.startIso);
    return d >= today && d < tomorrow;
  });
  const upcoming = p.bookings.filter(b => b.status==="confirmed").sort((a,b)=> new Date(a.startIso) - new Date(b.startIso)).slice(0,4);
  const completedThisMonth = p.bookings.filter(b => b.status==="complete" && new Date(b.startIso) >= monthStart).length;
  const monthRevenueCents = p.bookings.filter(b => new Date(b.startIso) >= monthStart).reduce((s,b)=> s + (b.totalCents||0), 0);
  const customers = new Set(p.bookings.map(b => b.customer?.name)).size;

  return (
    <div className="pb-6">
      <div className="px-5 pt-12">
        <div className="flex items-center gap-3">
          <img src={LOGO_DATA_URI} alt="" className="w-10 h-10 rounded-md" />
          <div className="flex-1">
            <div className="text-[11px] text-[#9FB3C8] uppercase tracking-wider">Welcome back</div>
            <div className="text-xl font-extrabold">Dane</div>
          </div>
          <button className="w-9 h-9 rounded-full border border-[#1f3b5c] flex items-center justify-center"><Icon name="bell" className="w-4 h-4" /></button>
        </div>
        <div className="text-xs text-[#9FB3C8] mt-1">Here's what's happening today.</div>
      </div>

      <div className="px-5 mt-4 grid grid-cols-2 gap-2">
        <Kpi label="Today's jobs" value={todays.length} />
        <Kpi label="Completed (mo)" value={completedThisMonth} />
        <Kpi label="Revenue (mo)" value={cents(monthRevenueCents)} />
        <Kpi label="Customers" value={customers} />
      </div>

      <div className="px-5 mt-5">
        <div className="text-xs uppercase tracking-wider text-[#9FB3C8] mb-2">Quick Actions</div>
        <div className="grid grid-cols-4 gap-2">
          <QuickAction icon="flag" label="Tracker" onClick={()=> p.setScreen("ownerTracker")} />
          <QuickAction icon="cal" label="Jobs" onClick={()=> p.setScreen("ownerJobs")} />
          <QuickAction icon="users" label="Customers" onClick={()=> p.setScreen("ownerJobs")} />
          <QuickAction icon="settings" label="Settings" onClick={()=> p.setScreen("ownerSettings")} />
        </div>
      </div>

      <div className="px-5 mt-5">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs uppercase tracking-wider text-[#9FB3C8]">Recent Bookings</div>
          <button className="text-xs text-[var(--orange)]" onClick={()=> p.setScreen("ownerJobs")}>See all</button>
        </div>
        <div className="flex flex-col gap-2">
          {upcoming.map(b => (
            <button key={b.id} className="card text-left flex justify-between items-center" onClick={()=>{ p.setActiveBookingId(b.id); p.setScreen("ownerJobDetail"); }}>
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-[#16365B] text-[var(--orange)] flex items-center justify-center"><Icon name="car" className="w-5 h-5" /></div>
                <div className="min-w-0">
                  <div className="text-sm font-bold truncate">{b.customer?.name}</div>
                  <div className="text-xs text-[#9FB3C8]">{b.serviceTitle} · {isoToDay(b.startIso)} {isoToTime(b.startIso)}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm price-orange">{cents(b.totalCents)}</div>
                <span className="pill pill-confirmed">{b.status}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
      </div>
  );
};

const Kpi = ({ label, value }) => (
  <div className="card">
    <div className="label-up">{label}</div>
    <div className="kpi-num mt-1">{value}</div>
  </div>
);

const QuickAction = ({ icon, label, onClick }) => (
  <button onClick={onClick} className="card flex flex-col items-center gap-1.5 text-center !p-3 active:scale-95 transition">
    <div className="w-9 h-9 rounded-xl bg-[var(--orange)]/15 text-[var(--orange)] flex items-center justify-center"><Icon name={icon} className="w-4 h-4" /></div>
    <div className="text-[11px] font-semibold">{label}</div>
  </button>
);

const OwnerJobs = (p) => {
  const [tab, setTab] = useState("upcoming");
  const list = p.bookings.filter(b => {
    if (tab==="upcoming") return b.status==="confirmed";
    if (tab==="completed") return b.status==="complete";
    if (tab==="cancelled") return b.status==="cancelled";
    return true;
  }).sort((a,b)=> new Date(a.startIso) - new Date(b.startIso));

  return (
    <div className="pb-6">
      <HeaderBar title="Jobs" />
      <div className="px-5 flex gap-2">
        {["upcoming","completed","cancelled"].map(t => (
          <button key={t} onClick={()=> setTab(t)} className={`px-4 py-2 rounded-full text-xs font-semibold ${tab===t?"bg-[var(--orange)] text-white":"bg-[#0d2236] border border-[#1f3b5c] text-[#9FB3C8]"}`}>{t.charAt(0).toUpperCase()+t.slice(1)}</button>
        ))}
      </div>
      <div className="px-5 mt-4 flex flex-col gap-2">
        {list.map(b => (
          <button key={b.id} className="card text-left flex justify-between items-center" onClick={()=>{ p.setActiveBookingId(b.id); p.setScreen("ownerJobDetail"); }}>
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-[#16365B] text-[var(--orange)] flex items-center justify-center"><Icon name="car" className="w-5 h-5" /></div>
              <div className="min-w-0">
                <div className="text-sm font-bold truncate">{b.customer?.name}</div>
                <div className="text-xs text-[#9FB3C8] truncate">{b.serviceTitle} · {b.address?.split(",")[0]}</div>
                <div className="text-[11px] text-[#9FB3C8] mt-0.5">{isoToDay(b.startIso)} · {isoToTime(b.startIso)}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm price-orange">{cents(b.totalCents)}</div>
              <span className={`pill ${b.status==="confirmed"?"pill-confirmed":b.status==="complete"?"pill-complete":"pill-cancelled"}`}>{b.status}</span>
            </div>
          </button>
        ))}
      </div>
      </div>
  );
};

const OwnerJobDetail = (p) => {
  const b = p.bookings.find(x => x.id === p.activeBookingId);
  if (!b) return <div className="p-6">No job selected.</div>;
  return (
    <div className="pb-6">
      <HeaderBar title="Job Detail" onBack={()=> p.setScreen("ownerJobs")} />
      <div className="px-5">
        <div className="card flex justify-between items-center">
          <div>
            <div className="text-sm font-bold">{b.customer?.name}</div>
            <div className="text-xs text-[#9FB3C8] mt-0.5">{b.customer?.phone} · {b.customer?.vehicle}</div>
          </div>
          <span className={`pill ${b.status==="confirmed"?"pill-confirmed":b.status==="complete"?"pill-complete":b.status==="cancelled"?"pill-cancelled":"pill-pending"}`}>{b.status}</span>
        </div>
        <div className="card mt-3">
          <div className="label-up mb-1">Service</div>
          <div className="flex justify-between items-center">
            <div className="text-sm font-semibold">{b.serviceTitle}</div>
            <div className="price-orange text-base">{cents(b.totalCents)}</div>
          </div>
          <div className="text-xs text-[#9FB3C8] mt-1">{isoToDay(b.startIso)} · {isoToTime(b.startIso)}</div>
        </div>
        <div className="card mt-3 text-sm">
          <div className="label-up mb-1">Address</div>
          {b.address}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button className="btn-secondary !py-3" onClick={()=>{ p.setActiveBookingId(b.id); p.setScreen("ownerTracker"); }}>Open Tracker</button>
          <button className="btn-secondary !py-3" onClick={()=> p.showToast("Reschedule sent (mock)")}>Reschedule</button>
        </div>
        {b.status==="confirmed" && (
          <div className="grid grid-cols-2 gap-2 mt-2">
            <button className="btn-secondary !py-3" onClick={()=>{ p.cancelBooking(b.id); p.setScreen("ownerJobs"); }}>Cancel Job</button>
            <button className="btn-primary !py-3" onClick={()=>{ p.completeJob(b.id); p.setScreen("ownerJobs"); }}>Mark Complete</button>
          </div>
        )}
      </div>
    </div>
  );
};

const OwnerTracker = (p) => {
  const upcoming = p.bookings.filter(b => b.status==="confirmed").sort((a,b)=> new Date(a.startIso) - new Date(b.startIso));
  const active = upcoming.find(b => b.id === p.activeBookingId) || upcoming[0];
  if (!active) return <div className="p-6 text-sm">No active jobs to track.</div>;

  const status = active.trackerStatus || "idle";
  const idx = TRACKER_STEPS.findIndex(s => s.id===status);

  const handleTrack = step => {
    if (step==="complete") { p.completeJob(active.id); return; }
    p.updateTracker(active.id, step);
  };

  // Mock today's overview
  const onSiteMins = "2h 14m";
  const milesToday = 24.6;

  return (
    <div className="pb-6">
      <HeaderBar title="Job Status Updates" subtitle="Owner" onBack={()=> p.setScreen("ownerDash")} />
      <div className="px-5">
        <div className="card">
          <div className="label-up">Active Job</div>
          <div className="text-base font-bold mt-1">{active.customer?.name} — {active.serviceTitle}</div>
          <div className="text-xs text-[#9FB3C8]">{isoToDay(active.startIso)} · {isoToTime(active.startIso)} · {active.address?.split(",")[0]}</div>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-4">
          {TRACKER_STEPS.map((s,i) => {
            const isActive = i === idx;
            const isDone = i < idx || status==="complete";
            return (
              <button key={s.id} className={`tracker-step ${isActive?"active":""} ${isDone?"done":""}`} onClick={()=> handleTrack(s.id)}>
                <Icon name={s.icon} className="w-5 h-5" />
                <div className="text-xs font-bold uppercase tracking-wider">{s.label}</div>
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-3 gap-2 mt-5">
          <div className="card text-center">
            <div className="label-up">On site</div>
            <div className="kpi-num text-base mt-1">{onSiteMins}</div>
          </div>
          <div className="card text-center">
            <div className="label-up">Miles today</div>
            <div className="kpi-num text-base mt-1">{milesToday}</div>
          </div>
          <div className="card text-center">
            <div className="label-up">Today $</div>
            <div className="kpi-num text-base mt-1 price-orange">$760</div>
          </div>
        </div>

        <div className="mt-5">
          <div className="label-up mb-2">Mileage Log (today)</div>
          <div className="flex flex-col gap-2">
            <LogRow icon="truck" t="9:32 AM" label="On the Way - Mfboro to Smyrna" miles={6.4} />
            <LogRow icon="locate" t="9:48 AM" label="I'm Here - Smyrna" miles={null} />
            <LogRow icon="check" t="11:30 AM" label="Completed - Smyrna" miles={null} />
            <LogRow icon="truck" t="11:35 AM" label="Return travel logged - Smyrna to Murfreesboro" miles={6.8} />
          </div>
        </div>
      </div>
      </div>
  );
};

const LogRow = ({ icon, t, label, miles }) => (
  <div className="card flex items-center gap-3 !py-2.5">
    <div className="w-8 h-8 rounded-full bg-[#16365B] flex items-center justify-center text-[var(--orange)]"><Icon name={icon} className="w-3.5 h-3.5" /></div>
    <div className="flex-1 min-w-0">
      <div className="text-xs font-semibold truncate">{label}</div>
      <div className="text-[10px] text-[#9FB3C8]">{t}</div>
    </div>
    {miles !== null && <div className="text-xs price-orange">{miles} mi</div>}
  </div>
);

const OwnerReports = (p) => {
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
  const monthBookings = p.bookings.filter(b => new Date(b.startIso) >= monthStart);
  const revenue = monthBookings.reduce((s,b)=> s + (b.totalCents||0), 0);
  const fees = Math.round(revenue * (p.settings.platformFeePercent/100));
  const expensesEstimate = 218000; // mock supplies/gas/etc
  const net = revenue - fees - expensesEstimate;

  return (
    <div className="pb-6">
      <HeaderBar title="Tax Pack" subtitle="Reports" onBack={()=> p.setScreen("ownerDash")} />
      <div className="px-5">
        <div className="card flex items-center justify-between">
          <div>
            <div className="label-up">Monthly Tax Pack</div>
            <div className="text-base font-bold">{new Date().toLocaleDateString("en-US",{month:"long",year:"numeric"})}</div>
          </div>
          <Icon name="chart" className="w-6 h-6 text-[var(--orange)]" />
        </div>

        <div className="grid grid-cols-2 gap-2 mt-3">
          <Kpi label="Total bookings" value={monthBookings.length} />
          <Kpi label="Revenue" value={cents(revenue)} />
          <Kpi label="Fees & Expenses" value={cents(fees + expensesEstimate)} />
          <Kpi label="Net" value={cents(net)} />
        </div>

        <div className="mt-5">
          <div className="label-up mb-2">Export Tax Pack</div>
          <div className="flex flex-col gap-2">
            <ExportRow icon="receipt" label="Summary PDF" detail="One-page overview for taxes." />
            <ExportRow icon="cal" label="Bookings CSV" detail="All jobs in the period." />
            <ExportRow icon="truck" label="Trips CSV" detail="Mileage by trip and purpose." />
            <ExportRow icon="dollar" label="Payouts CSV" detail="Stripe payouts (when connected)." />
          </div>
        </div>
        <button className="btn-primary mt-5" onClick={()=> p.showToast("Tax Pack exported (mock)")}>Export Tax Pack</button>
      </div>
      </div>
  );
};

const ExportRow = ({ icon, label, detail }) => (
  <div className="row-tap">
    <div className="w-9 h-9 rounded-full bg-[var(--orange)]/15 text-[var(--orange)] flex items-center justify-center"><Icon name={icon} className="w-4 h-4" /></div>
    <div className="flex-1">
      <div className="text-sm font-semibold">{label}</div>
      <div className="text-xs text-[#9FB3C8]">{detail}</div>
    </div>
    <Icon name="download" className="w-4 h-4 text-[#9FB3C8]" />
  </div>
);

const OwnerServices = (p) => (
  <div className="pb-6">
    <HeaderBar title="Services" onBack={()=> p.setScreen("ownerDash")} />
    <div className="px-5 flex flex-col gap-2">
      {p.services.map(svc => (
        <div key={svc.id} className="card flex items-center justify-between">
          <div>
            <div className="text-sm font-bold">{svc.title}</div>
            <div className="text-xs text-[#9FB3C8]">{cents(svc.priceCents)}{svc.badge||""} · {svc.durationHours} hrs</div>
          </div>
          <button className="text-xs px-3 py-1.5 rounded-full border border-[#1f3b5c] text-[#9FB3C8]">Edit</button>
        </div>
      ))}
    </div>
  </div>
);

const OwnerSettings = (p) => {
  const s = p.settings;
  const update = (k, v) => p.setSettings(prev => ({...prev, [k]: v}));
  return (
    <div className="pb-6">
      <HeaderBar title="Settings" onBack={()=> p.setScreen("ownerDash")} right={
        <button onClick={()=> { p.setSettings({...SETTINGS}); p.showToast("Settings reset to defaults"); }} className="text-xs px-3 py-1.5 rounded-full border border-[#1f3b5c] text-[#9FB3C8]">Reset</button>
      } />
      <div className="px-5 flex flex-col gap-3">

        <div className="card">
          <div className="label-up mb-2">Home Page</div>
          <div className="text-[11px] text-[#9FB3C8] mb-1">Tagline kicker (small orange line)</div>
          <input className="input" value={s.homeTaglineKicker} onChange={e=> update("homeTaglineKicker", e.target.value)} />
          <div className="text-[11px] text-[#9FB3C8] mt-3 mb-1">Tagline (big white line)</div>
          <textarea className="input" rows="2" value={s.homeTagline} onChange={e=> update("homeTagline", e.target.value)} />
          <div className="text-[11px] text-[#9FB3C8] mt-3 mb-1">Footer phone / offer line</div>
          <input className="input" value={s.homeFooterPhone} onChange={e=> update("homeFooterPhone", e.target.value)} />
          <button className="btn-secondary mt-3 !py-2 text-xs" onClick={()=> { p.setRole("customer"); p.setScreen("home"); p.showToast("Switched to customer view"); }}>Preview as customer</button>
        </div>

        <div className="card">
          <div className="label-up mb-2">Booking & Travel</div>
          <NumberRow label="Buffer minutes" value={s.bufferMinutes} onChange={v=> update("bufferMinutes", v)} suffix="min" />
          <NumberRow label="Free travel radius" value={s.freeTravelRadiusMiles} onChange={v=> update("freeTravelRadiusMiles", v)} suffix="mi" />
          <NumberRow label="Per-mile fee" value={s.perMileFeeCents/100} step="0.05" onChange={v=> update("perMileFeeCents", Math.round(v*100))} prefix="$" />
        </div>

        <div className="card">
          <div className="label-up mb-2">Cancellations & Reschedules</div>
          <NumberRow label="Free cancel window" value={s.cancelFreeWindowDays} onChange={v=> update("cancelFreeWindowDays", v)} suffix="days" />
          <NumberRow label="Cancellation fee" value={s.cancellationFeeCents/100} step="1" onChange={v=> update("cancellationFeeCents", Math.round(v*100))} prefix="$" />
          <NumberRow label="Reschedule approval timeout" value={s.rescheduleTimeoutHours} onChange={v=> update("rescheduleTimeoutHours", v)} suffix="hrs" />
        </div>

        <div className="card">
          <div className="label-up mb-2">Business</div>
          <div className="text-[11px] text-[#9FB3C8] mb-1">Base address</div>
          <input className="input" value={s.baseAddress} onChange={e=> update("baseAddress", e.target.value)} />
          <NumberRow label="Flat app fee" value={(s.appFeeFlatCents ?? 300)/100} step="0.25" onChange={v=> update("appFeeFlatCents", Math.round(v*100))} prefix="$" />
          <NumberRow label="App fee percent" value={s.appFeePercent ?? 2.5} step="0.25" onChange={v=> update("appFeePercent", v)} suffix="%" />
          <NumberRow label="App fee minimum" value={(s.appFeeMinCents ?? 400)/100} step="0.50" onChange={v=> update("appFeeMinCents", Math.round(v*100))} prefix="$" />
          <NumberRow label="App fee maximum" value={(s.appFeeMaxCents ?? 550)/100} step="0.50" onChange={v=> update("appFeeMaxCents", Math.round(v*100))} prefix="$" />
          <ToggleRow label="Customer pays card processing fee" value={s.customerPaysCardProcessingFee ?? SETTINGS.customerPaysCardProcessingFee} onChange={()=> update("customerPaysCardProcessingFee", !(s.customerPaysCardProcessingFee ?? SETTINGS.customerPaysCardProcessingFee))} />
          <NumberRow label="Card processing %" value={s.cardProcessingPercent ?? 2.9} step="0.1" onChange={v=> update("cardProcessingPercent", v)} suffix="%" />
          <NumberRow label="Card fixed fee" value={(s.cardProcessingFixedCents ?? 30)/100} step="0.05" onChange={v=> update("cardProcessingFixedCents", Math.round(v*100))} prefix="$" />
          <NumberRow label="Platform fee % (legacy/demo only)" value={s.platformFeePercent} onChange={v=> update("platformFeePercent", v)} suffix="%" />
          <div className="text-[11px] text-[#9FB3C8] mt-3 mb-1">App fee info message</div>
          <textarea className="input" rows="4" value={s.appFeeInfoText || SETTINGS.appFeeInfoText} onChange={e=> update("appFeeInfoText", e.target.value)} />
          <div className="text-[11px] text-[#9FB3C8] mt-3 mb-1">Card processing fee info message</div>
          <textarea className="input" rows="3" value={s.cardProcessingInfoText || SETTINGS.cardProcessingInfoText} onChange={e=> update("cardProcessingInfoText", e.target.value)} />
          <div className="text-[11px] text-[#9FB3C8] mt-3 mb-1">BrandNew info link</div>
          <input className="input" value={s.brandNewInfoUrl || SETTINGS.brandNewInfoUrl} onChange={e=> update("brandNewInfoUrl", e.target.value)} />
          <div className="text-[11px] text-[#9FB3C8] mt-3 mb-1">BrandNew referral note</div>
          <textarea className="input" rows="3" value={s.brandNewReferralText || SETTINGS.brandNewReferralText} onChange={e=> update("brandNewReferralText", e.target.value)} />
        </div>

        <div className="card">
          <div className="label-up mb-2">Connections</div>
          <ConnRow label="Stripe (payouts)" status="Not connected (demo)" />
          <ConnRow label="SMS/Text provider" status="Owner SMS required; customer SMS limited to On the Way / I'm Here / Completed if enabled" />
          <ConnRow label="Maps/address tools" status="Browser GPS estimate only; no maps, routing, or reverse geocoding connected" />
          <ConnRow label="Google Calendar" status="Not connected (demo)" />
        </div>

      </div>
    </div>
  );
};

const SettingRow = ({ label, value }) => (
  <div className="card flex justify-between items-center">
    <div className="text-sm font-semibold">{label}</div>
    <div className="text-sm text-[#9FB3C8]">{value}</div>
  </div>
);

const NumberRow = ({ label, value, onChange, prefix, suffix, step="1" }) => (
  <div className="flex items-center justify-between gap-3 py-1.5">
    <div className="text-sm flex-1 min-w-0">{label}</div>
    <div className="flex items-center gap-1 bg-[#0d2236] border border-[#1f3b5c] rounded-lg px-2 py-1">
      {prefix && <span className="text-xs text-[#9FB3C8]">{prefix}</span>}
      <input
        type="number"
        step={step}
        className="bg-transparent border-0 outline-none text-white text-sm w-16 text-right"
        value={value}
        onChange={e=> onChange(parseFloat(e.target.value) || 0)}
      />
      {suffix && <span className="text-xs text-[#9FB3C8]">{suffix}</span>}
    </div>
  </div>
);

const ToggleRow = ({ label, value, onChange }) => (
  <div className="flex items-center justify-between gap-3 py-1.5">
    <div className="text-sm flex-1 min-w-0">{label}</div>
    <button
      type="button"
      onClick={onChange}
      className={`rounded-full px-3 py-1 text-xs border ${value ? "border-[#f97316] text-[#fed7aa] bg-[#f97316]/10" : "border-[#1f3b5c] text-[#9FB3C8] bg-[#0d2236]"}`}
    >
      {value ? "Shown to customer" : "Covered by business"}
    </button>
  </div>
);

const ConnRow = ({ label, status }) => (
  <div className="flex justify-between items-center py-2">
    <div className="text-sm">{label}</div>
    <div className="text-xs text-[#9FB3C8]">{status}</div>
  </div>
);

const OwnerBottomNav = ({ active, setScreen }) => (
  <div className="absolute bottom-0 left-0 right-0 bg-[#08151f]/95 border-t border-[#1f3b5c] backdrop-blur">
    <div className="flex items-center justify-around py-2 px-3">
      {[
        { id:"dash", target:"ownerDash", icon:"home", label:"Dash" },
        { id:"jobs", target:"ownerJobs", icon:"cal", label:"Jobs" },
        { id:"tracker", target:"ownerTracker", icon:"flag", label:"Tracker" },
        { id:"reports", target:"ownerReports", icon:"chart", label:"Reports" },
        { id:"settings", target:"ownerSettings", icon:"settings", label:"Settings" },
      ].map(t => (
        <button key={t.id} onClick={()=> setScreen(t.target)} className={`flex flex-col items-center gap-1 py-1 px-2 rounded-xl ${active===t.id?"nav-chip-active":"text-[#9FB3C8]"}`}>
          <Icon name={t.icon} className="w-5 h-5" />
          <span className="text-[10px] font-semibold">{t.label}</span>
        </button>
      ))}
    </div>
  </div>
);

export default App;

