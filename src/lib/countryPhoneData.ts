import rawCountriesData from '../../public/countryCodes/countryCodes.json';

export interface Country {
  country_code: string; // e.g. "IN"
  name: string; // e.g. "India"
  calling_code: string; // e.g. "+91"
  flag: string; // e.g. "flags/ind.png"
  minLength: number;
  maxLength: number;
  isPopular?: boolean;
}

// Comprehensive phone length dictionary for national significant mobile numbers (without country code)
const PHONE_LENGTH_MAP: Record<string, { min: number; max: number }> = {
  // NANP (+1, Caribbean & North America)
  US: { min: 10, max: 10 },
  CA: { min: 10, max: 10 },
  AG: { min: 10, max: 10 },
  AI: { min: 10, max: 10 },
  AS: { min: 10, max: 10 },
  BB: { min: 10, max: 10 },
  BM: { min: 10, max: 10 },
  BS: { min: 10, max: 10 },
  DM: { min: 10, max: 10 },
  DO: { min: 10, max: 10 },
  GD: { min: 10, max: 10 },
  GU: { min: 10, max: 10 },
  JM: { min: 10, max: 10 },
  KN: { min: 10, max: 10 },
  KY: { min: 10, max: 10 },
  LC: { min: 10, max: 10 },
  MP: { min: 10, max: 10 },
  MS: { min: 10, max: 10 },
  PR: { min: 10, max: 10 },
  SX: { min: 10, max: 10 },
  TC: { min: 10, max: 10 },
  TT: { min: 10, max: 10 },
  VC: { min: 10, max: 10 },
  VG: { min: 10, max: 10 },
  VI: { min: 10, max: 10 },

  // South Asia
  IN: { min: 10, max: 10 },
  PK: { min: 10, max: 10 },
  BD: { min: 10, max: 10 },
  LK: { min: 9, max: 9 },
  NP: { min: 10, max: 10 },
  BT: { min: 8, max: 8 },
  MV: { min: 7, max: 7 },
  AF: { min: 9, max: 9 },

  // Middle East
  AE: { min: 9, max: 9 },
  SA: { min: 9, max: 9 },
  QA: { min: 8, max: 8 },
  KW: { min: 8, max: 8 },
  OM: { min: 8, max: 8 },
  BH: { min: 8, max: 8 },
  YE: { min: 9, max: 9 },
  IQ: { min: 10, max: 10 },
  IR: { min: 10, max: 10 },
  SY: { min: 9, max: 9 },
  JO: { min: 9, max: 9 },
  LB: { min: 8, max: 8 },
  IL: { min: 9, max: 9 },
  PS: { min: 9, max: 9 },

  // East & Southeast Asia
  CN: { min: 11, max: 11 },
  HK: { min: 8, max: 8 },
  MO: { min: 8, max: 8 },
  TW: { min: 9, max: 9 },
  JP: { min: 10, max: 10 },
  KR: { min: 9, max: 10 },
  KP: { min: 10, max: 10 },
  MN: { min: 8, max: 8 },
  SG: { min: 8, max: 8 },
  MY: { min: 9, max: 10 },
  TH: { min: 9, max: 9 },
  VN: { min: 9, max: 9 },
  ID: { min: 10, max: 12 },
  PH: { min: 10, max: 10 },
  MM: { min: 9, max: 10 },
  KH: { min: 8, max: 9 },
  LA: { min: 9, max: 10 },
  BN: { min: 7, max: 7 },
  TL: { min: 8, max: 8 },

  // Europe
  GB: { min: 10, max: 10 },
  FR: { min: 9, max: 9 },
  DE: { min: 10, max: 11 },
  IT: { min: 10, max: 10 },
  ES: { min: 9, max: 9 },
  PT: { min: 9, max: 9 },
  NL: { min: 9, max: 9 },
  BE: { min: 9, max: 9 },
  LU: { min: 9, max: 9 },
  CH: { min: 9, max: 9 },
  AT: { min: 10, max: 11 },
  IE: { min: 9, max: 9 },
  SE: { min: 9, max: 9 },
  NO: { min: 8, max: 8 },
  DK: { min: 8, max: 8 },
  FI: { min: 9, max: 10 },
  IS: { min: 7, max: 7 },
  PL: { min: 9, max: 9 },
  CZ: { min: 9, max: 9 },
  SK: { min: 9, max: 9 },
  HU: { min: 9, max: 9 },
  RO: { min: 9, max: 9 },
  BG: { min: 9, max: 9 },
  GR: { min: 10, max: 10 },
  CY: { min: 8, max: 8 },
  MT: { min: 8, max: 8 },
  HR: { min: 9, max: 9 },
  SI: { min: 8, max: 8 },
  BA: { min: 8, max: 8 },
  RS: { min: 8, max: 9 },
  ME: { min: 8, max: 8 },
  MK: { min: 8, max: 8 },
  AL: { min: 9, max: 9 },
  EE: { min: 7, max: 8 },
  LV: { min: 8, max: 8 },
  LT: { min: 8, max: 8 },
  BY: { min: 9, max: 9 },
  UA: { min: 9, max: 9 },
  MD: { min: 8, max: 8 },
  AD: { min: 6, max: 6 },
  MC: { min: 8, max: 8 },
  SM: { min: 8, max: 10 },
  LI: { min: 7, max: 7 },
  VA: { min: 10, max: 10 },
  GI: { min: 8, max: 8 },
  FO: { min: 6, max: 6 },
  GL: { min: 6, max: 6 },
  AX: { min: 9, max: 10 },
  RU: { min: 10, max: 10 },
  TR: { min: 10, max: 10 },
  KZ: { min: 10, max: 10 },
  AM: { min: 8, max: 8 },
  AZ: { min: 9, max: 9 },
  GE: { min: 9, max: 9 },
  KG: { min: 9, max: 9 },
  TJ: { min: 9, max: 9 },
  TM: { min: 8, max: 8 },
  UZ: { min: 9, max: 9 },
  XK: { min: 8, max: 8 },

  // Americas
  MX: { min: 10, max: 10 },
  BR: { min: 10, max: 11 },
  AR: { min: 10, max: 10 },
  CO: { min: 10, max: 10 },
  CL: { min: 9, max: 9 },
  PE: { min: 9, max: 9 },
  VE: { min: 10, max: 10 },
  EC: { min: 9, max: 9 },
  GT: { min: 8, max: 8 },
  CU: { min: 8, max: 8 },
  BO: { min: 8, max: 8 },
  HT: { min: 8, max: 8 },
  HN: { min: 8, max: 8 },
  PY: { min: 9, max: 9 },
  NI: { min: 8, max: 8 },
  SV: { min: 8, max: 8 },
  CR: { min: 8, max: 8 },
  PA: { min: 8, max: 8 },
  UY: { min: 8, max: 8 },
  GY: { min: 7, max: 7 },
  SR: { min: 7, max: 7 },
  BZ: { min: 7, max: 7 },
  CW: { min: 7, max: 8 },
  AW: { min: 7, max: 7 },

  // Oceania
  AU: { min: 9, max: 9 },
  NZ: { min: 8, max: 10 },
  PG: { min: 8, max: 8 },
  FJ: { min: 7, max: 7 },
  SB: { min: 7, max: 7 },
  VU: { min: 7, max: 7 },
  NC: { min: 6, max: 6 },
  PF: { min: 8, max: 8 },
  WS: { min: 7, max: 7 },
  TO: { min: 7, max: 7 },
  FM: { min: 7, max: 7 },
  MH: { min: 7, max: 7 },
  PW: { min: 7, max: 7 },
  NR: { min: 7, max: 7 },
  KI: { min: 8, max: 8 },
  TV: { min: 5, max: 6 },
  CK: { min: 5, max: 5 },

  // Africa
  NG: { min: 10, max: 10 },
  ET: { min: 9, max: 9 },
  EG: { min: 10, max: 10 },
  CD: { min: 9, max: 9 },
  TZ: { min: 9, max: 9 },
  ZA: { min: 9, max: 9 },
  KE: { min: 9, max: 9 },
  UG: { min: 9, max: 9 },
  DZ: { min: 9, max: 9 },
  SD: { min: 9, max: 9 },
  MA: { min: 9, max: 9 },
  AO: { min: 9, max: 9 },
  GH: { min: 9, max: 9 },
  MZ: { min: 9, max: 9 },
  MG: { min: 9, max: 9 },
  CI: { min: 10, max: 10 },
  CM: { min: 9, max: 9 },
  NE: { min: 8, max: 8 },
  BF: { min: 8, max: 8 },
  ML: { min: 8, max: 8 },
  MW: { min: 9, max: 9 },
  ZM: { min: 9, max: 9 },
  SN: { min: 9, max: 9 },
  TD: { min: 8, max: 8 },
  SO: { min: 8, max: 9 },
  ZW: { min: 9, max: 9 },
  GN: { min: 9, max: 9 },
  RW: { min: 9, max: 9 },
  BJ: { min: 8, max: 8 },
  BI: { min: 8, max: 8 },
  TN: { min: 8, max: 8 },
  SS: { min: 9, max: 9 },
  TG: { min: 8, max: 8 },
  SL: { min: 8, max: 8 },
  LY: { min: 9, max: 9 },
  CG: { min: 9, max: 9 },
  LR: { min: 7, max: 8 },
  CF: { min: 8, max: 8 },
  MR: { min: 8, max: 8 },
  ER: { min: 7, max: 7 },
  NA: { min: 9, max: 9 },
  GM: { min: 7, max: 7 },
  BW: { min: 8, max: 8 },
  GA: { min: 7, max: 7 },
  LS: { min: 8, max: 8 },
  GW: { min: 7, max: 7 },
  GQ: { min: 9, max: 9 },
  MU: { min: 8, max: 8 },
  SZ: { min: 8, max: 8 },
  DJ: { min: 8, max: 8 },
  KM: { min: 7, max: 7 },
  CV: { min: 7, max: 7 },
  ST: { min: 7, max: 7 },
  SC: { min: 7, max: 7 }
};

