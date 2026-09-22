import { describe, expect, it } from 'vitest'
import { storeStatus } from './storeStatus.js'

// Quarta-feira, 23/09/2026, 10:00 em São Paulo (UTC−3)
const wedMorning = new Date('2026-09-23T13:00:00Z')
const hours = [
  { day: 3, open: '09:00', close: '18:00' },
  { day: 4, open: '09:00', close: '18:00' },
]

describe('storeStatus', () => {
  it('respeita a chave geral de loja fechada', () => {
    expect(storeStatus({ isOpen: false, pausedUntil: null, openingHours: [] }, wedMorning)).toEqual({
      state: 'CLOSED',
      opensAt: null,
    })
  })

  it('fica aberta sem horários cadastrados', () => {
    expect(storeStatus({ isOpen: true, pausedUntil: null, openingHours: [] }, wedMorning).state).toBe('OPEN')
  })

  it('mostra pausada até o horário da pausa', () => {
    const until = new Date('2026-09-23T14:00:00Z')
    expect(storeStatus({ isOpen: true, pausedUntil: until, openingHours: hours }, wedMorning)).toEqual({
      state: 'PAUSED',
      until,
    })
  })

  it('ignora pausa que já passou', () => {
    const past = new Date('2026-09-23T12:00:00Z')
    expect(storeStatus({ isOpen: true, pausedUntil: past, openingHours: hours }, wedMorning).state).toBe('OPEN')
  })

  it('abre dentro do horário, no fuso de São Paulo', () => {
    expect(storeStatus({ isOpen: true, pausedUntil: null, openingHours: hours }, wedMorning).state).toBe('OPEN')
  })

  it('informa a próxima abertura quando fechada', () => {
    const wedNight = new Date('2026-09-24T00:00:00Z') // quarta 21:00
    expect(storeStatus({ isOpen: true, pausedUntil: null, openingHours: hours }, wedNight)).toEqual({
      state: 'CLOSED',
      opensAt: { day: 4, time: '09:00' },
    })
  })
})
