export type BaseUnit = 'G' | 'ML' | 'UN'

const brlFormat = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
export const brl = (v: number | null | undefined) => (v == null ? '—' : brlFormat.format(v))

export const pct = (v: number | null | undefined) =>
  v == null ? '—' : `${(v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`

const n = (v: number, digits = 3) => v.toLocaleString('pt-BR', { maximumFractionDigits: digits })

// 2500 g → "2,5 kg"; 300 ml → "300 ml"; 12 un → "12 un"
export function qty(value: number, unit: BaseUnit): string {
  if (unit === 'G') return Math.abs(value) >= 1000 ? `${n(value / 1000)} kg` : `${n(value)} g`
  if (unit === 'ML') return Math.abs(value) >= 1000 ? `${n(value / 1000)} L` : `${n(value)} ml`
  return `${n(value)} un`
}

export const unitSuffix: Record<BaseUnit, string> = { G: 'g', ML: 'ml', UN: 'un' }

// O custo é guardado por g/ml/un; para o dono mostramos por kg/L/un
export const costFactor: Record<BaseUnit, number> = { G: 1000, ML: 1000, UN: 1 }
export const costLabel: Record<BaseUnit, string> = { G: 'kg', ML: 'L', UN: 'un' }
export const unitCostDisplay = (unitCost: number, unit: BaseUnit) =>
  `${brl(unitCost * costFactor[unit])}/${costLabel[unit]}`