const POPULAR_COUNTRY_CODES = ['IN', 'US', 'GB', 'AE', 'SA', 'CA', 'AU', 'SG'];

export const ALL_COUNTRIES: Country[] = (rawCountriesData as any[]).map((c) => {
  const code = (c.country_code || '').toUpperCase();
  const lengthConfig = PHONE_LENGTH_MAP[code] || { min: 8, max: 11 };
  return {
    country_code: code,
    name: c.name || '',
    calling_code: c.calling_code || '',
    flag: c.flag || '',
    minLength: lengthConfig.min,
    maxLength: lengthConfig.max,
    isPopular: POPULAR_COUNTRY_CODES.includes(code),
  };
});

// Default fallback is India
export const DEFAULT_COUNTRY: Country = ALL_COUNTRIES.find(c => c.country_code === 'IN') || {
  country_code: 'IN',
  name: 'India',
  calling_code: '+91',
  flag: 'flags/ind.png',
  minLength: 10,
  maxLength: 10,
  isPopular: true,
};

export function getCountryByCode(code?: string | null): Country {
  if (!code) return DEFAULT_COUNTRY;
  const upper = code.trim().toUpperCase();
  return ALL_COUNTRIES.find(c => c.country_code === upper) || DEFAULT_COUNTRY;
}

