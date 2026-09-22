import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCb) as (password: string, salt: string, keylen: number) => Promise<Buffer>

// Formato salvo: "salt:hash", ambos em hex.
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex')
  const hash = await scrypt(password, salt, 64)
  return `${salt}:${hash.toString('hex')}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hashHex] = stored.split(':')
  if (!salt || !hashHex) return false
  const expected = Buffer.from(hashHex, 'hex')
  const actual = await scrypt(password, salt, expected.length)
  return timingSafeEqual(actual, expected)
}
