// Shared by the React form and the Express API so both enforce the same rules.

export const FIELDS = [
  { name: 'name_first', label: 'First name', autoComplete: 'given-name' },
  { name: 'name_last', label: 'Last name', autoComplete: 'family-name' },
  { name: 'address_line_1', label: 'Address line 1', autoComplete: 'address-line1' },
  { name: 'address_line_2', label: 'Address line 2', optional: true, autoComplete: 'address-line2' },
  { name: 'address_city', label: 'City', autoComplete: 'address-level2' },
  { name: 'address_state', label: 'State', placeholder: 'NY', hint: 'Two-letter code, such as NY or CA. Not case-sensitive.', maxLength: 2, autoComplete: 'address-level1', uppercase: true },
  { name: 'address_postal_code', label: 'ZIP or postal code', placeholder: '10001', autoComplete: 'postal-code' },
  { name: 'address_country_code', label: 'Country', placeholder: 'US', hint: 'Only US applicants are accepted. Not case-sensitive.', maxLength: 2, autoComplete: 'country', uppercase: true },
  { name: 'document_ssn', label: 'Social Security number', placeholder: '123456789', hint: 'Nine digits, no dashes.', maxLength: 9, inputMode: 'numeric', autoComplete: 'off' },
  { name: 'email_address', label: 'Email address', type: 'email', autoComplete: 'email' },
  { name: 'phone_number', label: 'Phone number', type: 'tel', autoComplete: 'tel' },
  { name: 'birth_date', label: 'Date of birth', placeholder: 'YYYY-MM-DD', hint: 'Format: YYYY-MM-DD, such as 1990-04-15.', maxLength: 10, autoComplete: 'bday' },
];

const US_STATES = new Set([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS',
  'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY',
  'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV',
  'WI', 'WY', 'DC', 'PR', 'GU', 'VI', 'AS', 'MP',
]);

// Each rule returns an error message, or nothing if the value is valid.
const RULES = {
  address_state: (v) =>
    !US_STATES.has(v) && 'Enter a two-letter US state code, such as NY or CA.',
  address_postal_code: (v) =>
    !/^\d{5}(-\d{4})?$/.test(v) && 'Enter a 5-digit ZIP code (or ZIP+4).',
  address_country_code: (v) =>
    v !== 'US' && 'Country must be US.',
  document_ssn: (v) => {
    const m = /^(\d{3})(\d{2})(\d{4})$/.exec(v);
    if (!m) return 'Enter your SSN as nine digits, with no dashes.';
    const [, area, group, serial] = m;
    // The SSA never issues these ranges.
    if (area === '000' || area === '666' || area[0] === '9' || group === '00' || serial === '0000') {
      return 'Enter a valid Social Security number.';
    }
  },
  email_address: (v) =>
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && 'Enter a valid email address.',
  phone_number: (v) =>
    v.replace(/\D/g, '').length < 10 && 'Enter a valid phone number.',
  birth_date: (v) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return 'Date of birth must use the format YYYY-MM-DD.';
    const d = new Date(`${v}T00:00:00Z`);
    if (isNaN(d) || d.toISOString().slice(0, 10) !== v) return 'Enter a real calendar date.';
    if (d > new Date()) return 'Date of birth cannot be in the future.';
  },
};

// Trims everything and uppercases fields marked `uppercase`, so "ny " and "us" are accepted.
export function normalize(data) {
  const out = {};
  for (const { name, uppercase } of FIELDS) {
    let v = String(data?.[name] ?? '').trim();
    if (uppercase) v = v.toUpperCase();
    out[name] = v;
  }
  return out;
}

export function validateField(name, value) {
  const field = FIELDS.find((f) => f.name === name);
  if (!value) return field.optional ? null : `${field.label} is required.`;
  return RULES[name]?.(value) || null;
}

// Strips everything but digits as the user types, capped at nine digits.
export function formatSsn(value) {
  return value.replace(/\D/g, '').slice(0, 9);
}

// Returns { field: message } for every invalid field; an empty object means valid.
export function validate(data) {
  const clean = normalize(data);
  const errors = {};
  for (const { name } of FIELDS) {
    const error = validateField(name, clean[name]);
    if (error) errors[name] = error;
  }
  return errors;
}
