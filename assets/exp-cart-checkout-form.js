/**
 * Cart Checkout Form & Address Book Web Component (`<exp-cart-checkout-form>`)
 *
 * Features:
 * - Compact dropdown trigger + Full CRUD Address Book (View, Create, Edit, Delete, Select).
 * - Guest persistence in `localStorage`; Logged-in Smart Hybrid Sync with `customer.addresses`.
 * - "Use Current Location" GPS reverse geocoding (Google Maps Geocoding API if key provided,
 *   automatic OpenStreetMap Nominatim fallback) + live Google Maps embed preview in Form & View.
 * - Emsifa Indonesia API v2 cascading selects (38 provinces) + auto postal code + fuzzy match,
 *   plus international country support matching Shopify Checkout fields (Country/Region,
 *   First/Last Name, Address, Apartment/Suite optional, City, Province/State, ZIP, Phone optional).
 * - Full Shipping + Billing Checkout Auto-Fill via Cart AJAX + Storefront API GraphQL `cartCreate`
 *   with resilient Shipping + Billing pre-fill query-parameter attachment.
 */

const GUEST_STORAGE_KEY = 'exp_cart_address_book_guest_v2';
const CUSTOMER_STORAGE_PREFIX = 'exp_cart_address_book_customer_v2_';
const DEFAULT_API_BASE = 'https://www.emsifa.com/api-wilayah-indonesia/v2';
const REGION_FETCH_TIMEOUT_MS = 10000;
const GEOCODE_TIMEOUT_MS = 12000;

/** @type {Record<string, string>} */
const COUNTRY_CODE_TO_NAME = {
  ID: 'Indonesia',
  SG: 'Singapore',
  MY: 'Malaysia',
  US: 'United States',
  AU: 'Australia',
  GB: 'United Kingdom',
};

/** @type {Record<string, string>} */
const COUNTRY_NAME_TO_CODE = {
  indonesia: 'ID',
  singapore: 'SG',
  malaysia: 'MY',
  'united states': 'US',
  usa: 'US',
  us: 'US',
  australia: 'AU',
  'united kingdom': 'GB',
  uk: 'GB',
};

/**
 * Maps Kemendagri / Emsifa v2 province IDs (38 provinces) to ISO 3166-2:ID codes.
 * @type {Record<string, string>}
 */
const EMSIFA_PROVINCE_ID_TO_ISO = {
  '11': 'AC',
  '12': 'SU',
  '13': 'SB',
  '14': 'RI',
  '15': 'JA',
  '16': 'SS',
  '17': 'BE',
  '18': 'LA',
  '19': 'BB',
  '21': 'KR',
  '31': 'JK',
  '32': 'JB',
  '33': 'JT',
  '34': 'YO',
  '35': 'JI',
  '36': 'BT',
  '51': 'BA',
  '52': 'NB',
  '53': 'NT',
  '61': 'KB',
  '62': 'KT',
  '63': 'KS',
  '64': 'KI',
  '65': 'KU',
  '71': 'SA',
  '72': 'ST',
  '73': 'SN',
  '74': 'SG',
  '75': 'GO',
  '76': 'SR',
  '81': 'MA',
  '82': 'MU',
  '91': 'PA',
  '92': 'PB',
  '93': 'PS',
  '94': 'PT',
  '95': 'PE',
  '96': 'PD',
};

/** @type {Record<string, string>} */
const ISO_TO_EMSIFA_PROVINCE_ID = Object.fromEntries(
  Object.entries(EMSIFA_PROVINCE_ID_TO_ISO).map(([id, iso]) => [iso, id])
);

/** @type {Record<string, string>} */
const PROVINCE_NAME_TO_ISO = {
  aceh: 'AC',
  'sumatera utara': 'SU',
  'north sumatra': 'SU',
  'sumatera barat': 'SB',
  'west sumatra': 'SB',
  riau: 'RI',
  jambi: 'JA',
  'sumatera selatan': 'SS',
  'south sumatra': 'SS',
  bengkulu: 'BE',
  lampung: 'LA',
  'kepulauan bangka belitung': 'BB',
  'bangka belitung islands': 'BB',
  'bangka belitung': 'BB',
  'kepulauan riau': 'KR',
  'riau islands': 'KR',
  'daerah khusus ibukota jakarta': 'JK',
  'special capital region of jakarta': 'JK',
  'dki jakarta': 'JK',
  jakarta: 'JK',
  'jawa barat': 'JB',
  'west java': 'JB',
  'jawa tengah': 'JT',
  'central java': 'JT',
  'daerah istimewa yogyakarta': 'YO',
  'special region of yogyakarta': 'YO',
  'di yogyakarta': 'YO',
  yogyakarta: 'YO',
  'jawa timur': 'JI',
  'east java': 'JI',
  banten: 'BT',
  bali: 'BA',
  'nusa tenggara barat': 'NB',
  'west nusa tenggara': 'NB',
  'nusa tenggara timur': 'NT',
  'east nusa tenggara': 'NT',
  'kalimantan barat': 'KB',
  'west kalimantan': 'KB',
  'kalimantan tengah': 'KT',
  'central kalimantan': 'KT',
  'kalimantan selatan': 'KS',
  'south kalimantan': 'KS',
  'kalimantan timur': 'KI',
  'east kalimantan': 'KI',
  'kalimantan utara': 'KU',
  'north kalimantan': 'KU',
  'sulawesi utara': 'SA',
  'north sulawesi': 'SA',
  'sulawesi tengah': 'ST',
  'central sulawesi': 'ST',
  'sulawesi selatan': 'SN',
  'south sulawesi': 'SN',
  'sulawesi tenggara': 'SG',
  'southeast sulawesi': 'SG',
  gorontalo: 'GO',
  'sulawesi barat': 'SR',
  'west sulawesi': 'SR',
  maluku: 'MA',
  'maluku utara': 'MU',
  'north maluku': 'MU',
  papua: 'PA',
  'papua barat': 'PB',
  'west papua': 'PB',
  'papua selatan': 'PS',
  'south papua': 'PS',
  'papua tengah': 'PT',
  'central papua': 'PT',
  'papua pegunungan': 'PE',
  'highland papua': 'PE',
  'papua barat daya': 'PD',
  'southwest papua': 'PD',
};

/** @type {Record<string, string>} */
const ISO_TO_SHOPIFY_PROVINCE_NAME = {
  AC: 'Aceh',
  SU: 'North Sumatra',
  SB: 'West Sumatra',
  RI: 'Riau',
  JA: 'Jambi',
  SS: 'South Sumatra',
  BE: 'Bengkulu',
  LA: 'Lampung',
  BB: 'Bangka Belitung',
  KR: 'Riau Islands',
  JK: 'Jakarta',
  JB: 'West Java',
  JT: 'Central Java',
  YO: 'Yogyakarta',
  JI: 'East Java',
  BT: 'Banten',
  BA: 'Bali',
  NB: 'West Nusa Tenggara',
  NT: 'East Nusa Tenggara',
  KB: 'West Kalimantan',
  KT: 'Central Kalimantan',
  KS: 'South Kalimantan',
  KI: 'East Kalimantan',
  KU: 'North Kalimantan',
  SA: 'North Sulawesi',
  ST: 'Central Sulawesi',
  SN: 'South Sulawesi',
  SG: 'Southeast Sulawesi',
  GO: 'Gorontalo',
  SR: 'West Sulawesi',
  MA: 'Maluku',
  MU: 'North Maluku',
  PA: 'Papua',
  PB: 'West Papua',
  PS: 'South Papua',
  PT: 'Central Papua',
  PE: 'Highland Papua',
  PD: 'Southwest Papua',
};

const STOREFRONT_CART_CREATE_MUTATION = `
  mutation ExpCartCheckoutCreate($input: CartInput!) {
    cartCreate(input: $input) {
      cart {
        id
        checkoutUrl
      }
      userErrors {
        field
        message
        code
      }
    }
  }
`;

/** @type {Map<string, Array<{ id: string, name: string, postal_code?: string }>>} */
const regionResponseCache = new Map();

/**
 * Resolves a 2-letter ISO country code from code or country display name.
 * @param {string} countryCode
 * @param {string} countryName
 * @returns {string}
 */
function resolveCountryCode(countryCode, countryName) {
  const code = String(countryCode || '')
    .trim()
    .toUpperCase();
  if (/^[A-Z]{2}$/.test(code)) return code;
  const key = String(countryName || '')
    .trim()
    .toLowerCase();
  return COUNTRY_NAME_TO_CODE[key] || 'ID';
}

/**
 * Resolves human-readable country name for Shopify Checkout query params / forms.
 * @param {string} countryCode
 * @param {string} [fallbackName]
 * @returns {string}
 */
function resolveCountryName(countryCode, fallbackName = '') {
  const code = resolveCountryCode(countryCode, fallbackName);
  return COUNTRY_CODE_TO_NAME[code] || fallbackName || 'Indonesia';
}

/**
 * Normalizes an Indonesian phone input into national digits (without leading 0 or 62).
 * @param {string} raw
 * @returns {string}
 */
function normalizeIndonesianPhoneDigits(raw) {
  let digits = String(raw || '').replace(/\D/g, '');
  if (digits.startsWith('62')) {
    digits = digits.slice(2);
  }
  while (digits.startsWith('0')) {
    digits = digits.slice(1);
  }
  return digits.slice(0, 14);
}

/**
 * Formats phone into E.164 when present; returns empty string when blank.
 * @param {string} rawPhone
 * @param {string} [countryCode='ID']
 * @returns {string}
 */
function formatPhoneForCheckout(rawPhone, countryCode = 'ID') {
  const trimmed = String(rawPhone || '').trim();
  if (!trimmed) return '';
  if (countryCode === 'ID') {
    const cleaned = normalizeIndonesianPhoneDigits(trimmed);
    return cleaned ? `+62${cleaned}` : '';
  }
  if (trimmed.startsWith('+')) {
    return `+${trimmed.replace(/\D/g, '')}`;
  }
  const digits = trimmed.replace(/\D/g, '');
  return digits ? `+${digits}` : '';
}

/**
 * Resolves Shopify ISO province code (2-letter ISO 3166-2:ID for Indonesia, or passthrough for other countries).
 * @param {string} provinceId
 * @param {string} provinceName
 * @param {string} [provinceCode]
 * @param {string} [countryCode='ID']
 * @returns {string}
 */
function resolveProvinceCode(provinceId, provinceName, provinceCode = '', countryCode = 'ID') {
  const upperCode = String(provinceCode || '')
    .trim()
    .toUpperCase()
    .replace(/^ID-/, '');

  if (countryCode !== 'ID') {
    return upperCode || String(provinceName || '').trim();
  }

  if (/^[A-Z]{2}$/.test(upperCode) && ISO_TO_EMSIFA_PROVINCE_ID[upperCode]) {
    return upperCode;
  }
  if (provinceId && EMSIFA_PROVINCE_ID_TO_ISO[provinceId]) {
    return EMSIFA_PROVINCE_ID_TO_ISO[provinceId];
  }
  const key = String(provinceName || '')
    .trim()
    .toLowerCase();
  return PROVINCE_NAME_TO_ISO[key] || upperCode || provinceName || '';
}

/**
 * Reverse-maps ISO code or province name to Emsifa province ID.
 * @param {string} provinceCode
 * @param {string} provinceName
 * @returns {string}
 */
function resolveEmsifaProvinceId(provinceCode, provinceName) {
  const iso = resolveProvinceCode('', provinceName, provinceCode, 'ID');
  return ISO_TO_EMSIFA_PROVINCE_ID[iso] || '';
}

/**
 * Builds Shopify `address2` value (combines Apartment/Suite & Kec./Kel. cleanly).
 * @param {string} apartment
 * @param {string} districtName
 * @param {string} subdistrictName
 * @param {string} [fallbackLine]
 * @returns {string}
 */
function buildAddress2Line(apartment, districtName, subdistrictName, fallbackLine = '') {
  const parts = [];
  const apt = String(apartment || '').trim();
  if (apt) parts.push(apt);
  if (districtName) parts.push(`Kec. ${districtName}`);
  if (subdistrictName) parts.push(`Kel. ${subdistrictName}`);
  if (parts.length > 0) return parts.join(', ');
  return String(fallbackLine || '').trim();
}

/**
 * Parses `Kec. ..., Kel. ...` back into district & subdistrict hints.
 * @param {string} line
 * @returns {{ apartment: string, district: string, subdistrict: string }}
 */
function parseAddress2Line(line) {
  const text = String(line || '').trim();
  const kecMatch = text.match(/Kec\.?\s*([^,]+)/i);
  const kelMatch = text.match(/Kel\.?\s*([^,]+)/i);
  const remaining = text
    .replace(/,?\s*Kec\.?\s*[^,]+/gi, '')
    .replace(/,?\s*Kel\.?\s*[^,]+/gi, '')
    .replace(/^,\s*|,\s*$/g, '')
    .trim();
  return {
    apartment: remaining,
    district: kecMatch ? kecMatch[1].trim() : '',
    subdistrict: kelMatch ? kelMatch[1].trim() : '',
  };
}

/**
 * Extracts unique Shopify discount codes from `/cart.js` payload.
 * @param {Record<string, any>} cartData
 * @returns {string[]}
 */
function extractDiscountCodes(cartData) {
  /** @type {Set<string>} */
  const codes = new Set();

  if (Array.isArray(cartData?.cart_level_discount_applications)) {
    for (const app of cartData.cart_level_discount_applications) {
      if (app?.type === 'discount_code' && app?.title) {
        codes.add(String(app.title));
      }
    }
  }

  if (Array.isArray(cartData?.items)) {
    for (const item of cartData.items) {
      if (Array.isArray(item?.line_level_discount_allocations)) {
        for (const alloc of item.line_level_discount_allocations) {
          const app = alloc?.discount_application;
          if (app?.type === 'discount_code' && app?.title) {
            codes.add(String(app.title));
          }
        }
      }
    }
  }

  return Array.from(codes);
}

/**
 * Generates a compact unique ID for local addresses.
 * @returns {string}
 */