export function getCountryByCallingCode(callingCode?: string | null): Country {
  if (!callingCode) return DEFAULT_COUNTRY;
  const cleaned = callingCode.startsWith('+') ? callingCode : `+${callingCode.replace(/\D/g, '')}`;
  // Prefer exact popular countries first (e.g. +1 for US/CA, +91 for IN)
  const popularMatch = ALL_COUNTRIES.find(c => c.isPopular && c.calling_code === cleaned);
  if (popularMatch) return popularMatch;
  return ALL_COUNTRIES.find(c => c.calling_code === cleaned) || DEFAULT_COUNTRY;
}

export function cleanPhoneDigits(value: string, maxLength: number = 15): string {
  if (!value) return '';
  return value.replace(/\D/g, '').slice(0, maxLength);
}

/**
 * Parses any phone string (e.g. "+919876543210" or "+12025550123")
 * and returns the matched Country and the national number.
 */
export function findCountryFromPhoneNumber(phoneWithCode: string): { country: Country; nationalNumber: string } {
  if (!phoneWithCode) {
    return { country: DEFAULT_COUNTRY, nationalNumber: '' };
  }

  const cleaned = phoneWithCode.trim().replace(/\s+/g, '');
  if (!cleaned.startsWith('+')) {
    // No country code prefix, treat as digits under default country
    const digits = cleanPhoneDigits(cleaned, DEFAULT_COUNTRY.maxLength);
    return { country: DEFAULT_COUNTRY, nationalNumber: digits };
  }

  // Sort countries by calling_code length descending to match +1684 before +1
  const sortedCountries = [...ALL_COUNTRIES].sort((a, b) => b.calling_code.length - a.calling_code.length);

  for (const c of sortedCountries) {
    if (cleaned.startsWith(c.calling_code)) {
      const rest = cleaned.substring(c.calling_code.length);
      const digits = cleanPhoneDigits(rest, c.maxLength);
      return { country: c, nationalNumber: digits };
    }
  }

  return { country: DEFAULT_COUNTRY, nationalNumber: cleanPhoneDigits(cleaned, DEFAULT_COUNTRY.maxLength) };
}

