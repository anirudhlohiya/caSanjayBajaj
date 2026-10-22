/**
 * Utilities for validating Indian tax identifiers: GSTIN (15 chars) and PAN (10 chars).
 */

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
const CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * Validates a 15-character GSTIN using regex and the official Luhn mod 36 check digit algorithm.
 */
export function isValidGstin(gstin: string): boolean {
  if (!gstin) return false;
  const upper = gstin.trim().toUpperCase();
  if (!GSTIN_REGEX.test(upper)) return false;

  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const val = CHARS.indexOf(upper[i]);
    if (val === -1) return false;
    const factor = i % 2 === 0 ? 1 : 2;
    const prod = val * factor;
    sum += Math.floor(prod / 36) + (prod % 36);
  }
  const checkCode = (36 - (sum % 36)) % 36;
  return CHARS[checkCode] === upper[14];
}

/**
 * Validates a 10-character Indian Permanent Account Number (PAN).
 */
export function isValidPan(pan: string): boolean {
  if (!pan) return false;
  return PAN_REGEX.test(pan.trim().toUpperCase());
}
