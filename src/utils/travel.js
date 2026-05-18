export const MURFREESBORO_BASE = { lat: 35.8456, lng: -86.3903 };

export const TN_LOCATION_ESTIMATES = [
  { match: /\bnashville\b/i, label: 'Nashville, TN', miles: 35 },
  { match: /\bsmyrna\b/i, label: 'Smyrna, TN', miles: 14 },
  { match: /\bla\s*vergne\b/i, label: 'La Vergne, TN', miles: 22 },
  { match: /\bfranklin\b/i, label: 'Franklin, TN', miles: 38 },
  { match: /\bbrentwood\b/i, label: 'Brentwood, TN', miles: 31 },
  { match: /\blebanon\b/i, label: 'Lebanon, TN', miles: 34 },
  { match: /\bwoodbury\b/i, label: 'Woodbury, TN', miles: 21 },
  { match: /\bshelbyville\b/i, label: 'Shelbyville, TN', miles: 28 },
  { match: /\bcolumbia\b/i, label: 'Columbia, TN', miles: 55 },
  { match: /\bspring\s*hill\b/i, label: 'Spring Hill, TN', miles: 47 },
  { match: /\bmount\s*juliet\b|\bmt\.?\s*juliet\b/i, label: 'Mt. Juliet, TN', miles: 34 },
  { match: /\bmurfreesboro\b/i, label: 'Murfreesboro, TN', miles: 0 },
];

export function milesBetween(a, b) {
  const toRad = value => value * Math.PI / 180;
  const earthMiles = 3958.8;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return earthMiles * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function estimateMilesFromAddress(address = '') {
  const clean = address.trim();
  if (!clean) return null;

  const cityEstimate = TN_LOCATION_ESTIMATES.find(item => item.match.test(clean));
  if (cityEstimate) {
    return {
      label: cityEstimate.label,
      miles: cityEstimate.miles,
      source: 'city estimate',
    };
  }

  if (/\btn\b|\btennessee\b/i.test(clean)) {
    return {
      label: clean,
      miles: 12,
      source: 'Tennessee address estimate',
    };
  }

  return null;
}

export function calculateTravelFeeCents(miles = 0, settings = {}) {
  const freeRadius = settings.freeTravelRadiusMiles ?? 10;
  const perMileFee = settings.perMileFeeCents ?? 150;
  return Math.max(0, Math.round((miles - freeRadius) * perMileFee));
}