function createLocalId() {
  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Normalizes a region string for fuzzy matching (strips Kabupaten/Kota/Kecamatan/Kelurahan prefixes).
 * @param {string} val
 * @returns {string}
 */
function normalizeRegionCompare(val) {
  return String(val || '')
    .toLowerCase()
    .replace(/^(kabupaten|kab\.?|kota|kecamatan|kec\.?|kelurahan|kel\.?|desa|daerah khusus ibukota|dki|daerah istimewa|di)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Builds a Google Maps embed URL and external Google Maps link from coordinates or address query.
 * @param {{ lat?: number | null, lng?: number | null, query?: string }} params
 * @returns {{ embedUrl: string, openUrl: string, label: string } | null}
 */
function buildGoogleMapsPreview({ lat, lng, query }) {
  const hasCoords =
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng);

  if (hasCoords) {
    const coords = `${lat.toFixed(6)},${lng.toFixed(6)}`;
    return {
      embedUrl: `https://maps.google.com/maps?q=${encodeURIComponent(coords)}&z=16&output=embed`,
      openUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(coords)}`,
      label: `GPS: ${lat.toFixed(5)}, ${lng.toFixed(5)}`,
    };
  }

  const cleanQuery = String(query || '').trim();
  if (!cleanQuery) return null;
  return {
    embedUrl: `https://maps.google.com/maps?q=${encodeURIComponent(cleanQuery)}&z=15&output=embed`,
    openUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cleanQuery)}`,
    label: 'Google Maps preview',
  };
}

/**
 * Appends Shopify Checkout Shipping + Billing pre-fill query parameters onto any checkout URL.
 * Ensures both physical products (Delivery/Shipping) and digital/Gift Card carts (Billing address)
 * strictly pre-fill with the shopper's selected address instead of falling back to an old default.
 * @param {string} baseUrl
 * @param {Record<string, any>} addr
 * @returns {string}
 */
function appendCheckoutPrefillParams(baseUrl, addr) {
  const url = new URL(baseUrl, typeof window !== 'undefined' ? window.location.origin : 'https://example.com');
  const params = url.searchParams;

  const countryCode = resolveCountryCode(addr.countryCode, addr.country);
  const countryName = resolveCountryName(countryCode, addr.country);
  const provinceCode = resolveProvinceCode(
    addr.provinceId,
    addr.provinceName,
    addr.provinceCode,
    countryCode
  );
  const address2 = buildAddress2Line(
    addr.apartment,
    addr.districtName,
    addr.subdistrictName,
    addr.subdistrictLine
  );
  const phoneE164 = formatPhoneForCheckout(addr.phone, countryCode);
  const firstName = String(addr.firstName || '').trim();
  const lastName = String(addr.lastName || '').trim();
  const address1 = String(addr.detailAddress || '').trim();
  const city = String(addr.cityName || '').trim();
  const zip = String(addr.postalCode || '').trim();
  const email = String(addr.email || '').trim();

  if (email) params.set('checkout[email]', email);

  for (const scope of ['shipping_address', 'billing_address']) {
    if (firstName) params.set(`checkout[${scope}][first_name]`, firstName);
    if (lastName) params.set(`checkout[${scope}][last_name]`, lastName);
    if (address1) params.set(`checkout[${scope}][address1]`, address1);
    if (address2) params.set(`checkout[${scope}][address2]`, address2);
    if (city) params.set(`checkout[${scope}][city]`, city);
    if (provinceCode) params.set(`checkout[${scope}][province]`, provinceCode);
    if (zip) params.set(`checkout[${scope}][zip]`, zip);
    if (countryName) params.set(`checkout[${scope}][country]`, countryName);
    if (phoneE164) params.set(`checkout[${scope}][phone]`, phoneE164);
  }

  return url.toString();
}

/**
 * Builds a normalized comparison fingerprint so migrated guest addresses and synced
 * Shopify account addresses reconcile cleanly without creating duplicate cards.
 * @param {Record<string, any> | null} addr
 * @returns {string}
 */
function buildAddressFingerprint(addr) {
  if (!addr) return '';
  const countryCode = resolveCountryCode(addr.countryCode, addr.country);
  const provinceCode = resolveProvinceCode(
    addr.provinceId,
    addr.provinceName,
    addr.provinceCode,
    countryCode
  );
  const address2 = buildAddress2Line(
    addr.apartment,
    addr.districtName,
    addr.subdistrictName,
    addr.subdistrictLine
  );
  const clean = (val) =>
    String(val || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');

  const street = clean(addr.detailAddress);
  const city = clean(addr.cityName);
  if (!street && !city) return '';

  return [
    clean(countryCode),
    clean(addr.firstName),
    clean(addr.lastName),
    street,
    clean(address2),
    city,
    clean(provinceCode),
    clean(addr.postalCode),
  ].join('|');
}

/**
 * Normalizes a local/guest address record into consistent shape.
 * @param {Record<string, any>} raw
 * @param {{ email?: string }} [defaults]
 * @returns {Record<string, any>}
 */
function normalizeLocalAddressRecord(raw, defaults = {}) {
  const countryCode = resolveCountryCode(raw.countryCode, raw.country);
  const parsedSub = parseAddress2Line(raw.subdistrictLine || '');
  const apartment = raw.apartment ?? parsedSub.apartment ?? '';
  const districtName = raw.districtName ?? parsedSub.district ?? '';
  const subdistrictName = raw.subdistrictName ?? parsedSub.subdistrict ?? '';
  const subdistrictLine = buildAddress2Line(
    apartment,
    countryCode === 'ID' ? districtName : '',
    countryCode === 'ID' ? subdistrictName : '',
    raw.subdistrictLine || ''
  );

  return {
    ...raw,
    shopifyId: null,
    source: 'local',
    countryCode,
    country: resolveCountryName(countryCode, raw.country),
    email: raw.email || defaults.email || '',
    phone:
      countryCode === 'ID'
        ? normalizeIndonesianPhoneDigits(raw.phone || '')
        : String(raw.phone || '').trim(),
    provinceId:
      raw.provinceId ||
      (countryCode === 'ID' ? resolveEmsifaProvinceId(raw.provinceCode, raw.provinceName) : ''),
    provinceCode: resolveProvinceCode(
      raw.provinceId,
      raw.provinceName,
      raw.provinceCode,
      countryCode
    ),
    apartment,
    districtName,
    subdistrictName,
    subdistrictLine,
  };
}

/**
 * Preserves cart-specific metadata (GPS coords, Emsifa IDs, delivery method, courier notes)
 * when reconciling a local/guest address with its matching Shopify account address.
 * @param {Record<string, any>} accountRecord
 * @param {Record<string, any>} localAddr
 * @returns {Record<string, any>}
 */
function mergeRichMetadataIntoAccount(accountRecord, localAddr) {
  const localIsNewer = (Number(localAddr.updatedAt) || 0) >= (Number(accountRecord.updatedAt) || 0);
  return {
    ...accountRecord,
    label:
      (localIsNewer ? localAddr.label : accountRecord.label) ||
      accountRecord.label ||
      localAddr.label ||
      '',
    deliveryMethod:
      (localIsNewer ? localAddr.deliveryMethod : accountRecord.deliveryMethod) ||
      accountRecord.deliveryMethod ||
      localAddr.deliveryMethod ||
      'express',
    email: accountRecord.email || localAddr.email || '',
    phone: accountRecord.phone || localAddr.phone || '',
    provinceId: accountRecord.provinceId || localAddr.provinceId || '',
    cityId: accountRecord.cityId || localAddr.cityId || '',
    districtId: accountRecord.districtId || localAddr.districtId || '',
    districtName: accountRecord.districtName || localAddr.districtName || '',
    subdistrictId: accountRecord.subdistrictId || localAddr.subdistrictId || '',
    subdistrictName: accountRecord.subdistrictName || localAddr.subdistrictName || '',
    apartment: accountRecord.apartment || localAddr.apartment || '',
    noteCouriers:
      (localIsNewer ? localAddr.noteCouriers : accountRecord.noteCouriers) ||
      accountRecord.noteCouriers ||
      localAddr.noteCouriers ||
      '',
    lat:
      localIsNewer && typeof localAddr.lat === 'number'
        ? localAddr.lat
        : typeof accountRecord.lat === 'number'
          ? accountRecord.lat
          : typeof localAddr.lat === 'number'
            ? localAddr.lat
            : null,
    lng:
      localIsNewer && typeof localAddr.lng === 'number'
        ? localAddr.lng
        : typeof accountRecord.lng === 'number'
          ? accountRecord.lng
          : typeof localAddr.lng === 'number'
            ? localAddr.lng
            : null,
    updatedAt: Math.max(Number(accountRecord.updatedAt) || 0, Number(localAddr.updatedAt) || 0),
  };
}

/**
 * Merges server Shopify customer addresses with customer-scoped local overrides/additions
 * and migrates any pre-login guest addresses seamlessly without duplicates.
 * @param {Array<Record<string, any>>} accountAddresses
 * @param {{ addresses?: Array<Record<string, any>>, overrides?: Record<string, Record<string, any>>, deletedShopifyIds?: string[], selectedId?: string | null }} localData
 * @param {{ addresses?: Array<Record<string, any>>, selectedId?: string | null } | null} [guestData=null]
 * @param {{ email?: string }} [customerDefaults]
 * @returns {{
 *   addresses: Array<Record<string, any>>,
 *   selectedId: string | null,
 *   overrides: Record<string, Record<string, any>>,
 *   deletedShopifyIds: string[],
 *   migratedNewAddresses: Array<Record<string, any>>,
 *   didMigrateGuest: boolean,
 *   didReconcile: boolean
 * }}
 */
function mergeAccountAndLocalAddresses(
  accountAddresses,
  localData,
  guestData = null,
  customerDefaults = {}
) {
  const deletedSet = new Set((localData?.deletedShopifyIds || []).map(String));
  /** @type {Record<string, Record<string, any>>} */
  const overrides = { ...(localData?.overrides || {}) };

  /** @type {Array<Record<string, any>>} */
  const accountRecords = [];
  /** @type {Map<string, Record<string, any>>} */
  const accountByFp = new Map();
  /** @type {Set<string>} */
  const usedIds = new Set();

  for (const raw of accountAddresses || []) {
    const shopifyId = String(raw.shopifyId || '');
    if (!shopifyId || deletedSet.has(shopifyId)) continue;

    const id = `shopify-${shopifyId}`;
    const ov = overrides[shopifyId] || {};
    const countryCode = resolveCountryCode(ov.countryCode ?? raw.countryCode, ov.country ?? raw.country);
    const parsedSub = parseAddress2Line(raw.subdistrictLine || '');
    const rawPhone = ov.phone ?? raw.phone ?? '';

    const record = {
      id,
      shopifyId,
      source: 'account',
      label: ov.label ?? raw.label ?? '',
      deliveryMethod: ov.deliveryMethod || 'express',
      countryCode,
      country: resolveCountryName(countryCode, ov.country ?? raw.country),
      firstName: ov.firstName ?? raw.firstName ?? '',
      lastName: ov.lastName ?? raw.lastName ?? '',
      email: ov.email ?? raw.email ?? '',
      phone: countryCode === 'ID' ? normalizeIndonesianPhoneDigits(rawPhone) : String(rawPhone || '').trim(),
      provinceId:
        ov.provinceId ||
        (countryCode === 'ID' ? resolveEmsifaProvinceId(raw.provinceCode, raw.provinceName) : ''),
      provinceName: ov.provinceName ?? raw.provinceName ?? '',
      provinceCode:
        ov.provinceCode ||
        resolveProvinceCode('', raw.provinceName, raw.provinceCode, countryCode),
      cityId: ov.cityId || '',
      cityName: ov.cityName ?? raw.cityName ?? '',
      districtId: ov.districtId || '',
      districtName: ov.districtName ?? parsedSub.district ?? '',
      subdistrictId: ov.subdistrictId || '',
      subdistrictName: ov.subdistrictName ?? parsedSub.subdistrict ?? '',
      apartment: ov.apartment ?? parsedSub.apartment ?? '',
      subdistrictLine: ov.subdistrictLine ?? raw.subdistrictLine ?? '',
      postalCode: ov.postalCode ?? raw.postalCode ?? '',
      detailAddress: ov.detailAddress ?? raw.detailAddress ?? '',
      noteCouriers: ov.noteCouriers ?? '',
      lat: typeof ov.lat === 'number' ? ov.lat : null,
      lng: typeof ov.lng === 'number' ? ov.lng : null,
      isDefault: typeof ov.isDefault === 'boolean' ? ov.isDefault : Boolean(raw.isDefault),
      updatedAt: ov.updatedAt || 0,
    };

    accountRecords.push(record);
    usedIds.add(id);
    const fp = buildAddressFingerprint(record);
    if (fp && !accountByFp.has(fp)) {
      accountByFp.set(fp, record);
    }
  }

  /** @type {Array<Record<string, any>>} */
  const localRecords = [];
  /** @type {Map<string, Record<string, any>>} */
  const localByFp = new Map();
  let remappedSelectedId = localData?.selectedId || null;
  let didReconcile = false;

  for (const localAddr of localData?.addresses || []) {
    if (!localAddr || !localAddr.id) continue;
    if (localAddr.source === 'account') continue;

    const normalized = normalizeLocalAddressRecord(localAddr, customerDefaults);
    const fp = buildAddressFingerprint(normalized);

    if (fp && accountByFp.has(fp)) {
      const accountRecord = accountByFp.get(fp);
      if (accountRecord) {
        const enriched = mergeRichMetadataIntoAccount(accountRecord, normalized);
        Object.assign(accountRecord, enriched);
        overrides[String(accountRecord.shopifyId)] = { ...accountRecord };
        if (remappedSelectedId === normalized.id) {
          remappedSelectedId = accountRecord.id;
        }
        didReconcile = true;
        continue;
      }
    }

    if (fp && localByFp.has(fp)) {
      const existingLocal = localByFp.get(fp);
      if (existingLocal && remappedSelectedId === normalized.id) {
        remappedSelectedId = existingLocal.id;
      }
      didReconcile = true;
      continue;
    }

    localRecords.push(normalized);
    usedIds.add(normalized.id);
    if (fp) localByFp.set(fp, normalized);
  }

  const guestList = Array.isArray(guestData?.addresses)
    ? guestData.addresses.filter((item) => item && item.id)
    : [];
  const didMigrateGuest = guestList.length > 0;
  /** @type {Array<Record<string, any>>} */
  const migratedNewAddresses = [];
  const guestSelectedSourceId = guestData?.selectedId || null;
  /** @type {string | null} */
  let matchedExplicitGuestSelectedId = null;
  /** @type {string | null} */
  let firstMigratedTargetId = null;
  let hasExistingDefault =
    accountRecords.some((a) => a.isDefault) || localRecords.some((a) => a.isDefault);

  for (const rawGuest of guestList) {
    const isGuestSelected = Boolean(guestSelectedSourceId && rawGuest.id === guestSelectedSourceId);
    const guestAddr = normalizeLocalAddressRecord(rawGuest, customerDefaults);
    const fp = buildAddressFingerprint(guestAddr);
    /** @type {string} */
    let targetId;

    if (fp && accountByFp.has(fp)) {
      const accountRecord = accountByFp.get(fp);
      const enriched = mergeRichMetadataIntoAccount(/** @type {Record<string, any>} */ (accountRecord), guestAddr);
      Object.assign(/** @type {Record<string, any>} */ (accountRecord), enriched);
      overrides[String(enriched.shopifyId)] = { ...enriched };
      targetId = enriched.id;
    } else if (fp && localByFp.has(fp)) {
      const existingLocal = /** @type {Record<string, any>} */ (localByFp.get(fp));
      if ((Number(guestAddr.updatedAt) || 0) >= (Number(existingLocal.updatedAt) || 0)) {
        existingLocal.label = guestAddr.label || existingLocal.label;
        existingLocal.deliveryMethod = guestAddr.deliveryMethod || existingLocal.deliveryMethod;
        existingLocal.noteCouriers = guestAddr.noteCouriers || existingLocal.noteCouriers;
        existingLocal.phone = guestAddr.phone || existingLocal.phone;
        existingLocal.email = guestAddr.email || existingLocal.email;
        if (typeof guestAddr.lat === 'number' && typeof guestAddr.lng === 'number') {
          existingLocal.lat = guestAddr.lat;
          existingLocal.lng = guestAddr.lng;
        }
        existingLocal.updatedAt = Math.max(
          Number(existingLocal.updatedAt) || 0,
          Number(guestAddr.updatedAt) || 0
        );
      }
      targetId = existingLocal.id;
    } else {
      if (!guestAddr.id || usedIds.has(guestAddr.id)) {
        guestAddr.id = createLocalId();
      }
      if (hasExistingDefault) {
        guestAddr.isDefault = false;
      } else if (guestAddr.isDefault) {
        hasExistingDefault = true;
      }
      localRecords.push(guestAddr);
      usedIds.add(guestAddr.id);
      if (fp) localByFp.set(fp, guestAddr);
      migratedNewAddresses.push(guestAddr);
      targetId = guestAddr.id;
    }

    if (!firstMigratedTargetId) firstMigratedTargetId = targetId;
    if (isGuestSelected) matchedExplicitGuestSelectedId = targetId;
  }

  const merged = [...accountRecords, ...localRecords];
  merged.sort((a, b) => Number(Boolean(b.isDefault)) - Number(Boolean(a.isDefault)));

  const guestSelectedTargetId = matchedExplicitGuestSelectedId || firstMigratedTargetId || null;
  let selectedId = null;

  if (guestSelectedTargetId && merged.some((a) => a.id === guestSelectedTargetId)) {
    selectedId = guestSelectedTargetId;
  } else if (remappedSelectedId && merged.some((a) => a.id === remappedSelectedId)) {
    selectedId = remappedSelectedId;
  } else {
    const defaultItem = merged.find((a) => a.isDefault) || merged[0] || null;
    selectedId = defaultItem ? defaultItem.id : null;
  }

  return {
    addresses: merged,
    selectedId,
    overrides,
    deletedShopifyIds: Array.from(deletedSet),
    migratedNewAddresses,
    didMigrateGuest,
    didReconcile,
  };
}

/**
 * Checks whether an address record has the required fields for Shopify Checkout pre-fill.
 * Note: Phone and Apartment/Subdistrict are optional (matching Shopify Checkout itself),
 * so saved account addresses without a phone number still pre-fill Checkout reliably!
 * @param {Record<string, any> | null} addr
 * @returns {boolean}
 */
function isAddressCheckoutReady(addr) {
  if (!addr) return false;
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(addr.email || '').trim());
  const hasRegion = Boolean(
    (addr.provinceCode || addr.provinceName) && String(addr.cityName || '').trim()
  );
  const hasStreet = Boolean(String(addr.detailAddress || '').trim().length >= 3);
  return Boolean(
    String(addr.firstName || '').trim() &&
      String(addr.lastName || '').trim() &&
      emailOk &&
      hasRegion &&
      hasStreet
  );
}

/**
 * Parses a Nominatim OpenStreetMap reverse-geocoding payload into normalized form fields.
 * @param {Record<string, any>} data
 * @param {number} lat
 * @param {number} lng
 * @returns {Record<string, any>}
 */
function parseNominatimResult(data, lat, lng) {
  const a = data?.address || {};
  const countryCode = String(a.country_code || 'id').toUpperCase();
  const roadParts = [a.road, a.house_number, a.neighbourhood, a.hamlet].filter(Boolean);
  const street = roadParts.length > 0 ? roadParts.join(', ') : String(data?.display_name || '').split(',').slice(0, 2).join(',').trim();

  const provinceName = a.state || a.region || '';
  const cityName = a.city || a.regency || a.county || a.town || a.municipality || '';
  const districtName = a.city_district || a.suburb || a.district || '';
  const subdistrictName = a.village || a.quarter || a.neighbourhood || '';
  const postalCode = String(a.postcode || '').replace(/[^\dA-Za-z -]/g, '').trim();

  return {
    countryCode: COUNTRY_CODE_TO_NAME[countryCode] ? countryCode : 'ID',
    country: resolveCountryName(countryCode, a.country || ''),
    detailAddress: street,
    provinceName,
    provinceCode: resolveProvinceCode('', provinceName, '', countryCode),
    cityName,
    districtName,
    subdistrictName,
    postalCode,
    lat,
    lng,
  };
}

/**
 * Parses a Google Maps Geocoding API response into normalized form fields.
 * @param {Record<string, any>} data
 * @param {number} lat
 * @param {number} lng
 * @returns {Record<string, any> | null}
 */
function parseGoogleGeocodeResult(data, lat, lng) {
  const first = Array.isArray(data?.results) ? data.results[0] : null;
  if (!first) return null;

  const components = Array.isArray(first.address_components) ? first.address_components : [];
  const pick = (type, short = false) => {
    const found = components.find((c) => Array.isArray(c.types) && c.types.includes(type));
    return found ? (short ? found.short_name : found.long_name) || '' : '';
  };

  const countryCode = (pick('country', true) || 'ID').toUpperCase();
  const streetNumber = pick('street_number');
  const route = pick('route');
  const premise = pick('premise');
  const street = [route, streetNumber ? `No. ${streetNumber}` : '', premise]
    .filter(Boolean)
    .join(', ') || String(first.formatted_address || '').split(',')[0].trim();

  const provinceName = pick('administrative_area_level_1');
  const provinceShort = pick('administrative_area_level_1', true);
  const cityName = pick('administrative_area_level_2') || pick('locality');
  const districtName = pick('administrative_area_level_3') || pick('sublocality_level_1');
  const subdistrictName = pick('administrative_area_level_4') || pick('sublocality_level_2');
  const postalCode = pick('postal_code');

  return {
    countryCode: COUNTRY_CODE_TO_NAME[countryCode] ? countryCode : 'ID',
    country: resolveCountryName(countryCode, pick('country')),
    detailAddress: street,
    provinceName,
    provinceCode: resolveProvinceCode('', provinceName, provinceShort, countryCode),
    cityName,
    districtName,
    subdistrictName,
    postalCode,
    lat,
    lng,
  };
}

class ExpCartCheckoutForm extends HTMLElement {
  /** @type {AbortController | null} */
  #lifecycleAbort = null;

  /** @type {Record<string, AbortController>} */
  #regionAbortControllers = {};

  /** @type {MutationObserver | null} */
  #cartObserver = null;

  /** @type {boolean} */
  #isSubmittingCheckout = false;

  /** @type {boolean} */
  #isSaving = false;

  /** @type {boolean} */
  #isDetectingLocation = false;

  /** @type {boolean} */
  #postalManuallyEdited = false;

  /** @type {{ isLoggedIn: boolean, customerId: string | null, email: string, firstName: string, lastName: string, phone: string, accountAddressesUrl: string, accountLoginUrl: string, defaultAddressId: string | null, addresses: Array<Record<string, any>> }} */
  #customerContext = {
    isLoggedIn: false,
    customerId: null,
    email: '',
    firstName: '',
    lastName: '',
    phone: '',
    accountAddressesUrl: '/account/addresses',
    accountLoginUrl: '/account/login',
    defaultAddressId: null,
    addresses: [],
  };

  /** @type {Array<Record<string, any>>} */
  #addresses = [];

  /** @type {string | null} */
  #selectedAddressId = null;

  /** @type {boolean} */
  #dropdownOpen = false;

  /** @type {'closed' | 'view' | 'create' | 'edit'} */
  #modalMode = 'closed';

  /** @type {string | null} */
  #editingAddressId = null;

  /** @type {string | null} */
  #viewingAddressId = null;

  /** @type {string | null} */
  #confirmDeleteId = null;

  /** @type {number} */
  #formStep = 1;

  /** @type {Record<string, any>} */
  #draft = this.#createEmptyDraft();

  /** @type {Array<{ id: string, name: string, postal_code?: string }>} */
  #currentVillages = [];

  /** @type {string} */
  #syncBannerMessage = '';

  /** @type {Array<Record<string, any>>} */
  #pendingGuestSyncAddresses = [];

  connectedCallback() {
    this.#lifecycleAbort?.abort();
    this.#lifecycleAbort = new AbortController();
    const { signal } = this.#lifecycleAbort;

    this.#dropdownOpen = this.dataset.dropdownOpen === 'true';
    this.#parseCustomerContext();
    this.#loadAddressBook();
    this.#bindEvents(signal);
    this.#bindCartCheckoutHooks(signal);
    this.#observeCartSectionChanges();

    this.#renderAll();
    this.#syncCartEmptyVisibility();
    this.#syncCheckoutButtonState();

    const active = this.#getSelectedAddress();
    if (active && isAddressCheckoutReady(active) && !this.#isDesignMode) {
      void this.#syncCartAttributes(active).catch(() => {});
    }

    if (
      this.#pendingGuestSyncAddresses.length > 0 &&
      this.#customerContext.isLoggedIn &&
      !this.#isDesignMode
    ) {
      void this.#syncMigratedGuestAddresses(this.#pendingGuestSyncAddresses);
    }
  }

  disconnectedCallback() {
    this.#lifecycleAbort?.abort();
    this.#lifecycleAbort = null;

    for (const key of Object.keys(this.#regionAbortControllers)) {
      this.#regionAbortControllers[key]?.abort();
    }
    this.#regionAbortControllers = {};

    this.#cartObserver?.disconnect();
    this.#cartObserver = null;
  }

  /** @returns {string} */
  get #apiBase() {
    return (this.dataset.apiBase || DEFAULT_API_BASE).trim().replace(/\/+$/, '');
  }

  /** @returns {boolean} */
  get #requireBeforeCheckout() {
    return this.dataset.requireCheckout === 'true';
  }

  /** @returns {boolean} */
  get #isDesignMode() {
    return this.dataset.designMode === 'true';
  }

  /** @returns {string} */
  get #storageKey() {
    if (this.#customerContext.isLoggedIn) {
      const accountKey = this.#customerContext.customerId || this.#customerContext.email;
      if (accountKey) {
        return `${CUSTOMER_STORAGE_PREFIX}${String(accountKey).toLowerCase()}`;
      }
    }
    return GUEST_STORAGE_KEY;
  }

  #createEmptyDraft() {
    return {
      label: '',
      deliveryMethod: 'express',
      countryCode: 'ID',
      country: 'Indonesia',
      firstName: this.#customerContext?.firstName || '',
      lastName: this.#customerContext?.lastName || '',
      email: this.#customerContext?.email || '',
      phone: normalizeIndonesianPhoneDigits(this.#customerContext?.phone || ''),
      provinceId: '',
      provinceName: '',
      provinceCode: '',
      cityId: '',
      cityName: '',
      districtId: '',
      districtName: '',
      subdistrictId: '',
      subdistrictName: '',
      apartment: '',
      subdistrictLine: '',
      postalCode: '',
      detailAddress: '',
      noteCouriers: '',
      lat: null,
      lng: null,
      isDefault: this.#addresses?.length === 0,
    };
  }

  #parseCustomerContext() {
    const scriptEl = this.querySelector('script[data-customer-context]');
    if (!scriptEl?.textContent) return;
    try {
      const parsed = JSON.parse(scriptEl.textContent);
      this.#customerContext = {
        ...this.#customerContext,
        ...parsed,
        addresses: Array.isArray(parsed.addresses) ? parsed.addresses : [],
      };
    } catch {
      // Keep default guest context
    }
  }

  /**
   * @param {string} key
   * @returns {Record<string, any>}
   */
  #readStorageBucket(key) {
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  /** @returns {Record<string, any>} */
  #readLocalBucket() {
    return this.#readStorageBucket(this.#storageKey);
  }

  /**
   * @param {Record<string, any>} bucket
   * @param {string} [key]
   * @returns {boolean}
   */
  #writeLocalBucket(bucket, key = this.#storageKey) {
    try {
      window.localStorage.setItem(key, JSON.stringify(bucket));
      return true;
    } catch {
      // Ignore storage quota/private-mode errors
      return false;
    }
  }

  #clearGuestBucket() {
    try {
      window.localStorage.removeItem(GUEST_STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
  }

  #loadAddressBook() {
    const bucket = this.#readLocalBucket();
    this.#pendingGuestSyncAddresses = [];

    if (this.#customerContext.isLoggedIn) {
      const hasDistinctCustomerKey = this.#storageKey !== GUEST_STORAGE_KEY;
      const guestBucket = hasDistinctCustomerKey
        ? this.#readStorageBucket(GUEST_STORAGE_KEY)
        : null;

      const merged = mergeAccountAndLocalAddresses(
        this.#customerContext.addresses,
        bucket,
        guestBucket,
        { email: this.#customerContext.email }
      );
      this.#addresses = merged.addresses;
      this.#selectedAddressId = merged.selectedId;

      if (merged.didMigrateGuest || merged.didReconcile) {
        const localOnly = this.#addresses.filter((a) => a.source !== 'account');
        const persisted = this.#writeLocalBucket({
          addresses: localOnly,
          overrides: merged.overrides,
          deletedShopifyIds: merged.deletedShopifyIds,
          selectedId: this.#selectedAddressId,
        });

        if (merged.didMigrateGuest && persisted && hasDistinctCustomerKey) {
          this.#clearGuestBucket();
        }
      }

      if (merged.didMigrateGuest) {
        if (merged.migratedNewAddresses.length > 0) {
          this.#pendingGuestSyncAddresses = merged.migratedNewAddresses;
          const count = merged.migratedNewAddresses.length;
          this.#syncBannerMessage =
            count === 1
              ? 'Your address saved before sign-in was carried over to your account.'
              : `${count} addresses saved before sign-in were carried over to your account.`;
        } else {
          this.#syncBannerMessage =
            'Your address saved before sign-in matched your Shopify account and is ready for checkout.';
        }
      }
    } else {
      const savedList = Array.isArray(bucket.addresses) ? bucket.addresses : [];
      this.#addresses = savedList
        .filter((item) => item && item.id)
        .map((item) => normalizeLocalAddressRecord(item));
      this.#addresses.sort((a, b) => Number(Boolean(b.isDefault)) - Number(Boolean(a.isDefault)));

      if (bucket.selectedId && this.#addresses.some((a) => a.id === bucket.selectedId)) {
        this.#selectedAddressId = bucket.selectedId;
      } else {
        const def = this.#addresses.find((a) => a.isDefault) || this.#addresses[0] || null;
        this.#selectedAddressId = def ? def.id : null;
      }
    }
  }

  /**
   * @param {{ overrideShopifyId?: string, overrideData?: Record<string, any>, extraOverrides?: Record<string, Record<string, any>>, deletedShopifyId?: string }} [delta]
   */
  #saveAddressBookState(delta = {}) {
    const bucket = this.#readLocalBucket();
    const overrides = { ...(bucket.overrides || {}), ...(delta.extraOverrides || {}) };
    const deletedSet = new Set((bucket.deletedShopifyIds || []).map(String));

    if (delta.overrideShopifyId && delta.overrideData) {
      overrides[delta.overrideShopifyId] = delta.overrideData;
    }
    if (delta.deletedShopifyId) {
      deletedSet.add(String(delta.deletedShopifyId));
      delete overrides[String(delta.deletedShopifyId)];
    }

    const localOnly = this.#addresses.filter((a) => a.source !== 'account');

    this.#writeLocalBucket({
      addresses: localOnly,
      overrides,
      deletedShopifyIds: Array.from(deletedSet),
      selectedId: this.#selectedAddressId,
    });
  }

  /** @returns {Record<string, any> | null} */
  #getSelectedAddress() {
    if (!this.#selectedAddressId) return null;
    return this.#addresses.find((a) => a.id === this.#selectedAddressId) || null;
  }

  /**
   * @param {string} id
   * @returns {Record<string, any> | null}
   */
  #findAddressById(id) {
    return this.#addresses.find((a) => a.id === id) || null;
  }

  /**
   * @param {string} name
   * @returns {HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null}
   */
  #getField(name) {
    return this.querySelector(`[data-field="${name}"]`);
  }

  /** @param {AbortSignal} signal */
  #bindEvents(signal) {
    this.addEventListener(
      'click',
      (event) => {
        const target = event.target instanceof Element ? event.target : null;
        if (!target) return;

        const dialog = this.querySelector('[data-modal-dialog]');
        if (target === dialog && dialog instanceof HTMLDialogElement) {
          this.#closeModal();
          return;
        }

        const stepTrigger = target.closest('[data-step-trigger]');
        if (stepTrigger instanceof HTMLElement) {
          this.#handleStepClick(Number(stepTrigger.dataset.stepTrigger));
          return;
        }

        const actionEl = target.closest('[data-action]');
        if (!(actionEl instanceof HTMLElement)) return;

        const action = actionEl.dataset.action;
        const addrId = actionEl.dataset.addressId || '';

        switch (action) {
          case 'toggle-dropdown':
            this.#toggleDropdown();
            break;
          case 'select-address':
            this.#selectAddress(addrId);
            break;
          case 'open-view':
            this.#openViewModal(addrId);
            break;
          case 'open-create':
            void this.#openFormModal('create', null);
            break;
          case 'create-from-location':
            void this.#handleCreateFromCurrentLocation(actionEl);
            break;
          case 'detect-location':
            void this.#detectLocationIntoForm(actionEl);
            break;
          case 'preview-address-map':
            this.#previewManualAddressOnMap();
            break;
          case 'open-edit':
            void this.#openFormModal('edit', addrId);
            break;
          case 'request-delete':
            this.#confirmDeleteId = addrId;
            this.#renderAddressList();
            break;
          case 'cancel-delete':
            this.#confirmDeleteId = null;
            this.#renderAddressList();
            break;
          case 'confirm-delete':
            void this.#deleteAddress(addrId);
            break;
          case 'close-modal':
            this.#closeModal();
            break;
          case 'edit-from-view':
            if (this.#viewingAddressId) {
              void this.#openFormModal('edit', this.#viewingAddressId);
            }
            break;
          case 'use-from-view':
            if (this.#viewingAddressId) {
              this.#selectAddress(this.#viewingAddressId);
              this.#closeModal();
            }
            break;
          case 'next-step':
            this.#handleNextStep();
            break;
          case 'prev-step':
            this.#goToStep(1);
            break;
          case 'save-address':
            void this.#handleSaveAddress();
            break;
          case 'retry-regions':
            void this.#initializeRegionSelects(true);
            break;
          case 'proceed-checkout':
            void this.#launchAutoFilledCheckout(actionEl);
            break;
          default:
            break;
        }
      },
      { signal }
    );

    const dialog = this.querySelector('[data-modal-dialog]');
    if (dialog instanceof HTMLDialogElement) {
      dialog.addEventListener(
        'close',
        () => {
          this.#modalMode = 'closed';
          this.#editingAddressId = null;
          this.#viewingAddressId = null;
          this.#clearAlert();
        },
        { signal }
      );
    }

    this.addEventListener(
      'input',
      (event) => {
        const target = event.target;
        if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return;
        const field = target.dataset.field;
        if (!field || target.type === 'checkbox' || target.type === 'radio') return;

        if (field === 'phone') {
          if (this.#draft.countryCode === 'ID') {
            const normalized = normalizeIndonesianPhoneDigits(target.value);
            if (target.value !== normalized) target.value = normalized;
            this.#draft.phone = normalized;
          } else {
            this.#draft.phone = target.value;
          }
        } else if (field === 'postalCode') {
          if (this.#draft.countryCode === 'ID') {
            const digits = target.value.replace(/\D/g, '').slice(0, 5);
            if (target.value !== digits) target.value = digits;
            this.#draft.postalCode = digits;
          } else {
            this.#draft.postalCode = target.value.slice(0, 12);
          }
          this.#postalManuallyEdited = true;
          this.#togglePostalHint(false);
        } else if (field === 'intlCity') {
          this.#draft.cityName = target.value;
        } else if (field === 'intlProvince') {
          this.#draft.provinceName = target.value;
          this.#draft.provinceCode = target.value.trim().length === 2 ? target.value.trim().toUpperCase() : '';
        } else {
          this.#draft[field] = target.value;
        }

        this.#clearFieldError(field);
        this.#clearAlert();
      },
      { signal }
    );

    this.addEventListener(
      'change',
      (event) => {
        const target = event.target;

        if (target instanceof HTMLInputElement && target.dataset.field === 'deliveryMethod') {
          this.#draft.deliveryMethod = target.value;
          return;
        }

        if (target instanceof HTMLInputElement && target.dataset.field === 'isDefault') {
          this.#draft.isDefault = target.checked;
          return;
        }

        if (!(target instanceof HTMLSelectElement)) return;
        const field = target.dataset.field;
        if (!field) return;

        this.#clearFieldError(field);
        this.#clearAlert();

        if (field === 'countryCode') {
          const code = target.value || 'ID';
          this.#draft.countryCode = code;
          this.#draft.country = resolveCountryName(code);
          this.#syncCountryFieldUI();
          if (code === 'ID') {
            void this.#initializeRegionSelects(false);
          }
          return;
        }

        const selectedOption = target.options[target.selectedIndex];
        const selectedId = target.value;
        const selectedName = selectedId && selectedOption ? selectedOption.textContent?.trim() || '' : '';

        if (field === 'province') {
          this.#draft.provinceId = selectedId;
          this.#draft.provinceName = selectedName;
          this.#draft.provinceCode = resolveProvinceCode(selectedId, selectedName, '', 'ID');
          this.#resetLowerRegions('city');
          if (selectedId) void this.#loadCities(selectedId);
        } else if (field === 'city') {
          this.#draft.cityId = selectedId;
          this.#draft.cityName = selectedName;
          this.#resetLowerRegions('district');
          if (selectedId) void this.#loadDistricts(selectedId);
        } else if (field === 'district') {
          this.#draft.districtId = selectedId;
          this.#draft.districtName = selectedName;
          this.#resetLowerRegions('subdistrict');
          if (selectedId) void this.#loadSubdistricts(selectedId);
        } else if (field === 'subdistrict') {
          this.#draft.subdistrictId = selectedId;
          this.#draft.subdistrictName = selectedName;
          this.#draft.subdistrictLine = buildAddress2Line(
            this.#draft.apartment,
            this.#draft.districtName,
            selectedName
          );
          this.#autoFillPostalCodeFromVillage(selectedId);
        }
      },
      { signal }
    );

    this.addEventListener(
      'blur',
      (event) => {
        const target = event.target;
        if (
          target instanceof HTMLInputElement ||
          target instanceof HTMLSelectElement ||
          target instanceof HTMLTextAreaElement
        ) {
          const field = target.dataset.field;
          if (
            field &&
            !['deliveryMethod', 'noteCouriers', 'label', 'isDefault', 'apartment', 'countryCode'].includes(field)
          ) {
            this.#validateSingleField(field);
          }
        }
      },
      { signal, capture: true }
    );

    document.addEventListener(
      'shopify:section:load',
      () => {
        this.#syncCartEmptyVisibility();
        this.#syncCheckoutButtonState();
      },
      { signal }
    );

    document.addEventListener(
      'shopify:block:select',
      (event) => {
        const detail = /** @type {CustomEvent} */ (event).detail;
        if (detail?.blockId && this.closest(`[data-shopify-editor-block*="${detail.blockId}"]`)) {
          this.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      },
      { signal }
    );
  }

  /**
   * Hooks into Horizon's Cart Summary Checkout CTA (`#checkout` / `#cart-form`).
   * @param {AbortSignal} signal
   */
  #bindCartCheckoutHooks(signal) {
    document.addEventListener(
      'click',
      (event) => {
        const target = event.target instanceof Element ? event.target : null;
        if (!target) return;

        const checkoutBtn = target.closest(
          '#checkout, button[name="checkout"][form="cart-form"], .cart__checkout-button'
        );
        if (!(checkoutBtn instanceof HTMLButtonElement)) return;

        const parentCartSection = this.closest('.cart-page, .shopify-section');
        if (parentCartSection && !parentCartSection.contains(checkoutBtn)) return;

        const active = this.#getSelectedAddress();
        const ready = isAddressCheckoutReady(active);

        if (this.#requireBeforeCheckout && !ready) {
          event.preventDefault();
          event.stopPropagation();
          this.#dropdownOpen = true;
          this.#renderDropdownState();
          this.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }

        if (ready) {
          event.preventDefault();
          event.stopPropagation();
          void this.#launchAutoFilledCheckout(checkoutBtn);
        }
      },
      { signal, capture: true }
    );

    document.addEventListener(
      'submit',
      (event) => {
        const form = event.target;
        if (!(form instanceof HTMLFormElement) || form.id !== 'cart-form') return;

        const submitter = /** @type {SubmitEvent} */ (event).submitter;
        const isCheckoutSubmit =
          submitter instanceof HTMLButtonElement && submitter.name === 'checkout';
        if (!isCheckoutSubmit) return;

        const active = this.#getSelectedAddress();
        const ready = isAddressCheckoutReady(active);

        if (this.#requireBeforeCheckout && !ready) {
          event.preventDefault();
          this.#dropdownOpen = true;
          this.#renderDropdownState();
          this.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }

        if (ready) {
          event.preventDefault();
          void this.#launchAutoFilledCheckout(submitter);
        }
      },
      { signal, capture: true }
    );
  }

  #observeCartSectionChanges() {
    const cartSection = this.closest('.shopify-section') || this.closest('.cart-page');
    if (!cartSection) return;

    this.#cartObserver = new MutationObserver(() => {
      this.#syncCartEmptyVisibility();
      this.#syncCheckoutButtonState();
    });

    this.#cartObserver.observe(cartSection, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'disabled'],
    });
  }

  #syncCartEmptyVisibility() {
    const wrapper = this.closest('.exp-cart-form');
    if (!wrapper) return;

    const cartPage = this.closest('.cart-page');
    const isEmpty = Boolean(cartPage?.classList.contains('cart-page--empty'));

    if (!this.#isDesignMode) {
      wrapper.classList.toggle('exp-cart-form--hidden', isEmpty);
    }
  }

  /** @returns {HTMLButtonElement | null} */
  #findCartSummaryCheckoutButton() {
    const scope = this.closest('.shopify-section') || document;
    const btn = scope.querySelector(
      '.cart-page__summary #checkout, .cart-page__summary button[name="checkout"], #checkout[form="cart-form"]'
    );
    return btn instanceof HTMLButtonElement ? btn : null;
  }

  #syncCheckoutButtonState() {
    const checkoutBtn = this.#findCartSummaryCheckoutButton();
    if (!checkoutBtn) return;

    const cartPage = this.closest('.cart-page');
    const isCartEmpty = Boolean(cartPage?.classList.contains('cart-page--empty'));
    const hasReadyAddress = isAddressCheckoutReady(this.#getSelectedAddress());
    const shouldLock = !isCartEmpty && this.#requireBeforeCheckout && !hasReadyAddress;

    if (shouldLock) {
      if (!checkoutBtn.disabled) checkoutBtn.disabled = true;
      checkoutBtn.setAttribute('aria-disabled', 'true');
      checkoutBtn.dataset.expLockedByForm = 'true';
      this.#ensureLockNotice(checkoutBtn, true);
    } else if (checkoutBtn.dataset.expLockedByForm === 'true') {
      if (!isCartEmpty && !this.#isSubmittingCheckout) checkoutBtn.disabled = false;
      checkoutBtn.removeAttribute('aria-disabled');
      delete checkoutBtn.dataset.expLockedByForm;
      this.#ensureLockNotice(checkoutBtn, false);
    }
  }

  /**
   * @param {HTMLButtonElement} checkoutBtn
   * @param {boolean} show
   */
  #ensureLockNotice(checkoutBtn, show) {
    const ctas = checkoutBtn.closest('.cart__ctas');
    if (!ctas) return;

    const existing = ctas.querySelector('.exp-cart-form__checkout-lock-note');
    if (show) {
      const text =
        this.dataset.checkoutLockedText ||
        'Select or add a shipping address to unlock checkout.';
      if (existing) {
        if (existing.textContent !== text) existing.textContent = text;
      } else {
        const note = document.createElement('p');
        note.className = 'exp-cart-form__checkout-lock-note';
        note.textContent = text;
        ctas.appendChild(note);
      }
    } else if (existing) {
      existing.remove();
    }
  }

  /* =========================
   * Google Maps Current Location & Preview
   * ========================= */

  /**
   * Triggered from the Dropdown Address Book "Use Current Location" button:
   * gets GPS coordinates, reverse geocodes into a new address draft, opens the modal
   * directly on Step 2 with Google Maps preview visible (or Step 1 if recipient name/email missing).
   * @param {HTMLElement} triggerBtn
   */
  async #handleCreateFromCurrentLocation(triggerBtn) {
    if (this.#isDetectingLocation) return;

    this.#isDetectingLocation = true;
    this.#setButtonLoading(triggerBtn, true);

    try {
      const coords = await this.#requestBrowserLocation();
      const geo = await this.#reverseGeocode(coords.lat, coords.lng);

      await this.#openFormModal('create', null, {
        prefillLocation: geo,
        openOnStep2IfContactFilled: true,
      });

      this.#announce('Current location detected and loaded onto Google Maps.');
    } catch (error) {
      this.#syncBannerMessage = this.#describeGeolocationError(error);
      this.#renderSyncBanner();
      this.#dropdownOpen = true;
      this.#renderDropdownState();
    } finally {
      this.#isDetectingLocation = false;
      this.#setButtonLoading(triggerBtn, false);
    }
  }

  /**
   * Triggered from inside Modal Step 2 "Use Current Location" button.
   * @param {HTMLElement} triggerBtn
   */
  async #detectLocationIntoForm(triggerBtn) {
    if (this.#isDetectingLocation) return;

    this.#isDetectingLocation = true;
    this.#setButtonLoading(triggerBtn, true);
    this.#clearAlert();

    try {
      const coords = await this.#requestBrowserLocation();
      const geo = await this.#reverseGeocode(coords.lat, coords.lng);
      await this.#applyGeocodedLocationToDraft(geo);
      this.#announce('Location detected and address fields updated.');
    } catch (error) {
      this.#showAlert(this.#describeGeolocationError(error));
    } finally {
      this.#isDetectingLocation = false;
      this.#setButtonLoading(triggerBtn, false);
    }
  }

  /**
   * Previews the manually entered address in Google Maps inside the modal form.
   */
  #previewManualAddressOnMap() {
    const query = this.#formatOneLineAddress(this.#draft);
    if (!query) {
      this.#showAlert('Enter an address or select a region first to preview it on Google Maps.');
      return;
    }
    this.#clearAlert();
    this.#renderMapCard('form', {
      lat: null,
      lng: null,
      query,
    });
  }

  /** @returns {Promise<{ lat: number, lng: number }>} */
  #requestBrowserLocation() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('UNSUPPORTED'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
        },
        (err) => reject(err),
        {
          enableHighAccuracy: true,
          timeout: GEOCODE_TIMEOUT_MS,
          maximumAge: 30000,
        }
      );
    });
  }

  /**
   * Reverse geocodes coordinates using Google Maps Geocoding API (when API key is provided)
   * or falls back seamlessly to OpenStreetMap Nominatim (no key required).
   * @param {number} lat
   * @param {number} lng
   * @returns {Promise<Record<string, any>>}
   */
  async #reverseGeocode(lat, lng) {
    const googleKey = (this.dataset.googleMapsKey || '').trim();

    if (googleKey) {
      try {
        const controller = new AbortController();
        const timer = window.setTimeout(() => controller.abort(), GEOCODE_TIMEOUT_MS);
        const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${encodeURIComponent(`${lat},${lng}`)}&language=id&key=${encodeURIComponent(googleKey)}`;
        const res = await fetch(url, { signal: controller.signal });
        window.clearTimeout(timer);
        if (res.ok) {
          const data = await res.json();
          const parsed = parseGoogleGeocodeResult(data, lat, lng);
          if (parsed) return parsed;
        }
      } catch {
        // Fall through to Nominatim
      }
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), GEOCODE_TIMEOUT_MS);
    try {
      const nomUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(String(lat))}&lon=${encodeURIComponent(String(lng))}&addressdetails=1&accept-language=id`;
      const res = await fetch(nomUrl, {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`GEOCODE_HTTP_${res.status}`);
      const data = await res.json();
      return parseNominatimResult(data, lat, lng);
    } finally {
      window.clearTimeout(timer);
    }
  }

  /** @param {Record<string, any>} geo */
  async #applyGeocodedLocationToDraft(geo) {
    this.#draft.countryCode = geo.countryCode || 'ID';
    this.#draft.country = geo.country || resolveCountryName(this.#draft.countryCode);
    this.#draft.lat = geo.lat;
    this.#draft.lng = geo.lng;

    if (geo.detailAddress) this.#draft.detailAddress = geo.detailAddress;
    if (geo.postalCode) {
      this.#draft.postalCode =
        this.#draft.countryCode === 'ID'
          ? geo.postalCode.replace(/\D/g, '').slice(0, 5)
          : geo.postalCode;
    }

    this.#draft.provinceName = geo.provinceName || '';
    this.#draft.provinceCode = geo.provinceCode || '';
    this.#draft.provinceId =
      this.#draft.countryCode === 'ID'
        ? resolveEmsifaProvinceId(geo.provinceCode, geo.provinceName)
        : '';
    this.#draft.cityId = '';
    this.#draft.cityName = geo.cityName || '';
    this.#draft.districtId = '';
    this.#draft.districtName = geo.districtName || '';
    this.#draft.subdistrictId = '';
    this.#draft.subdistrictName = geo.subdistrictName || '';

    this.#applyDraftToInputs();
    this.#syncCountryFieldUI();
    this.#renderMapCard('form', {
      lat: geo.lat,
      lng: geo.lng,
      query: this.#formatOneLineAddress(this.#draft),
    });

    if (this.#draft.countryCode === 'ID') {
      await this.#initializeRegionSelects(false);
    }

    if (this.#draft.postalCode) {
      this.#togglePostalHint(true);
    }
  }

  /**
   * @param {'form' | 'view'} target
   * @param {{ lat?: number | null, lng?: number | null, query?: string }} data
   */
  #renderMapCard(target, data) {
    const card = this.querySelector(`[data-${target}-map-card]`);
    const iframe = this.querySelector(`[data-${target}-map-iframe]`);
    const coordsEl = this.querySelector(`[data-${target}-map-coords]`);
    const linkEl = this.querySelector(`[data-${target}-map-link]`);

    if (!(card instanceof HTMLElement) || !(iframe instanceof HTMLIFrameElement)) return;

    const preview = buildGoogleMapsPreview(data);
    if (!preview) {
      card.hidden = true;
      iframe.removeAttribute('src');
      return;
    }

    iframe.src = preview.embedUrl;
    if (coordsEl) coordsEl.textContent = preview.label;
    if (linkEl instanceof HTMLAnchorElement) linkEl.href = preview.openUrl;
    card.hidden = false;
  }

  /**
   * @param {any} error
   * @returns {string}
   */
  #describeGeolocationError(error) {
    if (error?.message === 'UNSUPPORTED') {
      return 'Your browser does not support location detection. Please enter your address manually.';
    }
    if (error?.code === 1) {
      return 'Location permission was denied. Allow location access in your browser settings, or enter your address manually.';
    }
    if (error?.code === 2) {
      return 'Unable to determine your current location right now. Check GPS/network and try again.';
    }
    if (error?.code === 3) {
      return 'Location detection timed out. Please try again or enter your address manually.';
    }
    return 'Could not resolve your current location. Please try again or enter your address manually.';
  }

  /* =========================
   * Rendering (Trigger + Dropdown List)
   * ========================= */

  #renderAll() {
    this.#renderTrigger();
    this.#renderDropdownState();
    this.#renderAddressList();
    this.#renderSyncBanner();
  }

  #toggleDropdown() {
    this.#dropdownOpen = !this.#dropdownOpen;
    this.#confirmDeleteId = null;
    this.#renderDropdownState();
    if (this.#dropdownOpen) this.#renderAddressList();
  }

  #renderDropdownState() {
    this.dataset.dropdownOpen = String(this.#dropdownOpen);
    const trigger = this.querySelector('[data-action="toggle-dropdown"]');
    const panel = this.querySelector('[data-dropdown-panel]');
    if (trigger) trigger.setAttribute('aria-expanded', String(this.#dropdownOpen));
    if (panel instanceof HTMLElement) panel.hidden = !this.#dropdownOpen;
  }

  #renderSyncBanner() {
    const banner = this.querySelector('[data-sync-banner]');
    if (!(banner instanceof HTMLElement)) return;
    if (!this.#syncBannerMessage) {
      banner.hidden = true;
      banner.textContent = '';
      return;
    }
    banner.hidden = false;
    banner.textContent = this.#syncBannerMessage;
  }

  /** @param {string} deliveryMethod */
  #getDeliveryLabel(deliveryMethod) {
    return deliveryMethod === 'instant'
      ? this.dataset.instantLabel || 'Instant'
      : this.dataset.expressLabel || 'Express';
  }

  #renderTrigger() {
    const titleEl = this.querySelector('[data-trigger-title]');
    const badgesEl = this.querySelector('[data-trigger-badges]');
    const subtitleEl = this.querySelector('[data-trigger-subtitle]');
    const ctaEl = this.querySelector('[data-trigger-cta]');

    const active = this.#getSelectedAddress();

    if (!active) {
      if (titleEl) titleEl.textContent = this.dataset.triggerHeading || 'Shipping Address';
      if (badgesEl) badgesEl.innerHTML = '';
      if (subtitleEl) {
        subtitleEl.textContent =
          this.dataset.triggerEmptyText || 'Add an address to pre-fill checkout automatically';
      }
      if (ctaEl) ctaEl.textContent = this.dataset.addLabel || 'Add Address';
      return;
    }

    const fullName = `${active.firstName || ''} ${active.lastName || ''}`.trim() || 'Recipient';
    if (titleEl) titleEl.textContent = fullName;

    if (badgesEl) {
      badgesEl.innerHTML = '';
      if (active.label) badgesEl.appendChild(this.#createBadge(active.label, false));
      badgesEl.appendChild(this.#createBadge(this.#getDeliveryLabel(active.deliveryMethod), true));
      if (active.isDefault) badgesEl.appendChild(this.#createBadge('Default', false));
    }

    if (subtitleEl) subtitleEl.textContent = this.#formatOneLineAddress(active);
    if (ctaEl) ctaEl.textContent = this.dataset.changeLabel || 'Change';
  }

  /**
   * @param {string} text
   * @param {boolean} isPrimary
   * @returns {HTMLSpanElement}
   */
  #createBadge(text, isPrimary) {
    const span = document.createElement('span');
    span.className = isPrimary
      ? 'exp-cart-form__badge exp-cart-form__badge--primary'
      : 'exp-cart-form__badge';
    span.textContent = text;
    return span;
  }

  /**
   * @param {Record<string, any>} addr
   * @returns {string}
   */
  #formatOneLineAddress(addr) {
    const subLine = buildAddress2Line(
      addr.apartment,
      addr.districtName,
      addr.subdistrictName,
      addr.subdistrictLine
    );
    const provDisplay =
      addr.provinceName ||
      (addr.countryCode === 'ID' ? ISO_TO_SHOPIFY_PROVINCE_NAME[addr.provinceCode] : '') ||
      addr.provinceCode;
    return [
      addr.detailAddress,
      subLine,
      addr.cityName,
      provDisplay,
      addr.postalCode,
      addr.countryCode && addr.countryCode !== 'ID' ? resolveCountryName(addr.countryCode, addr.country) : '',
    ]
      .filter(Boolean)
      .join(', ');
  }

  #renderAddressList() {
    const emptyEl = this.querySelector('[data-empty-state]');
    const listWrapEl = this.querySelector('[data-list-wrap]');
    const listEl = this.querySelector('[data-address-list]');

    const hasItems = this.#addresses.length > 0;
    if (emptyEl instanceof HTMLElement) emptyEl.hidden = hasItems;
    if (listWrapEl instanceof HTMLElement) listWrapEl.hidden = !hasItems;
    if (!(listEl instanceof HTMLElement)) return;

    listEl.innerHTML = '';
    if (!hasItems) return;

    const fragment = document.createDocumentFragment();

    for (const addr of this.#addresses) {
      const isSelected = addr.id === this.#selectedAddressId;
      const isConfirmingDelete = addr.id === this.#confirmDeleteId;

      const card = document.createElement('div');
      card.className = isSelected
        ? 'exp-cart-form__address-item exp-cart-form__address-item--selected'
        : 'exp-cart-form__address-item';

      const selectBtn = document.createElement('button');
      selectBtn.type = 'button';
      selectBtn.className = 'exp-cart-form__address-select-btn';
      selectBtn.dataset.action = 'select-address';
      selectBtn.dataset.addressId = addr.id;
      selectBtn.setAttribute('role', 'radio');
      selectBtn.setAttribute('aria-checked', String(isSelected));

      const dot = document.createElement('span');
      dot.className = 'exp-cart-form__radio-dot';
      dot.setAttribute('aria-hidden', 'true');

      const content = document.createElement('span');
      content.className = 'exp-cart-form__address-content';

      const head = document.createElement('span');
      head.className = 'exp-cart-form__address-head';

      const nameEl = document.createElement('span');
      nameEl.className = 'exp-cart-form__address-name';
      nameEl.textContent = `${addr.firstName || ''} ${addr.lastName || ''}`.trim() || 'Recipient';
      head.appendChild(nameEl);

      if (addr.label) head.appendChild(this.#createBadge(addr.label, false));
      head.appendChild(this.#createBadge(this.#getDeliveryLabel(addr.deliveryMethod), isSelected));
      if (addr.isDefault) head.appendChild(this.#createBadge('Default', false));
      if (addr.source === 'account') head.appendChild(this.#createBadge('Account', false));

      const meta = document.createElement('p');
      meta.className = 'exp-cart-form__address-meta';
      const phone = formatPhoneForCheckout(addr.phone, addr.countryCode || 'ID');
      meta.textContent = [phone, addr.email].filter(Boolean).join(' / ');

      const lines = document.createElement('p');
      lines.className = 'exp-cart-form__address-lines';
      lines.textContent = this.#formatOneLineAddress(addr);

      content.appendChild(head);
      if (meta.textContent) content.appendChild(meta);
      content.appendChild(lines);

      selectBtn.appendChild(dot);
      selectBtn.appendChild(content);
      card.appendChild(selectBtn);

      const actionsBar = document.createElement('div');
      actionsBar.className = 'exp-cart-form__item-actions';

      if (isConfirmingDelete) {
        const prompt = document.createElement('span');
        prompt.className = 'exp-cart-form__delete-confirm-text';
        prompt.textContent = 'Delete this address?';

        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'exp-cart-form__crud-btn';
        cancelBtn.dataset.action = 'cancel-delete';
        cancelBtn.textContent = 'Cancel';

        const confirmBtn = document.createElement('button');
        confirmBtn.type = 'button';
        confirmBtn.className = 'exp-cart-form__crud-btn exp-cart-form__crud-btn--danger-solid';
        confirmBtn.dataset.action = 'confirm-delete';
        confirmBtn.dataset.addressId = addr.id;
        confirmBtn.textContent = 'Confirm Delete';

        actionsBar.append(prompt, cancelBtn, confirmBtn);
      } else {
        actionsBar.append(
          this.#createCrudButton('View', 'open-view', addr.id, 'eye', false),
          this.#createCrudButton('Edit', 'open-edit', addr.id, 'pencil', false),
          this.#createCrudButton('Delete', 'request-delete', addr.id, 'trash', true)
        );
      }

      card.appendChild(actionsBar);
      fragment.appendChild(card);
    }

    listEl.appendChild(fragment);
  }

  /**
   * @param {string} label
   * @param {string} action
   * @param {string} addressId
   * @param {'eye' | 'pencil' | 'trash'} iconName
   * @param {boolean} isDanger
   * @returns {HTMLButtonElement}
   */
  #createCrudButton(label, action, addressId, iconName, isDanger) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = isDanger
      ? 'exp-cart-form__crud-btn exp-cart-form__crud-btn--danger'
      : 'exp-cart-form__crud-btn';
    btn.dataset.action = action;
    btn.dataset.addressId = addressId;

    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '0 0 16 16');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');

    if (iconName === 'eye') {
      const p1 = document.createElementNS(svgNS, 'path');
      p1.setAttribute('d', 'M1.5 8s2.5-4.25 6.5-4.25S14.5 8 14.5 8s-2.5 4.25-6.5 4.25S1.5 8 1.5 8Z');
      p1.setAttribute('stroke', 'currentColor');
      p1.setAttribute('stroke-width', '1.4');
      const c1 = document.createElementNS(svgNS, 'circle');
      c1.setAttribute('cx', '8');
      c1.setAttribute('cy', '8');
      c1.setAttribute('r', '1.75');
      c1.setAttribute('stroke', 'currentColor');
      c1.setAttribute('stroke-width', '1.4');
      svg.append(p1, c1);
    } else if (iconName === 'pencil') {
      const p1 = document.createElementNS(svgNS, 'path');
      p1.setAttribute('d', 'M11.2 2.4a1.6 1.6 0 0 1 2.26 2.26L5.5 12.6 2.5 13.5l.9-3L11.2 2.4Z');
      p1.setAttribute('stroke', 'currentColor');
      p1.setAttribute('stroke-width', '1.4');
      p1.setAttribute('stroke-linejoin', 'round');
      svg.append(p1);
    } else {
      const p1 = document.createElementNS(svgNS, 'path');
      p1.setAttribute('d', 'M2.75 4.25h10.5M6 4.25V3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.25M4.5 4.25l.6 8.5a1.2 1.2 0 0 0 1.2 1.1h3.4a1.2 1.2 0 0 0 1.2-1.1l.6-8.5');
      p1.setAttribute('stroke', 'currentColor');
      p1.setAttribute('stroke-width', '1.4');
      p1.setAttribute('stroke-linecap', 'round');
      p1.setAttribute('stroke-linejoin', 'round');
      svg.append(p1);
    }

    const span = document.createElement('span');
    span.textContent = label;
    btn.append(svg, span);
    return btn;
  }

  /* =========================
   * CRUD Operations
   * ========================= */

  /** @param {string} addressId */
  #selectAddress(addressId) {
    const addr = this.#findAddressById(addressId);
    if (!addr) return;

    this.#selectedAddressId = addr.id;
    this.#confirmDeleteId = null;
    this.#saveAddressBookState();
    this.#renderTrigger();
    this.#renderAddressList();
    this.#syncCheckoutButtonState();

    if (!this.#isDesignMode) {
      void this.#syncCartAttributes(addr).catch(() => {});
    }
    this.#announce(`Selected shipping address for ${addr.firstName} ${addr.lastName}`);
  }

  /** @param {string} addressId */
  #openViewModal(addressId) {
    const addr = this.#findAddressById(addressId);
    if (!addr) return;

    this.#modalMode = 'view';
    this.#viewingAddressId = addr.id;
    this.#clearAlert();

    const titleEl = this.querySelector('[data-modal-title]');
    const viewPanel = this.querySelector('[data-modal-view]');
    const formPanel = this.querySelector('[data-modal-form]');
    if (titleEl) titleEl.textContent = 'Address Details';
    if (viewPanel instanceof HTMLElement) viewPanel.hidden = false;
    if (formPanel instanceof HTMLElement) formPanel.hidden = true;

    const badgesEl = this.querySelector('[data-view-badges]');
    if (badgesEl) {
      badgesEl.innerHTML = '';
      if (addr.label) badgesEl.appendChild(this.#createBadge(addr.label, false));
      badgesEl.appendChild(this.#createBadge(this.#getDeliveryLabel(addr.deliveryMethod), true));
      if (addr.isDefault) badgesEl.appendChild(this.#createBadge('Default', false));
      badgesEl.appendChild(
        this.#createBadge(addr.source === 'account' ? 'Shopify Account' : 'Saved on Device', false)
      );
    }

    const setText = (selector, value) => {
      const el = this.querySelector(selector);
      if (el) el.textContent = value || '-';
    };

    const countryCode = resolveCountryCode(addr.countryCode, addr.country);
    setText('[data-view-delivery]', this.#getDeliveryLabel(addr.deliveryMethod));
    setText('[data-view-country]', resolveCountryName(countryCode, addr.country));
    setText('[data-view-recipient]', `${addr.firstName || ''} ${addr.lastName || ''}`.trim());
    setText('[data-view-email]', addr.email);
    setText('[data-view-phone]', formatPhoneForCheckout(addr.phone, countryCode) || 'Not provided');
    setText('[data-view-address1]', addr.detailAddress);

    const subLine = buildAddress2Line(
      addr.apartment,
      addr.districtName,
      addr.subdistrictName,
      addr.subdistrictLine
    );
    const subRow = this.querySelector('[data-view-subdistrict-row]');
    if (subRow instanceof HTMLElement) subRow.hidden = !subLine;
    setText('[data-view-subdistrict]', subLine);

    const provDisplay =
      addr.provinceName ||
      (countryCode === 'ID' ? ISO_TO_SHOPIFY_PROVINCE_NAME[addr.provinceCode] : '') ||
      addr.provinceCode;
    setText('[data-view-region]', [addr.cityName, provDisplay].filter(Boolean).join(', '));
    setText('[data-view-postal]', addr.postalCode);

    const noteRow = this.querySelector('[data-view-note-row]');
    if (noteRow instanceof HTMLElement) noteRow.hidden = !addr.noteCouriers;
    setText('[data-view-note]', addr.noteCouriers);

    this.#renderMapCard('view', {
      lat: typeof addr.lat === 'number' ? addr.lat : null,
      lng: typeof addr.lng === 'number' ? addr.lng : null,
      query: this.#formatOneLineAddress(addr),
    });

    this.#showDialog('[data-modal-title]');
  }

  /**
   * @param {'create' | 'edit'} mode
   * @param {string | null} addressId
   * @param {{ prefillLocation?: Record<string, any>, openOnStep2IfContactFilled?: boolean }} [options]
   */
  async #openFormModal(mode, addressId, options = {}) {
    this.#modalMode = mode;
    this.#editingAddressId = mode === 'edit' ? addressId : null;
    this.#formStep = 1;
    this.#postalManuallyEdited = false;
    this.#clearAllErrors();
    this.#clearAlert();

    const existing = mode === 'edit' && addressId ? this.#findAddressById(addressId) : null;

    if (existing) {
      const countryCode = resolveCountryCode(existing.countryCode, existing.country);
      const parsedSub = parseAddress2Line(existing.subdistrictLine || '');
      this.#draft = {
        label: existing.label || '',
        deliveryMethod:
          existing.deliveryMethod === 'instant' && this.dataset.instantEnabled !== 'false'
            ? 'instant'
            : 'express',
        countryCode,
        country: resolveCountryName(countryCode, existing.country),
        firstName: existing.firstName || '',
        lastName: existing.lastName || '',
        email: existing.email || this.#customerContext.email || '',
        phone:
          countryCode === 'ID'
            ? normalizeIndonesianPhoneDigits(existing.phone || '')
            : String(existing.phone || '').trim(),
        provinceId:
          existing.provinceId ||
          (countryCode === 'ID'
            ? resolveEmsifaProvinceId(existing.provinceCode, existing.provinceName)
            : ''),
        provinceName: existing.provinceName || '',
        provinceCode:
          existing.provinceCode ||
          resolveProvinceCode(existing.provinceId, existing.provinceName, '', countryCode),
        cityId: existing.cityId || '',
        cityName: existing.cityName || '',
        districtId: existing.districtId || '',
        districtName: existing.districtName || parsedSub.district || '',
        subdistrictId: existing.subdistrictId || '',
        subdistrictName: existing.subdistrictName || parsedSub.subdistrict || '',
        apartment: existing.apartment || parsedSub.apartment || '',
        subdistrictLine: existing.subdistrictLine || '',
        postalCode: existing.postalCode || '',
        detailAddress: existing.detailAddress || '',
        noteCouriers: existing.noteCouriers || '',
        lat: typeof existing.lat === 'number' ? existing.lat : null,
        lng: typeof existing.lng === 'number' ? existing.lng : null,
        isDefault: Boolean(existing.isDefault),
      };
    } else {
      this.#draft = this.#createEmptyDraft();
    }

    if (options.prefillLocation) {
      const geo = options.prefillLocation;
      this.#draft.countryCode = geo.countryCode || 'ID';
      this.#draft.country = geo.country || resolveCountryName(this.#draft.countryCode);
      this.#draft.detailAddress = geo.detailAddress || '';
      this.#draft.provinceName = geo.provinceName || '';
      this.#draft.provinceCode = geo.provinceCode || '';
      this.#draft.provinceId =
        this.#draft.countryCode === 'ID'
          ? resolveEmsifaProvinceId(geo.provinceCode, geo.provinceName)
          : '';
      this.#draft.cityName = geo.cityName || '';
      this.#draft.districtName = geo.districtName || '';
      this.#draft.subdistrictName = geo.subdistrictName || '';
      this.#draft.postalCode = geo.postalCode || '';
      this.#draft.lat = geo.lat;
      this.#draft.lng = geo.lng;

      const hasContact =
        Boolean(this.#draft.firstName.trim()) &&
        Boolean(this.#draft.lastName.trim()) &&
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.#draft.email.trim());

      if (options.openOnStep2IfContactFilled && hasContact) {
        this.#formStep = 2;
      }
    }

    const titleEl = this.querySelector('[data-modal-title]');
    const viewPanel = this.querySelector('[data-modal-view]');
    const formPanel = this.querySelector('[data-modal-form]');
    const saveLabel = this.querySelector('[data-save-btn-label]');
    const saveBtn = this.querySelector('[data-action="save-address"]');

    if (titleEl) {
      titleEl.textContent = mode === 'edit' ? 'Edit Shipping Address' : 'Add Shipping Address';
    }
    if (saveLabel) {
      saveLabel.textContent =
        mode === 'edit'
          ? 'Update Address'
          : (saveBtn instanceof HTMLElement ? saveBtn.dataset.defaultLabel : '') || 'Save Address';
    }
    if (viewPanel instanceof HTMLElement) viewPanel.hidden = true;
    if (formPanel instanceof HTMLElement) formPanel.hidden = false;

    this.#applyDraftToInputs();
    this.#syncCountryFieldUI();
    this.#renderFormStep();

    this.#renderMapCard('form', {
      lat: typeof this.#draft.lat === 'number' ? this.#draft.lat : null,
      lng: typeof this.#draft.lng === 'number' ? this.#draft.lng : null,
      query: this.#draft.detailAddress ? this.#formatOneLineAddress(this.#draft) : '',
    });

    this.#showDialog(this.#formStep === 2 ? '[data-field="detailAddress"]' : '[data-field="firstName"]');

    if (this.#draft.countryCode === 'ID') {
      await this.#initializeRegionSelects(false);
    }
  }

  /** @param {string} [focusSelector] */
  #showDialog(focusSelector) {
    const dialog = this.querySelector('[data-modal-dialog]');
    if (dialog instanceof HTMLDialogElement && !dialog.open) {
      dialog.showModal();
      const target = focusSelector ? dialog.querySelector(focusSelector) : null;
      if (target instanceof HTMLElement) {
        target.focus({ preventScroll: true });
      }
    }
  }

  #closeModal() {
    const dialog = this.querySelector('[data-modal-dialog]');
    if (dialog instanceof HTMLDialogElement && dialog.open) {
      dialog.close();
    }
  }

  #syncCountryFieldUI() {
    const isID = this.#draft.countryCode === 'ID';
    const idFields = this.querySelectorAll('[data-region-mode="ID"]');
    const intlFields = this.querySelectorAll('[data-region-mode="INTL"]');

    for (const el of idFields) {
      if (el instanceof HTMLElement) el.hidden = !isID;
    }
    for (const el of intlFields) {
      if (el instanceof HTMLElement) el.hidden = isID;
    }

    const prefix = this.querySelector('[data-phone-prefix]');
    const flag = this.querySelector('[data-phone-flag]');
    const phoneInput = this.#getField('phone');
    if (prefix instanceof HTMLElement) prefix.hidden = !isID;
    if (flag instanceof HTMLElement) flag.hidden = !isID;
    if (phoneInput instanceof HTMLInputElement) {
      phoneInput.placeholder = isID ? '81234567890' : '+1 555 123 4567';
    }
  }

  #applyDraftToInputs() {
    const radios = this.querySelectorAll('input[data-field="deliveryMethod"]');
    for (const radio of radios) {
      if (radio instanceof HTMLInputElement) {
        radio.checked = radio.value === this.#draft.deliveryMethod;
      }
    }

    const countrySelect = this.#getField('countryCode');
    if (countrySelect instanceof HTMLSelectElement) {
      if (!Array.from(countrySelect.options).some((o) => o.value === this.#draft.countryCode)) {
        const opt = document.createElement('option');
        opt.value = this.#draft.countryCode;
        opt.textContent = resolveCountryName(this.#draft.countryCode, this.#draft.country);
        countrySelect.appendChild(opt);
      }
      countrySelect.value = this.#draft.countryCode;
    }

    const textMap = {
      label: this.#draft.label,
      firstName: this.#draft.firstName,
      lastName: this.#draft.lastName,
      email: this.#draft.email,
      phone: this.#draft.phone,
      apartment: this.#draft.apartment,
      postalCode: this.#draft.postalCode,
      detailAddress: this.#draft.detailAddress,
      noteCouriers: this.#draft.noteCouriers,
      intlCity: this.#draft.cityName,
      intlProvince: this.#draft.provinceName || this.#draft.provinceCode,
    };

    for (const [field, val] of Object.entries(textMap)) {
      const el = this.#getField(field);
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        el.value = val || '';
      }
    }

    const defaultCheckbox = this.#getField('isDefault');
    if (defaultCheckbox instanceof HTMLInputElement) {
      defaultCheckbox.checked = Boolean(this.#draft.isDefault);
    }

    this.#togglePostalHint(false);
  }

  async #handleSaveAddress() {
    if (this.#isSaving) return;

    if (!this.#validateStep1(false)) {
      this.#goToStep(1);
      this.#validateStep1(true);
      return;
    }
    if (!this.#validateStep2(true)) return;

    const saveBtn = this.querySelector('[data-action="save-address"]');
    this.#isSaving = true;
    this.#setButtonLoading(saveBtn, true);
    this.#clearAlert();

    try {
      const isEdit = this.#modalMode === 'edit' && Boolean(this.#editingAddressId);
      const existing = isEdit && this.#editingAddressId ? this.#findAddressById(this.#editingAddressId) : null;

      const countryCode = resolveCountryCode(this.#draft.countryCode, this.#draft.country);
      const provinceCode = resolveProvinceCode(
        this.#draft.provinceId,
        this.#draft.provinceName,
        this.#draft.provinceCode,
        countryCode
      );
      const subdistrictLine = buildAddress2Line(
        this.#draft.apartment,
        countryCode === 'ID' ? this.#draft.districtName : '',
        countryCode === 'ID' ? this.#draft.subdistrictName : '',
        this.#draft.subdistrictLine
      );

      /** @type {Record<string, any>} */
      const record = {
        id: existing ? existing.id : createLocalId(),
        shopifyId: existing?.shopifyId || null,
        source: existing?.source || 'local',
        label: this.#draft.label.trim(),
        deliveryMethod: this.#draft.deliveryMethod,
        countryCode,
        country: resolveCountryName(countryCode, this.#draft.country),
        firstName: this.#draft.firstName.trim(),
        lastName: this.#draft.lastName.trim(),
        email: this.#draft.email.trim(),
        phone:
          countryCode === 'ID'
            ? normalizeIndonesianPhoneDigits(this.#draft.phone)
            : String(this.#draft.phone || '').trim(),
        provinceId: countryCode === 'ID' ? this.#draft.provinceId : '',
        provinceName: this.#draft.provinceName.trim(),
        provinceCode,
        cityId: countryCode === 'ID' ? this.#draft.cityId : '',
        cityName: this.#draft.cityName.trim(),
        districtId: countryCode === 'ID' ? this.#draft.districtId : '',
        districtName: countryCode === 'ID' ? this.#draft.districtName.trim() : '',
        subdistrictId: countryCode === 'ID' ? this.#draft.subdistrictId : '',
        subdistrictName: countryCode === 'ID' ? this.#draft.subdistrictName.trim() : '',
        apartment: this.#draft.apartment.trim(),
        subdistrictLine,
        postalCode: this.#draft.postalCode.trim(),
        detailAddress: this.#draft.detailAddress.trim(),
        noteCouriers: this.#draft.noteCouriers.trim(),
        lat: typeof this.#draft.lat === 'number' ? this.#draft.lat : null,
        lng: typeof this.#draft.lng === 'number' ? this.#draft.lng : null,
        isDefault: Boolean(this.#draft.isDefault || this.#addresses.length === 0),
        updatedAt: Date.now(),
      };

      /** @type {Record<string, Record<string, any>>} */
      const extraOverrides = {};
      if (record.isDefault) {
        for (const item of this.#addresses) {
          if (item.id === record.id) continue;
          if (item.isDefault) {
            item.isDefault = false;
            if (item.source === 'account' && item.shopifyId) {
              extraOverrides[String(item.shopifyId)] = { ...item, isDefault: false };
            }
          }
        }
      }

      if (this.#customerContext.isLoggedIn && !this.#isDesignMode) {
        const accountSync = await this.#trySyncAddressToShopifyAccount(
          isEdit && record.shopifyId ? 'update' : 'create',
          record
        );
        if (accountSync === 'synced') {
          this.#syncBannerMessage = 'Synced directly with your Shopify account.';
        } else if (accountSync === 'new-account-isolated') {
          this.#syncBannerMessage =
            'Saved for this account on this device. To edit permanent Shopify New Customer Account addresses across devices, use the Shopify Account link above.';
        }
      }

      if (isEdit && existing) {
        const idx = this.#addresses.findIndex((a) => a.id === existing.id);
        if (idx >= 0) this.#addresses[idx] = record;
      } else {
        this.#addresses.unshift(record);
      }

      this.#addresses.sort((a, b) => Number(Boolean(b.isDefault)) - Number(Boolean(a.isDefault)));
      this.#selectedAddressId = record.id;

      this.#saveAddressBookState({
        ...(record.source === 'account' && record.shopifyId
          ? { overrideShopifyId: String(record.shopifyId), overrideData: record }
          : {}),
        extraOverrides,
      });

      if (!this.#isDesignMode) {
        try {
          await this.#syncCartAttributes(record);
        } catch {
          // Non-blocking
        }
      }

      this.#closeModal();
      this.#dropdownOpen = true;
      this.#renderAll();
      this.#syncCheckoutButtonState();
      this.#announce(isEdit ? 'Shipping address updated.' : 'New shipping address saved.');
    } finally {
      this.#isSaving = false;
      this.#setButtonLoading(saveBtn, false);
    }
  }

  /** @param {string} addressId */
  async #deleteAddress(addressId) {
    const target = this.#findAddressById(addressId);
    if (!target) return;

    if (this.#customerContext.isLoggedIn && target.shopifyId && !this.#isDesignMode) {
      const syncStatus = await this.#trySyncAddressToShopifyAccount('delete', target);
      if (syncStatus === 'synced') {
        this.#syncBannerMessage = 'Address removed from your Shopify account.';
      } else if (syncStatus === 'new-account-isolated') {
        this.#syncBannerMessage =
          'Hidden from this Cart address list. To delete permanently from New Customer Accounts, use the Shopify Account link above.';
      }
    }

    this.#addresses = this.#addresses.filter((a) => a.id !== addressId);
    this.#confirmDeleteId = null;

    if (this.#selectedAddressId === addressId) {
      const next = this.#addresses.find((a) => a.isDefault) || this.#addresses[0] || null;
      this.#selectedAddressId = next ? next.id : null;
    }

    this.#saveAddressBookState(
      target.shopifyId ? { deletedShopifyId: String(target.shopifyId) } : {}
    );

    this.#renderAll();
    this.#syncCheckoutButtonState();
    this.#announce('Address deleted.');
  }

  /**
   * Attempts to sync newly migrated pre-login guest addresses to Shopify Customer Accounts.
   * Falls back cleanly to customer-scoped browser storage on Shopify New Customer Accounts.
   * @param {Array<Record<string, any>>} addresses
   */
  async #syncMigratedGuestAddresses(addresses) {
    let syncedCount = 0;
    let isolated = false;

    for (const addr of addresses) {
      const status = await this.#trySyncAddressToShopifyAccount('create', addr);
      if (status === 'synced') {
        syncedCount += 1;
      } else if (status === 'new-account-isolated') {
        isolated = true;
        break;
      }
    }

    if (syncedCount > 0) {
      this.#syncBannerMessage =
        syncedCount === 1
          ? 'Your address saved before sign-in was carried over and synced with your Shopify account.'
          : `${syncedCount} addresses saved before sign-in were carried over and synced with your Shopify account.`;
    } else if (isolated) {
      const count = addresses.length;
      this.#syncBannerMessage =
        count === 1
          ? 'Your address saved before sign-in was carried over to your account on this device.'
          : `${count} addresses saved before sign-in were carried over to your account on this device.`;
    }

    this.#pendingGuestSyncAddresses = [];
    this.#renderSyncBanner();
    if (this.#syncBannerMessage) {
      this.#announce(this.#syncBannerMessage);
    }
  }

  /**
   * @param {'create' | 'update' | 'delete'} operation
   * @param {Record<string, any>} record
   * @returns {Promise<'synced' | 'new-account-isolated' | 'skipped'>}
   */
  async #trySyncAddressToShopifyAccount(operation, record) {
    const baseUrl = this.#customerContext.accountAddressesUrl || '/account/addresses';
    if (/^https?:\/\//i.test(baseUrl) && !baseUrl.startsWith(window.location.origin)) {
      return 'new-account-isolated';
    }

    const endpoint =
      operation === 'create'
        ? baseUrl
        : `${baseUrl.replace(/\/+$/, '')}/${encodeURIComponent(String(record.shopifyId))}`;

    const formData = new FormData();
    formData.append('form_type', 'customer_address');
    formData.append('utf8', '✓');

    if (operation === 'delete') {
      formData.append('_method', 'delete');
    } else {
      if (operation === 'update') formData.append('_method', 'put');
      const countryCode = resolveCountryCode(record.countryCode, record.country);
      const phone = formatPhoneForCheckout(record.phone, countryCode);
      formData.append('address[first_name]', record.firstName || '');
      formData.append('address[last_name]', record.lastName || '');
      formData.append('address[company]', record.label || '');
      formData.append('address[address1]', record.detailAddress || '');
      formData.append('address[address2]', record.subdistrictLine || '');
      formData.append('address[city]', record.cityName || '');
      formData.append('address[country]', resolveCountryName(countryCode, record.country));
      formData.append(
        'address[province]',
        countryCode === 'ID'
          ? ISO_TO_SHOPIFY_PROVINCE_NAME[record.provinceCode] || record.provinceName || ''
          : record.provinceName || record.provinceCode || ''
      );
      formData.append('address[zip]', record.postalCode || '');
      if (phone) formData.append('address[phone]', phone);
      if (record.isDefault) formData.append('address[default]', '1');
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
        credentials: 'same-origin',
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
        redirect: 'follow',
      });

      if (!response.ok || !response.url) {
        return 'new-account-isolated';
      }

      const finalUrl = new URL(response.url, window.location.origin);
      const sameOrigin = finalUrl.origin === window.location.origin;
      const landedOnAddresses = /\/account\/addresses(?:\/|$)/i.test(finalUrl.pathname);

      if (sameOrigin && landedOnAddresses) {
        return 'synced';
      }
      return 'new-account-isolated';
    } catch {
      return 'new-account-isolated';
    }
  }

  /* =========================
   * Stepper & Validation
   * ========================= */

  /** @param {number} targetStep */
  #handleStepClick(targetStep) {
    if (targetStep === 1) {
      this.#goToStep(1);
      return;
    }
    if (targetStep === 2 && this.#validateStep1(true)) {
      this.#goToStep(2);
    }
  }

  #handleNextStep() {
    if (!this.#validateStep1(true)) return;
    this.#goToStep(2);
    this.#announce('Step 2: Detail Address');
  }

  /** @param {number} step */
  #goToStep(step) {
    this.#formStep = step === 2 ? 2 : 1;
    this.#clearAlert();
    this.#renderFormStep();

    const activePanel = this.querySelector(`[data-step-panel="${this.#formStep}"]`);
    const firstControl = activePanel?.querySelector(
      'input:not([disabled]), select:not([disabled]), textarea:not([disabled])'
    );
    if (firstControl instanceof HTMLElement) {
      firstControl.focus({ preventScroll: true });
    }
  }

  #renderFormStep() {
    this.dataset.activeStep = String(this.#formStep);

    const step1Btn = this.querySelector('[data-step-trigger="1"]');
    const step2Btn = this.querySelector('[data-step-trigger="2"]');
    const panel1 = this.querySelector('[data-step-panel="1"]');
    const panel2 = this.querySelector('[data-step-panel="2"]');

    if (step1Btn) {
      step1Btn.classList.toggle('exp-cart-form__step-btn--active', this.#formStep === 1);
      step1Btn.classList.toggle('exp-cart-form__step-btn--done', this.#formStep === 2);
      if (this.#formStep === 1) step1Btn.setAttribute('aria-current', 'step');
      else step1Btn.removeAttribute('aria-current');
    }

    if (step2Btn) {
      step2Btn.classList.toggle('exp-cart-form__step-btn--active', this.#formStep === 2);
      step2Btn.classList.remove('exp-cart-form__step-btn--done');
      if (this.#formStep === 2) step2Btn.setAttribute('aria-current', 'step');
      else step2Btn.removeAttribute('aria-current');
    }

    if (panel1 instanceof HTMLElement) panel1.hidden = this.#formStep !== 1;
    if (panel2 instanceof HTMLElement) panel2.hidden = this.#formStep !== 2;
  }

  /**
   * @param {boolean} focusFirstError
   * @returns {boolean}
   */
  #validateStep1(focusFirstError) {
    const fields = ['firstName', 'lastName', 'email', 'phone'];
    let firstInvalid = null;

    for (const field of fields) {
      if (!this.#validateSingleField(field) && !firstInvalid) {
        firstInvalid = this.#getField(field);
      }
    }
    if (firstInvalid && focusFirstError) firstInvalid.focus();
    return !firstInvalid;
  }

  /**
   * @param {boolean} focusFirstError
   * @returns {boolean}
   */
  #validateStep2(focusFirstError) {
    const fields =
      this.#draft.countryCode === 'ID'
        ? ['detailAddress', 'province', 'city', 'district', 'subdistrict', 'postalCode']
        : ['detailAddress', 'intlCity', 'intlProvince', 'postalCode'];
    let firstInvalid = null;

    for (const field of fields) {
      if (!this.#validateSingleField(field) && !firstInvalid) {
        firstInvalid = this.#getField(field);
      }
    }
    if (firstInvalid && focusFirstError) firstInvalid.focus();
    return !firstInvalid;
  }

  /**
   * @param {string} field
   * @returns {boolean}
   */
  #validateSingleField(field) {
    let message = '';

    switch (field) {
      case 'firstName':
        if (!String(this.#draft.firstName || '').trim()) {
          message = 'Enter a first name.';
        }
        break;
      case 'lastName':
        if (!String(this.#draft.lastName || '').trim()) {
          message = 'Enter a last name.';
        }
        break;
      case 'email': {
        const val = String(this.#draft.email || '').trim();
        if (!val) {
          message = 'Enter an email address for order confirmation.';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
          message = 'Enter a valid email address (e.g. johndoe@gmail.com).';
        }
        break;
      }
      case 'phone': {
        // Optional (matches Shopify Checkout "Phone (optional)"), validate only if provided
        const raw = String(this.#draft.phone || '').trim();
        if (raw && this.#draft.countryCode === 'ID') {
          const digits = normalizeIndonesianPhoneDigits(raw);
          if (!/^[1-9]\d{7,13}$/.test(digits)) {
            message = 'Enter 8–14 digits after +62 (e.g. 81234567890), or leave blank.';
          }
        }
        break;
      }
      case 'province':
        if (this.#draft.countryCode === 'ID' && !this.#draft.provinceId) {
          message = 'Select a province.';
        }
        break;
      case 'city':
        if (this.#draft.countryCode === 'ID' && !this.#draft.cityId) {
          message = 'Select a city or regency.';
        }
        break;
      case 'district':
        if (this.#draft.countryCode === 'ID' && !this.#draft.districtId) {
          message = 'Select a district (Kecamatan).';
        }
        break;
      case 'subdistrict':
        if (this.#draft.countryCode === 'ID' && !this.#draft.subdistrictId) {
          message = 'Select a sub-district (Kelurahan/Desa).';
        }
        break;
      case 'intlCity':
        if (this.#draft.countryCode !== 'ID' && !String(this.#draft.cityName || '').trim()) {
          message = 'Enter a city.';
        }
        break;
      case 'intlProvince':
        if (this.#draft.countryCode !== 'ID' && !String(this.#draft.provinceName || '').trim()) {
          message = 'Enter a state or province.';
        }
        break;
      case 'postalCode': {
        const zip = String(this.#draft.postalCode || '').trim();
        if (!zip) {
          message = 'Enter a postal / ZIP code.';
        } else if (this.#draft.countryCode === 'ID' && !/^\d{5}$/.test(zip)) {
          message = 'Indonesian postal code must be exactly 5 digits (e.g. 10110).';
        }
        break;
      }
      case 'detailAddress': {
        const addr = String(this.#draft.detailAddress || '').trim();
        if (!addr) {
          message = 'Enter a street address.';
        } else if (addr.length < 3) {
          message = 'Address is too short. Include street name and house number.';
        }
        break;
      }
      default:
        break;
    }

    if (message) {
      this.#setFieldError(field, message);
      return false;
    }
    this.#clearFieldError(field);
    return true;
  }

  /**
   * @param {string} field
   * @param {string} message
   */
  #setFieldError(field, message) {
    const input = this.#getField(field);
    const errorEl = this.querySelector(`[data-error-for="${field}"]`);
    if (input) input.setAttribute('aria-invalid', 'true');
    if (field === 'phone') {
      this.querySelector('[data-phone-group]')?.classList.add('exp-cart-form__phone-group--invalid');
    }
    if (errorEl instanceof HTMLElement) {
      errorEl.textContent = message;
      errorEl.hidden = false;
    }
  }

  /** @param {string} field */
  #clearFieldError(field) {
    const input = this.#getField(field);
    const errorEl = this.querySelector(`[data-error-for="${field}"]`);
    if (input) input.removeAttribute('aria-invalid');
    if (field === 'phone') {
      this.querySelector('[data-phone-group]')?.classList.remove(
        'exp-cart-form__phone-group--invalid'
      );
    }
    if (errorEl instanceof HTMLElement) {
      errorEl.textContent = '';
      errorEl.hidden = true;
    }
  }

  #clearAllErrors() {
    for (const field of [
      'firstName',
      'lastName',
      'email',
      'phone',
      'province',
      'city',
      'district',
      'subdistrict',
      'intlCity',
      'intlProvince',
      'postalCode',
      'detailAddress',
    ]) {
      this.#clearFieldError(field);
    }
  }

  /* =========================
   * Indonesia Region API v2 (with Fuzzy Reverse-Lookup for GPS & Account Addresses)
   * ========================= */

  /** @param {boolean} [forceReload=false] */
  async #initializeRegionSelects(forceReload = false) {
    if (this.#draft.countryCode !== 'ID') return;

    this.#resetLowerRegions('city', false);
    const loadedProvinces = await this.#loadProvinces(forceReload);
    if (!loadedProvinces) return;

    if (!this.#draft.provinceId && this.#draft.provinceName) {
      const match = this.#matchOptionByName('province', this.#draft.provinceName);
      if (match) {
        this.#draft.provinceId = match.id;
        this.#draft.provinceName = match.name;
        this.#draft.provinceCode = resolveProvinceCode(match.id, match.name, '', 'ID');
      }
    }

    if (!this.#draft.provinceId) return;
    const cities = await this.#loadCities(this.#draft.provinceId, forceReload);
    if (!cities) return;

    if (!this.#draft.cityId && this.#draft.cityName) {
      const match = this.#matchOptionByName('city', this.#draft.cityName);
      if (match) {
        this.#draft.cityId = match.id;
        this.#draft.cityName = match.name;
      }
    }

    if (!this.#draft.cityId) return;
    const districts = await this.#loadDistricts(this.#draft.cityId, forceReload);
    if (!districts) return;

    if (!this.#draft.districtId && this.#draft.districtName) {
      const match = this.#matchOptionByName('district', this.#draft.districtName);
      if (match) {
        this.#draft.districtId = match.id;
        this.#draft.districtName = match.name;
      }
    }

    if (!this.#draft.districtId) return;
    const subdistricts = await this.#loadSubdistricts(this.#draft.districtId, forceReload);
    if (!subdistricts) return;

    if (!this.#draft.subdistrictId && this.#draft.subdistrictName) {
      const match = this.#matchOptionByName('subdistrict', this.#draft.subdistrictName);
      if (match) {
        this.#draft.subdistrictId = match.id;
        this.#draft.subdistrictName = match.name;
        if (!this.#draft.postalCode) {
          this.#autoFillPostalCodeFromVillage(match.id);
        }
      }
    }
  }

  /**
   * Matches an existing label (from GPS reverse geocode or Shopify account) against loaded `<select>` options.
   * @param {string} field
   * @param {string} nameHint
   * @returns {{ id: string, name: string } | null}
   */
  #matchOptionByName(field, nameHint) {
    const select = this.#getField(field);
    if (!(select instanceof HTMLSelectElement) || !nameHint) return null;

    const targetNorm = normalizeRegionCompare(nameHint);
    if (!targetNorm) return null;

    // Pass 1: exact normalized match
    for (const opt of select.options) {
      if (!opt.value) continue;
      if (normalizeRegionCompare(opt.textContent || '') === targetNorm) {
        opt.selected = true;
        return { id: opt.value, name: (opt.textContent || '').trim() };
      }
    }

    // Pass 2: contains match (e.g. "Bogor" matching "Kota Bogor" or "Kabupaten Bogor")
    for (const opt of select.options) {
      if (!opt.value) continue;
      const optNorm = normalizeRegionCompare(opt.textContent || '');
      if (optNorm.includes(targetNorm) || targetNorm.includes(optNorm)) {
        opt.selected = true;
        return { id: opt.value, name: (opt.textContent || '').trim() };
      }
    }

    return null;
  }

  /**
   * @param {string} key
   * @param {string} endpointPath
   * @param {boolean} [forceReload=false]
   * @returns {Promise<Array<{ id: string, name: string, postal_code?: string }>>}
   */
  async #fetchRegionList(key, endpointPath, forceReload = false) {
    const url = `${this.#apiBase}/${endpointPath.replace(/^\/+/, '')}`;
    if (!forceReload && regionResponseCache.has(url)) {
      return regionResponseCache.get(url) || [];
    }

    this.#regionAbortControllers[key]?.abort();
    const controller = new AbortController();
    this.#regionAbortControllers[key] = controller;

    const timeoutId = window.setTimeout(() => controller.abort(), REGION_FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      const list = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : [];
      regionResponseCache.set(url, list);
      return list;
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  /** @param {boolean} [forceReload=false] */
  async #loadProvinces(forceReload = false) {
    const select = this.#getField('province');
    if (!(select instanceof HTMLSelectElement)) return false;

    this.#setSelectLoading(select, 'Loading provinces...');
    this.#toggleRetryButton(false);

    try {
      const provinces = await this.#fetchRegionList('province', 'provinces.json', forceReload);
      this.#populateSelect(select, provinces, 'Select Province', this.#draft.provinceId);
      select.disabled = false;
      if (this.#draft.provinceId) {
        const matched = provinces.find((p) => String(p.id) === String(this.#draft.provinceId));
        if (matched) this.#draft.provinceName = matched.name;
      }
      return true;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return false;
      this.#setSelectLoading(select, 'Unable to load provinces');
      this.#toggleRetryButton(true);
      this.#showAlert('Could not load Indonesian provinces. Check your connection and click "Reload regions".');
      return false;
    }
  }

  /**
   * @param {string} provinceId
   * @param {boolean} [forceReload=false]
   */
  async #loadCities(provinceId, forceReload = false) {
    const select = this.#getField('city');
    if (!(select instanceof HTMLSelectElement)) return false;

    this.#setSelectLoading(select, 'Loading cities...');
    this.#toggleRetryButton(false);

    try {
      const cities = await this.#fetchRegionList(
        'city',
        `regencies/${encodeURIComponent(provinceId)}.json`,
        forceReload
      );
      this.#populateSelect(select, cities, 'Select City', this.#draft.cityId);
      select.disabled = false;
      return true;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return false;
      this.#setSelectLoading(select, 'Unable to load cities');
      this.#toggleRetryButton(true);
      this.#showAlert('Could not load cities. Click "Reload regions" to retry.');
      return false;
    }
  }

  /**
   * @param {string} cityId
   * @param {boolean} [forceReload=false]
   */
  async #loadDistricts(cityId, forceReload = false) {
    const select = this.#getField('district');
    if (!(select instanceof HTMLSelectElement)) return false;

    this.#setSelectLoading(select, 'Loading districts...');
    this.#toggleRetryButton(false);

    try {
      const districts = await this.#fetchRegionList(
        'district',
        `districts/${encodeURIComponent(cityId)}.json`,
        forceReload
      );
      this.#populateSelect(select, districts, 'Select District', this.#draft.districtId);
      select.disabled = false;
      return true;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return false;
      this.#setSelectLoading(select, 'Unable to load districts');
      this.#toggleRetryButton(true);
      this.#showAlert('Could not load districts. Click "Reload regions" to retry.');
      return false;
    }
  }

  /**
   * @param {string} districtId
   * @param {boolean} [forceReload=false]
   */
  async #loadSubdistricts(districtId, forceReload = false) {
    const select = this.#getField('subdistrict');
    if (!(select instanceof HTMLSelectElement)) return false;

    this.#setSelectLoading(select, 'Loading sub-districts...');
    this.#toggleRetryButton(false);

    try {
      const villages = await this.#fetchRegionList(
        'subdistrict',
        `villages/${encodeURIComponent(districtId)}.json`,
        forceReload
      );
      this.#currentVillages = villages;
      this.#populateSelect(select, villages, 'Select Sub-district', this.#draft.subdistrictId);
      select.disabled = false;
      return true;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return false;
      this.#currentVillages = [];
      this.#setSelectLoading(select, 'Unable to load sub-districts');
      this.#toggleRetryButton(true);
      this.#showAlert('Could not load sub-districts. Click "Reload regions" to retry.');
      return false;
    }
  }

  /**
   * @param {'city' | 'district' | 'subdistrict'} fromLevel
   * @param {boolean} [clearDraftValues=true]
   */
  #resetLowerRegions(fromLevel, clearDraftValues = true) {
    const levels = ['city', 'district', 'subdistrict'];
    const labels = {
      city: 'Select City',
      district: 'Select District',
      subdistrict: 'Select Sub-district',
    };

    const startIdx = levels.indexOf(fromLevel);
    for (let i = startIdx; i < levels.length; i += 1) {
      const level = levels[i];
      this.#regionAbortControllers[level]?.abort();
      if (clearDraftValues) {
        this.#draft[`${level}Id`] = '';
        this.#draft[`${level}Name`] = '';
      }

      const select = this.#getField(level);
      if (select instanceof HTMLSelectElement) {
        this.#populateSelect(select, [], labels[level], '');
        select.disabled = true;
      }
      this.#clearFieldError(level);
    }

    this.#currentVillages = [];
    if (clearDraftValues && !this.#postalManuallyEdited) {
      this.#draft.postalCode = '';
      const postalInput = this.#getField('postalCode');
      if (postalInput instanceof HTMLInputElement) postalInput.value = '';
      this.#togglePostalHint(false);
    }
  }

  /** @param {string} villageId */
  #autoFillPostalCodeFromVillage(villageId) {
    if (!villageId || !this.#currentVillages.length) return;
    const match = this.#currentVillages.find((item) => String(item.id) === String(villageId));
    const postal = match?.postal_code ? String(match.postal_code).replace(/\D/g, '').slice(0, 5) : '';

    if (postal && /^\d{5}$/.test(postal)) {
      this.#draft.postalCode = postal;
      this.#postalManuallyEdited = false;
      const postalInput = this.#getField('postalCode');
      if (postalInput instanceof HTMLInputElement) postalInput.value = postal;
      this.#clearFieldError('postalCode');
      this.#togglePostalHint(true);
    }
  }

  /**
   * @param {HTMLSelectElement} select
   * @param {string} text
   */
  #setSelectLoading(select, text) {
    select.innerHTML = '';
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = text;
    select.appendChild(opt);
    select.disabled = true;
  }

  /**
   * @param {HTMLSelectElement} select
   * @param {Array<{ id: string, name: string }>} items
   * @param {string} placeholder
   * @param {string} selectedValue
   */
  #populateSelect(select, items, placeholder, selectedValue) {
    const fragment = document.createDocumentFragment();
    const defaultOpt = document.createElement('option');
    defaultOpt.value = '';
    defaultOpt.textContent = placeholder;
    fragment.appendChild(defaultOpt);

    for (const item of items) {
      const opt = document.createElement('option');
      opt.value = String(item.id);
      opt.textContent = String(item.name);
      if (selectedValue && String(item.id) === String(selectedValue)) {
        opt.selected = true;
      }
      fragment.appendChild(opt);
    }

    select.innerHTML = '';
    select.appendChild(fragment);
  }

  /* =========================
   * Shopify Cart AJAX + Storefront GraphQL Checkout Bridge (Shipping + Billing Fix)
   * ========================= */

  /**
   * @param {Record<string, any>} addr
   * @returns {Record<string, string>}
   */
  #buildCartAttributes(addr) {
    const countryCode = resolveCountryCode(addr.countryCode, addr.country);
    const phone = formatPhoneForCheckout(addr.phone, countryCode);
    /** @type {Record<string, string>} */
    const attrs = {
      'Delivery Method': this.#getDeliveryLabel(addr.deliveryMethod),
      'Address Label': addr.label || '',
      'Recipient Name': `${addr.firstName || ''} ${addr.lastName || ''}`.trim(),
      'Recipient Email': addr.email || '',
      'Recipient Phone': phone,
      Country: resolveCountryName(countryCode, addr.country),
      Province:
        addr.provinceName ||
        (countryCode === 'ID' ? ISO_TO_SHOPIFY_PROVINCE_NAME[addr.provinceCode] : '') ||
        addr.provinceCode ||
        '',
      City: addr.cityName || '',
      District: addr.districtName || '',
      'Sub-district': addr.subdistrictName || '',
      'Postal Code': addr.postalCode || '',
      'Courier Note': addr.noteCouriers || '',
    };

    if (typeof addr.lat === 'number' && typeof addr.lng === 'number') {
      attrs['Location Pin'] = `https://www.google.com/maps/search/?api=1&query=${addr.lat.toFixed(6)},${addr.lng.toFixed(6)}`;
    }

    return attrs;
  }

  /**
   * @param {string} existingNote
   * @param {string} courierNote
   * @returns {string}
   */
  #buildMergedCartNote(existingNote, courierNote) {
    const cleanCourier = String(courierNote || '').trim();
    const baseNote = String(existingNote || '')
      .replace(/(?:^|\n)Courier Note:.*$/gim, '')
      .trim();

    if (!cleanCourier) return baseNote;
    if (!baseNote) return `Courier Note: ${cleanCourier}`;
    return `${baseNote}\nCourier Note: ${cleanCourier}`;
  }

  /** @param {Record<string, any>} addr */
  async #syncCartAttributes(addr) {
    const updateUrl = this.dataset.cartUpdateUrl || '/cart/update.js';
    const endpoint = updateUrl.endsWith('.js') ? updateUrl : `${updateUrl}.js`;

    const existingNoteEl = document.querySelector('#cart-note');
    const currentNote =
      existingNoteEl instanceof HTMLTextAreaElement
        ? existingNoteEl.value
        : this.dataset.cartNote || '';

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        attributes: this.#buildCartAttributes(addr),
        note: this.#buildMergedCartNote(currentNote, addr.noteCouriers),
      }),
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  /** @param {HTMLElement | null} triggerButton */
  async #launchAutoFilledCheckout(triggerButton) {
    if (this.#isSubmittingCheckout) return;

    const active = this.#getSelectedAddress();
    if (!isAddressCheckoutReady(active)) {
      this.#dropdownOpen = true;
      this.#renderDropdownState();
      if (active) void this.#openFormModal('edit', active.id);
      else void this.#openFormModal('create', null);
      return;
    }

    this.#isSubmittingCheckout = true;
    this.#setButtonLoading(triggerButton, true);

    try {
      const cartUrl = this.dataset.cartUrl || '/cart';
      const cartJsonUrl = cartUrl.endsWith('.js') ? cartUrl : `${cartUrl}.js`;
      const cartRes = await fetch(cartJsonUrl, { headers: { Accept: 'application/json' } });
      if (!cartRes.ok) throw new Error(`HTTP ${cartRes.status}`);

      const cartData = await cartRes.json();
      if (!Array.isArray(cartData?.items) || cartData.items.length === 0) {
        this.#syncBannerMessage = 'Your cart is currently empty. Add an item before checking out.';
        this.#renderSyncBanner();
        return;
      }

      try {
        await this.#syncCartAttributes(active);
      } catch {
        // Non-blocking
      }

      const storefrontUrl = await this.#createStorefrontCheckoutUrl(cartData, active);
      if (storefrontUrl) {
        // Attach Shipping + Billing query params too so digital/gift-card carts also pre-fill
        window.location.assign(appendCheckoutPrefillParams(storefrontUrl, active));
        return;
      }

      const fallbackUrl = appendCheckoutPrefillParams(`${window.location.origin}/checkout`, active);
      window.location.assign(fallbackUrl);
    } catch {
      const fallbackUrl = appendCheckoutPrefillParams(`${window.location.origin}/checkout`, active);
      window.location.assign(fallbackUrl);
    } finally {
      this.#isSubmittingCheckout = false;
      this.#setButtonLoading(triggerButton, false);
    }
  }

  /**
   * @param {Record<string, any>} cartData
   * @param {Record<string, any>} addr
   * @returns {Promise<string | null>}
   */
  async #createStorefrontCheckoutUrl(cartData, addr) {
    const apiVersion = (this.dataset.storefrontApiVersion || '2025-10').trim();
    const endpoint = `${window.location.origin}/api/${encodeURIComponent(apiVersion)}/graphql.json`;

    const lines = cartData.items.map((item) => {
      /** @type {Record<string, any>} */
      const line = {
        merchandiseId: `gid://shopify/ProductVariant/${item.variant_id}`,
        quantity: Number(item.quantity) || 1,
      };

      if (item.properties && typeof item.properties === 'object') {
        const lineAttrs = Object.entries(item.properties)
          .filter(([key, val]) => key && val !== null && val !== undefined && String(val) !== '')
          .map(([key, val]) => ({ key: String(key), value: String(val) }));
        if (lineAttrs.length > 0) line.attributes = lineAttrs;
      }

      const sellingPlanId = item?.selling_plan_allocation?.selling_plan?.id;
      if (sellingPlanId) {
        line.sellingPlanId = `gid://shopify/SellingPlan/${sellingPlanId}`;
      }
      return line;
    });

    const mergedAttrs = {
      ...(cartData.attributes && typeof cartData.attributes === 'object' ? cartData.attributes : {}),
      ...this.#buildCartAttributes(addr),
    };

    const attributes = Object.entries(mergedAttrs)
      .filter(([key, val]) => key && val !== null && val !== undefined && String(val).trim() !== '')
      .map(([key, val]) => ({ key: String(key), value: String(val) }));

    const discountCodes = extractDiscountCodes(cartData);
    const countryCode = resolveCountryCode(addr.countryCode, addr.country);
    const phoneE164 = formatPhoneForCheckout(addr.phone, countryCode);
    const provinceCode = resolveProvinceCode(
      addr.provinceId,
      addr.provinceName,
      addr.provinceCode,
      countryCode
    );
    const address2 = buildAddress2Line(
      addr.apartment,
      addr.districtName,
      addr.subdistrictName,
      addr.subdistrictLine
    );

    const existingNoteEl = document.querySelector('#cart-note');
    const liveNote =
      existingNoteEl instanceof HTMLTextAreaElement ? existingNoteEl.value : cartData.note || '';

    /** @type {Record<string, any>} */
    const buyerIdentity = {
      email: String(addr.email || '').trim(),
      countryCode,
    };
    if (phoneE164) {
      buyerIdentity.phone = phoneE164;
    }

    /** @type {Record<string, any>} */
    const deliveryAddress = {
      firstName: String(addr.firstName || '').trim(),
      lastName: String(addr.lastName || '').trim(),
      address1: String(addr.detailAddress || '').trim(),
      city: String(addr.cityName || '').trim(),
      provinceCode,
      zip: String(addr.postalCode || '').trim(),
      countryCode,
    };
    if (address2) deliveryAddress.address2 = address2;
    if (phoneE164) deliveryAddress.phone = phoneE164;

    /** @type {Record<string, any>} */
    const input = {
      lines,
      note: this.#buildMergedCartNote(liveNote, addr.noteCouriers),
      attributes,
      buyerIdentity,
      delivery: {
        addresses: [
          {
            address: { deliveryAddress },
            selected: true,
            oneTimeUse: true,
            validationStrategy: 'COUNTRY_CODE_ONLY',
          },
        ],
      },
    };

    if (discountCodes.length > 0) input.discountCodes = discountCodes;

    /** @type {Record<string, string>} */
    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    const token = (this.dataset.storefrontToken || '').trim();
    if (token) headers['X-Shopify-Storefront-Access-Token'] = token;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        query: STOREFRONT_CART_CREATE_MUTATION,
        variables: { input },
      }),
    });

    if (!response.ok) return null;
    const result = await response.json();
    const cartCreate = result?.data?.cartCreate;
    if (!cartCreate || (Array.isArray(cartCreate.userErrors) && cartCreate.userErrors.length > 0)) {
      return null;
    }

    return typeof cartCreate.cart?.checkoutUrl === 'string' && cartCreate.cart.checkoutUrl
      ? cartCreate.cart.checkoutUrl
      : null;
  }

  /* =========================
   * UI Helpers
   * ========================= */

  /**
   * @param {Element | null} button
   * @param {boolean} loading
   */
  #setButtonLoading(button, loading) {
    if (!(button instanceof HTMLButtonElement)) return;
    button.disabled = loading;
    button.classList.toggle('exp-cart-form__btn--loading', loading);
    button.setAttribute('aria-busy', loading ? 'true' : 'false');
  }

  /** @param {boolean} show */
  #togglePostalHint(show) {
    const hint = this.querySelector('[data-postal-hint]');
    if (hint instanceof HTMLElement) hint.hidden = !show;
  }

  /** @param {boolean} show */
  #toggleRetryButton(show) {
    const btn = this.querySelector('[data-action="retry-regions"]');
    if (btn instanceof HTMLElement) btn.hidden = !show;
  }

  /** @param {string} message */
  #showAlert(message) {
    const alertEl = this.querySelector('[data-alert]');
    if (alertEl instanceof HTMLElement) {
      alertEl.textContent = message;
      alertEl.hidden = false;
    }
  }

  #clearAlert() {
    const alertEl = this.querySelector('[data-alert]');
    if (alertEl instanceof HTMLElement) {
      alertEl.textContent = '';
      alertEl.hidden = true;
    }
  }

  /** @param {string} message */
  #announce(message) {
    const statusEl = this.querySelector('[data-live-status]');
    if (statusEl instanceof HTMLElement) {
      statusEl.textContent = '';
      window.requestAnimationFrame(() => {
        statusEl.textContent = message;
      });
    }
  }
}

if (!customElements.get('exp-cart-checkout-form')) {
  customElements.define('exp-cart-checkout-form', ExpCartCheckoutForm);
}
