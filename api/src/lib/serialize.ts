import { Prisma } from '@prisma/client'

// O Prisma devolve valores Decimal como objetos, que viram texto no JSON.
// Aqui convertemos para número antes de responder, para o front receber 12.5 e não "12.5".
export function toPlain(value: unknown): unknown {
  if (value instanceof Prisma.Decimal) return value.toNumber()
  if (value instanceof Date) return value
  if (Array.isArray(value)) return value.map(toPlain)
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) out[k] = toPlain(v)
    return out
  }
  return value
}

export const num = (d: Prisma.Decimal | number | null | undefined): number =>
  d == null ? 0 : typeof d === 'number' ? d : d.toNumber()
