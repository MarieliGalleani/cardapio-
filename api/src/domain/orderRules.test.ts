import { describe, expect, it } from 'vitest'
import { localDayRange, nextStatuses, scheduleError, stockAction } from './orderRules.js'

describe('nextStatuses', () => {
  it('segue o fluxo de entrega ou de retirada', () => {
    expect(nextStatuses('RECEIVED', 'DELIVERY')).toEqual(['PREPARING', 'CANCELED'])
    expect(nextStatuses('PREPARING', 'DELIVERY')).toEqual(['OUT_FOR_DELIVERY', 'CANCELED'])
    expect(nextStatuses('PREPARING', 'PICKUP')).toEqual(['READY_FOR_PICKUP', 'CANCELED'])
    expect(nextStatuses('DELIVERED', 'PICKUP')).toEqual([])
    expect(nextStatuses('CANCELED', 'PICKUP')).toEqual([])
  })
})

describe('stockAction', () => {
  it('baixa o estoque quando o pedido é aceito', () => {
    expect(stockAction('RECEIVED', 'PREPARING', false)).toBe('deduct')
  })
  it('não baixa duas vezes', () => {
    expect(stockAction('RECEIVED', 'PREPARING', true)).toBeNull()
    expect(stockAction('PREPARING', 'READY_FOR_PICKUP', true)).toBeNull()
  })
  it('devolve ao estoque só se já tinha baixado', () => {
    expect(stockAction('PREPARING', 'CANCELED', true)).toBe('restore')
    expect(stockAction('RECEIVED', 'CANCELED', false)).toBeNull()
  })
})

describe('scheduleError', () => {
  const now = new Date('2026-09-23T13:00:00Z')
  const base = { now, storeOpen: true, preOrdersEnabled: true, minHours: 24 }

  it('aceita pedido para agora com a loja aberta', () => {
    expect(scheduleError({ ...base, scheduledFor: null })).toBeNull()
  })
  it('bloqueia pedido para agora com a loja fechada', () => {
    expect(scheduleError({ ...base, scheduledFor: null, storeOpen: false })).toMatch(/Escolha uma data/)
    expect(scheduleError({ ...base, scheduledFor: null, storeOpen: false, preOrdersEnabled: false })).toBe(
      'A loja está fechada agora',
    )
  })
  it('exige a antecedência mínima', () => {
    expect(scheduleError({ ...base, scheduledFor: new Date('2026-09-24T10:00:00Z') })).toMatch(/24 horas/)
    expect(scheduleError({ ...base, scheduledFor: new Date('2026-09-24T14:00:00Z') })).toBeNull()
  })
  it('recusa encomenda quando o recurso está desligado', () => {
    expect(scheduleError({ ...base, preOrdersEnabled: false, scheduledFor: new Date('2026-09-30T14:00:00Z') })).toMatch(
      /não aceita/,
    )
  })
})

describe('localDayRange', () => {
  it('usa o dia de São Paulo', () => {
    // 23/09 às 01:00 UTC ainda é 22/09 às 22:00 em São Paulo
    const { start, end } = localDayRange(new Date('2026-09-23T01:00:00Z'))
    expect(start.toISOString()).toBe('2026-09-22T03:00:00.000Z')
    expect(end.toISOString()).toBe('2026-09-23T03:00:00.000Z')
  })
})
