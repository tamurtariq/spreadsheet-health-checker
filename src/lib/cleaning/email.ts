const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// A small, bundled list rather than a network lookup — keeps cleaning
// entirely client-side, consistent with the rest of this app.
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com',
  'yopmail.com',
  'guerrillamail.com',
  '10minutemail.com',
  'tempmail.com',
  'trashmail.com',
  'throwawaymail.com',
  'getnada.com',
  'sharklasers.com',
  'maildrop.cc',
  'dispostable.com',
  'fakeinbox.com',
  'temp-mail.org',
  'mailnesia.com',
]);

export interface EmailCleanResult {
  value: string;
  changed: boolean;
  valid: boolean;
  disposable: boolean;
}

export function cleanEmail(raw: string): EmailCleanResult {
  const trimmed = raw.trim().replace(/\s+/g, '');
  const value = trimmed.toLowerCase();
  const valid = EMAIL_RE.test(value);
  const domain = valid ? value.split('@')[1] : '';
  const disposable = valid && DISPOSABLE_DOMAINS.has(domain);

  return {
    value,
    changed: value !== raw,
    valid,
    disposable,
  };
}