/**
 * Validates a national phone number according to country rules.
 */
export function validatePhoneNumber(number: string, country: Country): { isValid: boolean; message?: string } {
  const digits = cleanPhoneDigits(number, country.maxLength + 2);
  if (!digits) {
    return { isValid: false, message: `Please enter a valid mobile number.` };
  }

  if (country.minLength === country.maxLength) {
    if (digits.length !== country.maxLength) {
      return {
        isValid: false,
        message: `${country.name} mobile numbers must be exactly ${country.maxLength} digits.`,
      };
    }
  } else {
    if (digits.length < country.minLength || digits.length > country.maxLength) {
      return {
        isValid: false,
        message: `${country.name} mobile numbers must be between ${country.minLength} and ${country.maxLength} digits.`,
      };
    }
  }

  return { isValid: true };
}

/**
 * Detects user country based on session cache, timezone heuristic, and /api/geo/detect-country
 */
export async function detectUserCountry(): Promise<Country> {
  if (typeof window !== 'undefined') {
    try {
      const cached = sessionStorage.getItem('detected_country_code');
      if (cached) {
        const country = getCountryByCode(cached);
        if (country) return country;
      }
    } catch {
      // ignore
    }
  }

  // Instant timezone heuristic
  let tzCountryCode: string | null = null;
  if (typeof Intl !== 'undefined') {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
      if (tz.includes('Calcutta') || tz.includes('Kolkata')) tzCountryCode = 'IN';
      else if (tz.includes('New_York') || tz.includes('Los_Angeles') || tz.includes('Chicago') || tz.includes('Denver')) tzCountryCode = 'US';
      else if (tz.includes('London')) tzCountryCode = 'GB';
      else if (tz.includes('Dubai')) tzCountryCode = 'AE';
      else if (tz.includes('Riyadh')) tzCountryCode = 'SA';
      else if (tz.includes('Singapore')) tzCountryCode = 'SG';
      else if (tz.includes('Toronto') || tz.includes('Vancouver')) tzCountryCode = 'CA';
      else if (tz.includes('Sydney') || tz.includes('Melbourne')) tzCountryCode = 'AU';
    } catch {
      // ignore
    }
  }

  try {
    const res = await fetch('/api/geo/detect-country');
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.countryCode) {
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('detected_country_code', json.countryCode);
        }
        return getCountryByCode(json.countryCode);
      }
    }
  } catch {
    // fallback
  }

  if (tzCountryCode) {
    return getCountryByCode(tzCountryCode);
  }

  return DEFAULT_COUNTRY;
}
