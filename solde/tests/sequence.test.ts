import { describe, expect, it } from 'vitest'
import {
  auditSequence,
  findDuplicates,
  findGaps,
  formatEntryNumber,
  nextNumber,
} from '@/lib/accounting/sequence'

describe('numérotation continue', () => {
  it('démarre à 1', () => {
    expect(nextNumber([])).toBe(1)
  })

  it('suit le plus grand numéro attribué', () => {
    expect(nextNumber([1, 2, 3])).toBe(4)
    expect(nextNumber([3, 1, 2])).toBe(4)
  })

  it('ne comble jamais un trou : un numéro brûlé reste brûlé', () => {
    expect(nextNumber([1, 2, 4])).toBe(5)
  })
})

describe('détection des trous — un trou est une présomption de suppression', () => {
  it('ne voit rien dans une séquence pleine', () => {
    expect(findGaps([1, 2, 3, 4])).toEqual([])
  })

  it('désigne les numéros manquants', () => {
    expect(findGaps([1, 2, 4, 7])).toEqual([3, 5, 6])
  })

  it('ne dit rien d’une séquence vide', () => {
    expect(findGaps([])).toEqual([])
  })

  it('repère les doublons', () => {
    expect(findDuplicates([1, 2, 2, 3, 3])).toEqual([2, 3])
  })
})

describe('audit d’un journal', () => {
  it('valide un journal sain', () => {
    expect(auditSequence({ journalCode: 'VE', fiscalYearId: 'ex1', numeros: [1, 2, 3] })).toEqual([])
  })

  it('remonte trou, doublon et départ invalide', () => {
    const problems = auditSequence({
      journalCode: 'AC',
      fiscalYearId: 'ex1',
      numeros: [2, 3, 3, 5],
    })
    const kinds = problems.map((p) => p.kind)
    expect(kinds).toContain('depart_invalide')
    expect(kinds).toContain('trou')
    expect(kinds).toContain('doublon')
    const trou = problems.find((p) => p.kind === 'trou')
    expect(trou?.numeros).toEqual([1, 4])
  })
})

describe('affichage', () => {
  it('formate un numéro de pièce lisible', () => {
    expect(formatEntryNumber('VE', 2025, 42)).toBe('VE-2025-0042')
  })
})
