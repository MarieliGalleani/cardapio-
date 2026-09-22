// Status da loja visto pelo cliente: aberta, fechada ou pausada.

export interface OpeningHour {
  day: number // 0 = domingo … 6 = sábado
  open: string // "09:00"
  close: string // "18:00"
}

export interface StoreStatusInput {
  isOpen: boolean // chave geral do dono
  pausedUntil: Date | null
  openingHours: OpeningHour[]
}

export type StoreStatus =
  | { state: 'OPEN' }
  | { state: 'PAUSED'; until: Date }
  | { state: 'CLOSED'; opensAt: { day: number; time: string } | null }

const TIME_ZONE = 'America/Sao_Paulo'
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function localDayAndMinutes(now: Date): { day: number; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  const get = (t: string) => parts.find((p) => p.type === t)!.value
  return { day: DAYS.indexOf(get('weekday')), minutes: Number(get('hour')) * 60 + Number(get('minute')) }
}

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export function storeStatus(s: StoreStatusInput, now = new Date()): StoreStatus {
  if (!s.isOpen) return { state: 'CLOSED', opensAt: null }
  if (s.pausedUntil && s.pausedUntil > now) return { state: 'PAUSED', until: s.pausedUntil }
  if (s.openingHours.length === 0) return { state: 'OPEN' } // sem horários: vale só a chave geral

  const { day, minutes } = localDayAndMinutes(now)
  const today = s.openingHours.filter((h) => h.day === day)
  if (today.some((h) => minutes >= toMinutes(h.open) && minutes < toMinutes(h.close))) {
    return { state: 'OPEN' }
  }

  // Próxima abertura: ainda hoje ou nos próximos 7 dias
  for (let offset = 0; offset < 7; offset++) {
    const d = (day + offset) % 7
    const candidates = s.openingHours
      .filter((h) => h.day === d && (offset > 0 || toMinutes(h.open) > minutes))
      .sort((a, b) => toMinutes(a.open) - toMinutes(b.open))
    if (candidates[0]) return { state: 'CLOSED', opensAt: { day: d, time: candidates[0].open } }
  }
  return { state: 'CLOSED', opensAt: null }
}
