export const MURFREESBORO_BASE = { lat: 35.8456, lng: -86.3903 };

export const TN_LOCATION_ESTIMATES = [
  { match: /\bnashville\b/i, label: 'Nashville, TN', miles: 35, zips: ['37201', '37203', '37204', '37205', '37206', '37207', '37208', '37209', '37210', '37211', '37212', '37214', '37215', '37216', '37217', '37218', '37219', '37220', '37221'] },
  { match: /\bsmyrna\b/i, label: 'Smyrna, TN', miles: 14, zips: ['37167'] },
  { match: /\bla\s*vergne\b/i, label: 'La Vergne, TN', miles: 22, zips: ['37086'] },
  { match: /\bfranklin\b/i, label: 'Franklin, TN', miles: 38, zips: ['37064', '37067', '37069'] },
  { match: /\bbrentwood\b/i, label: 'Brentwood, TN', miles: 31, zips: ['37027'] },
  { match: /\blebanon\b/i, label: 'Lebanon, TN', miles: 34, zips: ['37087', '37090'] },
  { match: /\bwoodbury\b/i, label: 'Woodbury, TN', miles: 21, zips: ['37190'] },
  { match: /\bshelbyville\b/i, label: 'Shelbyville, TN', miles: 28, zips: ['37160'] },
  { match: /\bcolumbia\b/i, label: 'Columbia, TN', miles: 55, zips: ['38401'] },
  { match: /\bspring\s*hill\b/i, label: 'Spring Hill, TN', miles: 47, zips: ['37174'] },
  { match: /\bmount\s*juliet\b|\bmt\.?\s*juliet\b/i, label: 'Mt. Juliet, TN', miles: 34, zips: ['37122'] },
  { match: /\bmurfreesboro\b/i, label: 'Murfreesboro, TN', miles: 0, zips: ['37127', '37128', '37129', '37130'] },
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
      source: hasStreetAddressShape(clean) ? 'typed address city estimate' : 'city estimate',
    };
  }

  const zip = clean.match(/\b(37\d{3}|38\d{3})\b/)?.[1];
  const zipEstimate = TN_LOCATION_ESTIMATES.find(item => item.zips?.includes(zip));
  if (zipEstimate) {
    return {
      label: zipEstimate.label,
      miles: zipEstimate.miles,
      source: 'ZIP estimate',
    };
  }

  return null;
}

function hasStreetAddressShape(value) {
  return /\b\d{1,6}\s+[a-z0-9.'-]+/i.test(value);
}

export function calculateTravelFeeCents(miles = 0, settings = {}) {
  const freeRadius = settings.freeTravelRadiusMiles ?? 10;
  const perMileFee = settings.perMileFeeCents ?? 150;
  return Math.max(0, Math.round((miles - freeRadius) * perMileFee));
}
