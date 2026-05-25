/** Client-side checks aligned with Flask ``validate_display_name``, ``validate_email``, ``validate_password_policy``. */

const USERNAME_RE = /^[a-zA-Z0-9._-]{3,80}$/
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export function validateUsername(raw: string): string | null {
  const s = raw.trim()
  if (!s) return 'Username is required.'
  if (!USERNAME_RE.test(s)) return 'Use 3–80 characters: letters, digits, period, underscore, or hyphen.'
  return null
}

export function validateEmail(raw: string): string | null {
  const s = raw.trim().toLowerCase()
  if (!s) return 'Email is required.'
  if (s.length > 255 || !EMAIL_RE.test(s)) return 'Enter a valid email address.'
  return null
}

export function validatePasswordPolicy(raw: string, minLen = 10): string | null {
  if (!raw) return 'Password is required.'
  if (raw.length < minLen) return `Password must be at least ${minLen} characters.`
  if (raw.trim() !== raw) return 'Password must not have leading or trailing spaces.'
  return null
}

export function validateOtpCode(raw: string): string | null {
  const digits = raw.replace(/\s/g, '')
  if (!digits) return 'Enter the 6-digit code from your authenticator app.'
  if (!/^\d{6}$/.test(digits)) return 'The code must be exactly 6 digits.'
  return null
}

export function normalizeOtp(raw: string): string {
  return raw.replace(/\s/g, '')
}
