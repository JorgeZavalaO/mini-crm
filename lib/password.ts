import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  type ScryptOptions,
} from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: string,
  keylen: number,
  options: ScryptOptions,
) => Promise<Buffer>;

/** Maximum accepted password length to prevent DoS via scrypt CPU exhaustion. */
const MAX_PASSWORD_LENGTH = 1024;

/**
 * Hash a password using scrypt.
 * Format: scrypt$<salt>$<derivedKey>
 */
export async function hashPassword(password: string): Promise<string> {
  if (password.length > MAX_PASSWORD_LENGTH) {
    throw new Error('Contraseña demasiado larga');
  }
  const salt = randomBytes(16).toString('hex');
  const derivedKey = (await scrypt(password, salt, 64, {
    N: 131072,
    r: 8,
    p: 1,
    maxmem: 134_283_264,
  })) as Buffer;
  return `scrypt$${salt}$${derivedKey.toString('hex')}`;
}

/**
 * Verify a password against a scrypt hash.
 * Uses timing-safe comparison to prevent timing attacks.
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (password.length > MAX_PASSWORD_LENGTH) return false;
  const [prefix, salt, key] = hash.split('$');
  if (prefix !== 'scrypt' || !salt || !key) return false;

  const derivedKey = (await scrypt(password, salt, 64, {
    N: 131072,
    r: 8,
    p: 1,
    maxmem: 134_283_264,
  })) as Buffer;
  const derivedHex = Buffer.from(derivedKey.toString('hex'));
  const storedHex = Buffer.from(key);
  if (derivedHex.length !== storedHex.length) return false;
  return timingSafeEqual(derivedHex, storedHex);
}
