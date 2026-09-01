import { describe, expect, it } from 'vitest'
import {
  appliquerTaux,
  arrondi,
  baseDepuisTTC,
  enEuros,
  euros,
  formatMontant,
  parseMontant,
  repartir,
  somme,
  ttcDepuisHT,
  tvaSurBase,
} from './montant'

describe('arrondi comptable', () => {
  it('arrondit le demi en s’éloignant de zéro', () => {
    expect(arrondi(0.5)).toBe(1)
    expect(arrondi(-0.5)).toBe(-1)
    expect(arrondi(1.4999)).toBe(1)
    expect(arrondi(-2.5)).toBe(-3)
  })

  it('convertit les euros en centimes sans erreur de flottant', () => {
    expect(euros(12.34)).toBe(1234)
    expect(euros(0.07)).toBe(7)
    expect(euros(1234.565)).toBe(123457)
    expect(euros(-19.99)).toBe(-1999)
    expect(enEuros(123456)).toBe(1234.56)
  })
})

describe('lecture d’un montant saisi', () => {
  it('accepte les formes que l’étudiant tape', () => {
    expect(parseMontant('1 234,56')).toBe(123456)
    expect(parseMontant('1234.56')).toBe(123456)
    expect(parseMontant('1 234,56 €')).toBe(123456)
    expect(parseMontant('1.234,56')).toBe(123456)
    expect(parseMontant('-12,3')).toBe(-1230)
    expect(parseMontant('0')).toBe(0)
    expect(parseMontant('12,')).toBe(1200)
  })

  it('refuse ce qui n’est pas un montant', () => {
    expect(parseMontant('')).toBeNull()
    expect(parseMontant('abc')).toBeNull()
    expect(parseMontant('12,3,4')).toBeNull()
    expect(parseMontant('-')).toBeNull()
  })
})

describe('rendu d’un montant', () => {
  it('sépare les milliers et fixe deux décimales', () => {
    expect(formatMontant(123456789)).toBe('1 234 567,89')
    expect(formatMontant(5)).toBe('0,05')
    expect(formatMontant(-1999)).toBe('-19,99')
    expect(formatMontant(0, { zeroVide: true })).toBe('')
  })

  it('se relit sans perte', () => {
    for (const centimes of [0, 5, 999, 123456789, -4207]) {
      expect(parseMontant(formatMontant(centimes))).toBe(centimes)
    }
  })
})

describe('taux et TVA', () => {
  it('calcule la TVA sur une base hors taxes', () => {
    expect(tvaSurBase(100000, 2000)).toBe(20000)
    expect(tvaSurBase(12345, 550)).toBe(679)
    expect(tvaSurBase(1, 2000)).toBe(0)
    expect(tvaSurBase(3, 2000)).toBe(1)
  })

  it('remonte du toutes taxes à la base', () => {
    expect(baseDepuisTTC(120000, 2000)).toBe(100000)
    expect(baseDepuisTTC(10550, 550)).toBe(10000)
  })

  it('n’arrondit qu’une fois entre le hors taxes et le toutes taxes', () => {
    expect(ttcDepuisHT(12345, 2000)).toBe(14814)
    expect(appliquerTaux(12345, 2000)).toBe(2469)
  })
})

describe('répartition sans perte de centime', () => {
  it('conserve le total', () => {
    const parts = repartir(10000, [1, 1, 1])
    expect(somme(parts)).toBe(10000)
    expect(parts).toEqual([3334, 3333, 3333])
  })

  it('donne le reliquat aux parts les plus lourdes', () => {
    const parts = repartir(1000, [7000, 3000])
    expect(somme(parts)).toBe(1000)
    expect(parts).toEqual([700, 300])
  })

  it('accepte un montant négatif', () => {
    const parts = repartir(-1000, [1, 1, 1])
    expect(somme(parts)).toBe(-1000)
  })

  it('ne divise pas par zéro', () => {
    expect(repartir(500, [0, 0])).toEqual([0, 0])
  })
})
