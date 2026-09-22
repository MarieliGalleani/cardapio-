import { EventEmitter } from 'node:events'

// Avisos internos para as telas em tempo real (painel de pedidos e acompanhamento do cliente)
export interface OrderEvent {
  type: 'created' | 'updated'
  orderId: string
  publicToken: string
}

export const events = new EventEmitter()
events.setMaxListeners(0)

export const emitOrder = (e: OrderEvent) => events.emit('order', e)
