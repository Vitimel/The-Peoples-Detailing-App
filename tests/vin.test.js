import { describe, expect, it, vi } from 'vitest';
import { decodeVinSample, hasValidVinShape, lookupVinDetails, normalizeVin } from '../src/utils/vin.js';

describe('VIN lookup helpers', () => {
  it('normalizes VIN input and rejects invalid VIN shapes', () => {
    expect(normalizeVin(' 1hg-cm82633a004352 ')).toBe('1HGCM82633A004352');
    expect(hasValidVinShape('1HGCM82633A004352')).toBe(true);
    expect(hasValidVinShape('1HGCM82633A00435')).toBe(false);
    expect(hasValidVinShape('1HGCM82633A00435O')).toBe(false);
  });

  it('parses a NHTSA vPIC VIN response into saved vehicle fields', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        Results: [{
          ModelYear: '2003',
          Make: 'HONDA',
          Model: 'Accord',
          BodyClass: 'Coupe',
          DriveType: 'FWD',
          FuelTypePrimary: 'Gasoline',
        }],
      }),
    }));

    await expect(lookupVinDetails('1HGCM82633A004352', { fetchImpl })).resolves.toMatchObject({
      vin: '1HGCM82633A004352',
      year: '2003',
      make: 'HONDA',
      model: 'Accord',
      source: 'NHTSA vPIC',
    });
  });

  it('keeps sample fallback limited to known demo VIN prefixes', () => {
    expect(decodeVinSample('1FTEW000000000000')).toMatchObject({ make: 'Ford', model: 'F-150' });
    expect(decodeVinSample('2C3CDZAG1LH000000')).toBeNull();
  });
});
