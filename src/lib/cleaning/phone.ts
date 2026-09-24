export interface PhoneCleanResult {
  value: string;
  changed: boolean;
  valid: boolean;
}

/**
 * Accepts the raw cell value, not a pre-formatted string. When Excel stores
 * a phone number as a genuine number, its *display* text can be scientific
 * notation (e.g. "5.55E+09") depending on column formatting, which loses
 * digits if parsed as a string. Working from the underlying numeric value
 * (via toFixed, not toString/toLocaleString) sidesteps that — phone-number
 * magnitudes are well within Number's exact-integer range.
 */
export function cleanPhone(raw: string | number): PhoneCleanResult {
  const original = String(raw);
  const source = typeof raw === 'number' ? raw.toFixed(0) : raw;
  const digits = source.replace(/\D/g, '');

  let normalized = digits;
  if (digits.length === 10) {
    normalized = '1' + digits;
  }

  const valid = normalized.length === 11 && normalized.startsWith('1');
  const value = valid
    ? `+${normalized[0]} (${normalized.slice(1, 4)}) ${normalized.slice(4, 7)}-${normalized.slice(7)}`
    : original.trim();

  return {
    value,
    changed: value !== original,
    valid,
  };
}
