export type OrderStatus = 'RECEIVED' | 'PREPARING' | 'OUT_FOR_DELIVERY' | 'READY_FOR_PICKUP' | 'DELIVERED' | 'CANCELED'
export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED'
export type PaymentMethod = 'PIX' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'CASH'

export interface AdminOrder {
  id: string
  number: number
  status: OrderStatus
  fulfillment: 'PICKUP' | 'DELIVERY'
  scheduledFor: string | null
  customerName: string
  customerPhone: string
  address: { street: string; number: string; complement?: string | null; neighborhood: string; reference?: string | null } | null
  subtotal: number
  deliveryFee: number
  total: number
  notes: string | null
  paymentMethod: PaymentMethod
  paymentStatus: PaymentStatus
  changeFor: number | null
  createdAt: string
  items: {
    id: string
    name: string
    unitPrice: number
    quantity: number
    notes: string | null
    addons: { id: string; name: string; price: number }[]
  }[]
  statusHistory: { status: OrderStatus; createdAt: string }[]
  nextStatuses: OrderStatus[]
}

export const statusLabel: Record<OrderStatus, string> = {
  RECEIVED: 'Recebido',
  PREPARING: 'Em preparo',
  OUT_FOR_DELIVERY: 'Saiu para entrega',
  READY_FOR_PICKUP: 'Pronto para retirar',
  DELIVERED: 'Entregue',
  CANCELED: 'Cancelado',
}

export const statusColor: Record<OrderStatus, string> = {
  RECEIVED: 'info',
  PREPARING: 'warning',
  OUT_FOR_DELIVERY: 'purple',
  READY_FOR_PICKUP: 'purple',
  DELIVERED: 'success',
  CANCELED: 'error',
}

// Texto do botão que leva ao próximo status
export const actionLabel: Record<OrderStatus, string> = {
  RECEIVED: 'Recebido',
  PREPARING: 'Aceitar e preparar',
  OUT_FOR_DELIVERY: 'Saiu para entrega',
  READY_FOR_PICKUP: 'Pronto para retirar',
  DELIVERED: 'Concluir',
  CANCELED: 'Cancelar',
}

export const paymentLabel: Record<PaymentMethod, string> = {
  PIX: 'Pix',
  CREDIT_CARD: 'Crédito',
  DEBIT_CARD: 'Débito',
  CASH: 'Dinheiro',
}

export const paymentStatusLabel: Record<PaymentStatus, string> = {
  PENDING: 'A receber',
  PAID: 'Pago',
  FAILED: 'Recusado',
  REFUNDED: 'Estornado',
}

// Mensagens padrão de WhatsApp para o cliente. O dono pode editar em Configurações.
export const defaultMessages: Record<OrderStatus, string> = {
  RECEIVED: 'Olá, {nome}! Recebemos seu pedido #{numero} na {loja}. Já já confirmamos 😊',
  PREPARING: 'Olá, {nome}! Seu pedido #{numero} está sendo preparado 🧁',
  OUT_FOR_DELIVERY: 'Olá, {nome}! Seu pedido #{numero} saiu para entrega 🛵',
  READY_FOR_PICKUP: 'Olá, {nome}! Seu pedido #{numero} está pronto para retirada 🎉',
  DELIVERED: 'Obrigada pela preferência, {nome}! Esperamos que goste 💕',
  CANCELED: 'Olá, {nome}. Infelizmente seu pedido #{numero} foi cancelado. Qualquer dúvida, é só chamar.',
}

export function whatsappToCustomer(order: AdminOrder, template: string, storeName: string): string {
  const digits = order.customerPhone.replace(/\D/g, '')
  const phone = digits.length <= 11 ? `55${digits}` : digits
  const text = template
    .replaceAll('{nome}', order.customerName.split(' ')[0])
    .replaceAll('{numero}', String(order.number))
    .replaceAll('{loja}', storeName)
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
}

// Bipe de pedido novo (sem arquivo de áudio)
export function beep() {
  try {
    const ctx = new AudioContext()
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.frequency.value = 880
      gain.gain.setValueAtTime(0.25, ctx.currentTime + i * 0.35)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.35 + 0.25)
      osc.connect(gain).connect(ctx.destination)
      osc.start(ctx.currentTime + i * 0.35)
      osc.stop(ctx.currentTime + i * 0.35 + 0.3)
    }
    setTimeout(() => ctx.close(), 1500)
  } catch {
    /* navegador sem áudio */
  }
}
