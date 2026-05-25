export const normalizeVin = vin => (vin || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

export const hasValidVinShape = vin => {
  const clean = normalizeVin(vin);
  return clean.length === 17 && !/[IOQ]/.test(clean);
};

export const decodeVinSample = vin => {
  const clean = normalizeVin(vin);
  if (clean.length < 11) return null;
  const samples = {
    "5J6RS": { year:"2024", make:"Honda", model:"CR-V", source:"sample VIN fallback" },
    "7SAYG": { year:"2024", make:"Tesla", model:"Model Y", source:"sample VIN fallback" },
    "JTMWF": { year:"2019", make:"Toyota", model:"RAV4", source:"sample VIN fallback" },
    "1GNSK": { year:"2023", make:"Chevrolet", model:"Tahoe", source:"sample VIN fallback" },
    "1FTEW": { year:"2022", make:"Ford", model:"F-150", source:"sample VIN fallback" },
  };
  const prefix = Object.keys(samples).find(k => clean.startsWith(k));
  return prefix ? { ...samples[prefix], vin: clean } : null;
};

export const parseNhtsaVinResult = (payload, vin) => {
  const row = payload?.Results?.[0];
  if (!row) throw new Error("VIN lookup returned no vehicle data");

  const year = row.ModelYear || "";
  const make = row.Make || "";
  const model = row.Model || "";
  if (!make && !model) {
    throw new Error(row.ErrorText || "VIN lookup could not identify this vehicle");
  }

  return {
    vin: normalizeVin(vin),
    year,
    make,
    model,
    bodyClass: row.BodyClass || "",
    driveType: row.DriveType || "",
    fuelType: row.FuelTypePrimary || "",
    source: "NHTSA vPIC",
  };
};

export const lookupVinDetails = async (vin, { fetchImpl = globalThis.fetch } = {}) => {
  const clean = normalizeVin(vin);
  if (!hasValidVinShape(clean)) {
    throw new Error("Enter a full 17-character VIN. VINs do not use I, O, or Q.");
  }
  if (!fetchImpl) throw new Error("Browser VIN lookup is unavailable");

  const url = `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValuesExtended/${encodeURIComponent(clean)}?format=json`;
  const response = await fetchImpl(url);
  if (!response.ok) throw new Error("NHTSA VIN lookup is unavailable right now");
  return parseNhtsaVinResult(await response.json(), clean);
};
