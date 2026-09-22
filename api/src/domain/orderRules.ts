// Regras de pedido que não dependem do banco: fluxo de status e encomendas.

export type OrderStatus = 'RECEIVED' | 'PREPARING' | 'OUT_FOR_DELIVERY' | 'READY_FOR_PICKUP' | 'DELIVERED' | 'CANCELED'
export type Fulfillment = 'PICKUP' | 'DELIVERY'

// Próximos status permitidos a partir de cada status
export function nextStatuses(current: OrderStatus, fulfillment: Fulfillment): OrderStatus[] {
  switch (current) {
    case 'RECEIVED':
      return ['PREPARING', 'CANCELED']
    case 'PREPARING':
      return [fulfillment === 'DELIVERY' ? 'OUT_FOR_DELIVERY' : 'READY_FOR_PICKUP', 'CANCELED']
    case 'OUT_FOR_DELIVERY':
    case 'READY_FOR_PICKUP':
      return ['DELIVERED', 'CANCELED']
    default:
      return []
  }
}

// O pedido é "confirmado" quando o dono aceita (sai de Recebido). É nesse
// momento que o estoque baixa pela ficha técnica. Se for cancelado depois, volta.
export function stockAction(from: OrderStatus, to: OrderStatus, alreadyDeducted: boolean): 'deduct' | 'restore' | null {
  if (to === 'CANCELED') return alreadyDeducted ? 'restore' : null
  if (from === 'RECEIVED' && !alreadyDeducted) return 'deduct'
  return null
}

export function scheduleError(opts: {
  scheduledFor: Date | null
  now: Date
  storeOpen: boolean
  preOrdersEnabled: boolean
  minHours: number
}): string | null {
  const { scheduledFor, now, storeOpen, preOrdersEnabled, minHours } = opts
  if (scheduledFor) {
    if (!preOrdersEnabled) return 'Esta loja não aceita encomendas'
    if (scheduledFor.getTime() < now.getTime() + minHours * 3_600_000) {
      return `Encomendas precisam de pelo menos ${minHours} horas de antecedência`
    }
    return null
  }
  if (!storeOpen) {
    return preOrdersEnabled ? 'A loja está fechada agora. Escolha uma data para encomendar.' : 'A loja está fechada agora'
  }
  return null
}

// Início e fim do dia em São Paulo (UTC−3, sem horário de verão desde 2019)
const SP_OFFSET_MS = -3 * 3_600_000
export function localDayRange(date: Date): { start: Date; end: Date } {
  const local = new Date(date.getTime() + SP_OFFSET_MS)
  const startUtc = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - SP_OFFSET_MS
  return { start: new Date(startUtc), end: new Date(startUtc + 86_400_000) }
}
