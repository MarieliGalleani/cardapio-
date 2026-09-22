// Gera o "Pix copia e cola" (BR Code estático) seguindo o padrão EMV do Banco Central.
// O mesmo texto vira o QR Code. O dinheiro cai direto na chave da loja; a
// confirmação do pagamento é feita pelo dono no painel.

export type PixKeyType = 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'RANDOM'

export interface PixInput {
  key: string
  keyType: PixKeyType | null
  receiverName: string
  city: string
  amount?: number
  txid?: string // identificador do pedido (até 25 letras e números)
}

const field = (id: string, value: string) => `${id}${value.length.toString().padStart(2, '0')}${value}`

// Remove acentos e caracteres fora do padrão aceito pelos bancos
const clean = (text: string, max: number) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9 .\-]/g, '')
    .trim()
    .slice(0, max)

export function normalizePixKey(key: string, type: PixKeyType | null): string {
  const k = key.trim()
  switch (type) {
    case 'CPF':
    case 'CNPJ':
      return k.replace(/\D/g, '')
    case 'PHONE': {
      const digits = k.replace(/\D/g, '')
      return `+${digits.startsWith('55') ? digits : `55${digits}`}`
    }
    case 'EMAIL':
      return k.toLowerCase()
    default:
      return k
  }
}

// CRC16-CCITT (polinômio 0x1021, valor inicial 0xFFFF), exigido no campo 63
export function crc16(payload: string): string {
  let crc = 0xffff
  for (const byte of Buffer.from(payload, 'utf8')) {
    crc ^= byte << 8
    for (let i = 0; i < 8; i++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

export function buildPixPayload(p: PixInput): string {
  const txid = (p.txid ?? '').replace(/[^A-Za-z0-9]/g, '').slice(0, 25) || '***'
  const merchantAccount = field('00', 'br.gov.bcb.pix') + field('01', normalizePixKey(p.key, p.keyType))

  const payload =
    field('00', '01') +
    field('26', merchantAccount) +
    field('52', '0000') +
    field('53', '986') + // real
    (p.amount && p.amount > 0 ? field('54', p.amount.toFixed(2)) : '') +
    field('58', 'BR') +
    field('59', clean(p.receiverName, 25) || 'LOJA') +
    field('60', clean(p.city, 15) || 'BRASIL') +
    field('62', field('05', txid)) +
    '6304'

  return payload + crc16(payload)
}
