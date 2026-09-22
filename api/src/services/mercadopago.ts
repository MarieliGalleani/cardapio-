// Integração com o Mercado Pago (Checkout Pro) para crédito e débito.
// O cliente paga numa página do próprio Mercado Pago; o site nunca vê dados de cartão.
// O access token fica só no servidor (MP_ACCESS_TOKEN).
import { HttpError } from '../lib/http.js'

const MP_API = 'https://api.mercadopago.com'

export const mpConfigured = () => Boolean(process.env.MP_ACCESS_TOKEN)

async function mpFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = process.env.MP_ACCESS_TOKEN
  if (!token) throw new HttpError(503, 'Pagamento com cartão não está configurado')
  const res = await fetch(`${MP_API}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...init?.headers },
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new HttpError(502, `Mercado Pago recusou a operação (${res.status}) ${detail.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

export interface PreferenceInput {
  orderId: string
  orderNumber: number
  publicToken: string
  total: number
  storeName: string
  allowCredit: boolean
  allowDebit: boolean
  customerName: string
}

// Cria a página de pagamento e devolve o link para onde o cliente é levado
export async function createCheckout(p: PreferenceInput): Promise<string> {
  const webUrl = process.env.PUBLIC_WEB_URL ?? 'http://localhost:5173'
  const apiUrl = process.env.PUBLIC_API_URL ?? 'http://localhost:3333'
  const back = `${webUrl}/pedido/${p.publicToken}`

  const excluded = [{ id: 'ticket' }, { id: 'atm' }, { id: 'bank_transfer' }]
  if (!p.allowCredit) excluded.push({ id: 'credit_card' })
  if (!p.allowDebit) excluded.push({ id: 'debit_card' })

  const pref = await mpFetch<{ init_point: string }>('/checkout/preferences', {
    method: 'POST',
    body: JSON.stringify({
      items: [
        {
          id: p.orderId,
          title: `${p.storeName} — Pedido #${p.orderNumber}`,
          quantity: 1,
          currency_id: 'BRL',
          unit_price: p.total,
        },
      ],
      payer: { name: p.customerName },
      external_reference: p.orderId,
      payment_methods: { excluded_payment_types: excluded },
      back_urls: { success: back, pending: back, failure: back },
      auto_return: 'approved',
      // O Mercado Pago só consegue avisar um endereço público (não funciona em localhost)
      ...(apiUrl.includes('localhost') ? {} : { notification_url: `${apiUrl}/api/public/mercadopago/webhook` }),
    }),
  })
  return pref.init_point
}

export interface MpPayment {
  id: number
  status: string
  external_reference: string | null
  transaction_amount: number
}

export const getPayment = (id: string) => mpFetch<MpPayment>(`/v1/payments/${encodeURIComponent(id)}`)

export function mapPaymentStatus(status: string): 'PAID' | 'PENDING' | 'FAILED' | 'REFUNDED' {
  switch (status) {
    case 'approved':
      return 'PAID'
    case 'rejected':
    case 'cancelled':
      return 'FAILED'
    case 'refunded':
    case 'charged_back':
      return 'REFUNDED'
    default:
      return 'PENDING'
  }
}
