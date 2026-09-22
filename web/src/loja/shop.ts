// Estado da loja do cliente: dados da loja, cardápio e sacola (guardada no navegador)
import { computed, reactive, watch } from 'vue'
import { api } from '@/lib/api'

export type PaymentMethod = 'PIX' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'CASH'

export interface StoreInfo {
  name: string
  description: string | null
  logoUrl: string | null
  coverUrl: string | null
  primaryColor: string
  whatsappPhone: string | null
  status:
    | { state: 'OPEN' }
    | { state: 'PAUSED'; until: string }
    | { state: 'CLOSED'; opensAt: { day: number; time: string } | null }
  features: {
    checkout: boolean
    orderTracking: boolean
    pickup: boolean
    delivery: boolean
    preOrders: boolean
  }
  pickupAddress: string | null
  deliveryZones: { neighborhood: string; fee: number }[]
  minimumOrderValue: number | null
  preOrderMinHours: number
  paymentMethods: PaymentMethod[]
}

export interface MenuAddon {
  id: string
  name: string
  price: number
}

export interface MenuProduct {
  id: string
  name: string
  description: string | null
  imageUrl: string | null
  price: number
  promoPrice: number | null
  available: boolean
  variations: { id: string; name: string; price: number; available: boolean }[]
  addonGroups: { id: string; name: string; minSelect: number; maxSelect: number; addons: MenuAddon[] }[]
}

export interface MenuCategory {
  id: string
  name: string
  products: MenuProduct[]
}

export interface CartItem {
  key: string
  productId: string
  variationId: string | null
  name: string
  imageUrl: string | null
  unitPrice: number // já com adicionais
  quantity: number
  addons: MenuAddon[]
  notes: string
}

const CART_KEY = 'cardapio.sacola'

function loadCart(): CartItem[] {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY) ?? '[]')
  } catch {
    return []
  }
}

export const shop = reactive({
  store: null as StoreInfo | null,
  menu: [] as MenuCategory[],
  cart: loadCart(),
  loaded: false,
})

watch(
  () => shop.cart,
  (cart) => {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(cart))
    } catch {
      /* navegador sem armazenamento: a sacola vale só nesta aba */
    }
  },
  { deep: true },
)

export async function loadShop() {
  const [store, menu] = await Promise.all([api.get<StoreInfo>('/public/store'), api.get<MenuCategory[]>('/public/menu')])
  shop.store = store
  shop.menu = menu
  shop.loaded = true
  pruneCart()
}

// Tira da sacola o que saiu do cardápio ou ficou indisponível desde a última visita
function pruneCart() {
  const products = new Map(shop.menu.flatMap((c) => c.products).map((p) => [p.id, p]))
  shop.cart = shop.cart.filter((i) => {
    const p = products.get(i.productId)
    if (!p || !p.available) return false
    if (i.variationId) return p.variations.some((v) => v.id === i.variationId && v.available)
    return true
  })
}

export const cartCount = computed(() => shop.cart.reduce((s, i) => s + i.quantity, 0))
export const cartSubtotal = computed(() => Math.round(shop.cart.reduce((s, i) => s + i.unitPrice * i.quantity, 0) * 100) / 100)

export function addToCart(item: Omit<CartItem, 'key'>) {
  // Mesmo produto, mesma opção, mesmos adicionais e observação: soma a quantidade
  const key = [item.productId, item.variationId ?? '', item.addons.map((a) => a.id).sort().join(','), item.notes.trim()].join('|')
  const existing = shop.cart.find((i) => i.key === key)
  if (existing) existing.quantity += item.quantity
  else shop.cart.push({ ...item, key })
}

export function clearCart() {
  shop.cart = []
}

export const isOpen = computed(() => shop.store?.status.state === 'OPEN')

const DAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
export const statusText = computed(() => {
  const s = shop.store?.status
  if (!s) return ''
  if (s.state === 'OPEN') return 'Aberta agora'
  if (s.state === 'PAUSED') {
    const t = new Date(s.until).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    return `Pausada até ${t}`
  }
  if (!s.opensAt) return 'Fechada'
  const today = new Date().getDay()
  const when = s.opensAt.day === today ? 'hoje' : s.opensAt.day === (today + 1) % 7 ? 'amanhã' : DAYS[s.opensAt.day]
  return `Fechada · abre ${when} às ${s.opensAt.time}`
})

// Pode fazer pedido agora ou só encomenda para outra data?
export const canOrderNow = computed(() => isOpen.value)
export const canPreOrder = computed(() => Boolean(shop.store?.features.preOrders))

export const paymentLabel: Record<PaymentMethod, string> = {
  PIX: 'Pix',
  CREDIT_CARD: 'Cartão de crédito',
  DEBIT_CARD: 'Cartão de débito',
  CASH: 'Dinheiro na entrega',
}

// Mensagem pronta para o WhatsApp quando o checkout está desligado
export function whatsappOrderLink(customerName: string, notes: string): string | null {
  const phone = shop.store?.whatsappPhone
  if (!phone) return null
  const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const lines = shop.cart.map((i) => {
    const extras = i.addons.length ? `\n   + ${i.addons.map((a) => a.name).join(', ')}` : ''
    const obs = i.notes ? `\n   Obs.: ${i.notes}` : ''
    return `• ${i.quantity}x ${i.name} — ${brl(i.unitPrice * i.quantity)}${extras}${obs}`
  })
  const text = [
    `Olá! Quero fazer um pedido${customerName ? `, sou ${customerName}` : ''}:`,
    '',
    ...lines,
    '',
    `*Total: ${brl(cartSubtotal.value)}*`,
    ...(notes ? ['', `Observações: ${notes}`] : []),
  ].join('\n')
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
}
