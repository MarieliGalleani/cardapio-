import { describe, expect, it } from 'vitest'
import { buildPixPayload, crc16, normalizePixKey } from './pix.js'

describe('crc16', () => {
  it('bate com o valor de referência do CRC-16/CCITT-FALSE', () => {
    expect(crc16('123456789')).toBe('29B1')
  })
})

describe('buildPixPayload', () => {
  it('gera o exemplo do manual do Banco Central', () => {
    const payload = buildPixPayload({
      key: '123e4567-e12b-12d1-a456-426655440000',
      keyType: 'RANDOM',
      receiverName: 'Fulano de Tal',
      city: 'BRASILIA',
    })
    expect(payload).toBe(
      '00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***63041D3D',
    )
  })

  it('inclui valor e identificador do pedido, sem acentos', () => {
    const payload = buildPixPayload({
      key: 'loja@doces.com',
      keyType: 'EMAIL',
      receiverName: 'Confeitaria São João',
      city: 'São Carlos',
      amount: 42.5,
      txid: 'PEDIDO-123',
    })
    expect(payload).toContain('540542.50')
    expect(payload).toContain('5920Confeitaria Sao Joao')
    expect(payload).toContain('6010Sao Carlos')
    expect(payload).toContain('62130509PEDIDO123')
    // o CRC no final confere com o resto do texto
    expect(payload.slice(-4)).toBe(crc16(payload.slice(0, -4)))
  })
})

describe('normalizePixKey', () => {
  it('formata telefone com +55 e tira pontuação de CPF', () => {
    expect(normalizePixKey('(16) 99999-8888', 'PHONE')).toBe('+5516999998888')
    expect(normalizePixKey('123.456.789-09', 'CPF')).toBe('12345678909')
  })
})
