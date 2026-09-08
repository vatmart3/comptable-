import { describe, expect, it } from 'vitest'
import {
  allocate,
  applyRate,
  baseFromInclusive,
  formatAmount,
  formatPlain,
  parseAmount,
  roundHalfUp,
  sumCents,
  toCents,
} from '@/lib/accounting/money'

describe('arrondi', () => {
  it('arrondit la moitié en s’éloignant de zéro', () => {
    expect(roundHalfUp(0.5)).toBe(1)
    expect(roundHalfUp(-0.5)).toBe(-1)
    expect(roundHalfUp(2.5)).toBe(3)
    expect(roundHalfUp(-2.5)).toBe(-3)
  })

  it('diffère de Math.round sur les négatifs — c’est le but', () => {
    expect(Math.round(-0.5)).not.toBe(roundHalfUp(-0.5))
  })
})

describe('conversion', () => {
  it('convertit sans dérive flottante', () => {
    expect(toCents(0.1) + toCents(0.2)).toBe(toCents(0.3))
    expect(toCents(19.99)).toBe(1999)
    expect(toCents(1234.565)).toBe(123457)
  })
})

describe('parseAmount', () => {
  const cases: [string, number | null][] = [
    ['240', 24_000],
    ['240,50', 24_050],
    ['240.50', 24_050],
    ['1 234,56', 123_456],
    ['1 234,56 €', 123_456],
    ['1.234,56', 123_456],
    ['1,234.56', 123_456],
    ['-12,5', -1_250],
    ['0,01', 1],
    ['', null],
    ['abc', null],
    ['12,34,56', null],
  ]
  it.each(cases)('lit « %s »', (input, expected) => {
    expect(parseAmount(input)).toBe(expected)
  })
})

describe('formatage', () => {
  it('formate à la française avec deux décimales', () => {
    // Intl produit une espace fine insécable (U+202F) : c'est la typographie
    // française correcte, et c'est elle qui tient l'alignement des colonnes.
    expect(formatAmount(123_456)).toBe('1\u202f234,56')
    expect(formatAmount(0)).toBe('0,00')
    expect(formatAmount(-5)).toBe('-0,05')
  })

  it('formate en clair pour le FEC — virgule décimale, pas de milliers', () => {
    expect(formatPlain(123_456)).toBe('1234,56')
    expect(formatPlain(0)).toBe('0,00')
    expect(formatPlain(-1_250)).toBe('-12,50')
    expect(formatPlain(5)).toBe('0,05')
  })
})

describe('taux', () => {
  it('applique un taux exact', () => {
    expect(applyRate(10_000, 20_000)).toBe(2_000)
    expect(applyRate(10_000, 5_500)).toBe(550)
    expect(applyRate(999, 20_000)).toBe(200)
  })

  it('retrouve la base depuis un TTC', () => {
    expect(baseFromInclusive(12_000, 20_000)).toBe(10_000)
    expect(baseFromInclusive(24_000, 20_000)).toBe(20_000)
    const ht = baseFromInclusive(10_000, 20_000)
    expect(ht + applyRate(ht, 20_000)).toBe(10_000)
  })
})

describe('allocate', () => {
  it('répartit sans perdre un centime', () => {
    const parts = allocate(100, [1, 1, 1])
    expect(sumCents(parts)).toBe(100)
    expect(parts).toEqual([34, 33, 33])
  })

  it('répartit proportionnellement', () => {
    const parts = allocate(1_000, [3, 1])
    expect(sumCents(parts)).toBe(1_000)
    expect(parts).toEqual([750, 250])
  })

  it('gère un total négatif', () => {
    const parts = allocate(-100, [1, 1, 1])
    expect(sumCents(parts)).toBe(-100)
  })

  it('gère des poids nuls', () => {
    expect(sumCents(allocate(500, [0, 0]))).toBe(500)
  })
})
