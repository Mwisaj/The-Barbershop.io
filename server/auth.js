import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const derive = promisify(scrypt);
const options = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
export async function hashPassword(password) {
  if (typeof password !== 'string' || password.length < 15 || password.length > 128) {
    throw new Error('Use a password between 15 and 128 characters.');
  }
  const salt = randomBytes(16).toString('hex');
  const hash = await derive(password, salt, 64, options);
  return { salt, hash: hash.toString('hex') };
}
export async function verifyPassword(password, credential) {
  if (typeof password !== 'string' || password.length > 128 || !credential) return false;
  const actual = await derive(password, credential.salt, 64, options);
  const expected = Buffer.from(credential.hash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
