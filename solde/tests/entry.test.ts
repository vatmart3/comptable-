import { describe, expect, it } from 'vitest'
import {
  checkEntry,
  entrySchema,
  isBalanced,
  lineSchema,
  reverse,
  totals,
  type EntryLine,
} from '@/lib/accounting/entry'

function ligne(accountNumero: string, debit: number, credit: number): EntryLine {
  return lineSchema.parse({ accountNumero, debit, credit, libelle: 'Test' })
}

describe('équilibre — l’invariant fondateur', () => {
  it('reconnaît une écriture équilibrée', () => {
    const lines = [ligne('606100', 20_000, 0), ligne('445660', 4_000, 0), ligne('512000', 0, 24_000)]
    expect(isBalanced(lines)).toBe(true)
    expect(totals(lines).ecart).toBe(0)
  })

  it('mesure l’écart signé — la balance penche du côté du signe', () => {
    const lines = [ligne('606100', 20_000, 0), ligne('512000', 0, 19_000)]
    expect(totals(lines).ecart).toBe(1_000)
    expect(isBalanced(lines)).toBe(false)
  })

  it('refuse d’enregistrer une écriture déséquilibrée', () => {
    const problems = checkEntry({
      lines: [ligne('606100', 20_000, 0), ligne('512000', 0, 19_000)],
      date: new Date('2025-03-04'),
    })
    expect(problems.map((p) => p.code)).toContain('desequilibre')
  })
})

describe('unilatéralité des lignes', () => {
  it('refuse une ligne portant débit ET crédit', () => {
    expect(() =>
      lineSchema.parse({ accountNumero: '606100', debit: 100, credit: 100, libelle: 'x' }),
    ).toThrow()
  })

  it('refuse une ligne sans montant', () => {
    expect(() =>
      lineSchema.parse({ accountNumero: '606100', debit: 0, credit: 0, libelle: 'x' }),
    ).toThrow()
  })

  it('refuse un montant négatif', () => {
    expect(() =>
      lineSchema.parse({ accountNumero: '606100', debit: -100, credit: 0, libelle: 'x' }),
    ).toThrow()
  })
})

describe('contrôles de période', () => {
  const periode = {
    dateDebut: new Date('2025-01-01'),
    dateFin: new Date('2025-12-31'),
    statut: 'ouvert' as const,
  }

  it('refuse une date hors exercice', () => {
    const problems = checkEntry(
      { lines: [ligne('606100', 100, 0), ligne('512000', 0, 100)], date: new Date('2026-02-01') },
      periode,
    )
    expect(problems.map((p) => p.code)).toContain('date_hors_exercice')
  })

  it('refuse toute écriture sur un exercice clôturé', () => {
    const problems = checkEntry(
      { lines: [ligne('606100', 100, 0), ligne('512000', 0, 100)], date: new Date('2025-06-01') },
      { ...periode, statut: 'cloture' },
    )
    expect(problems.map((p) => p.code)).toContain('exercice_clos')
  })
})

describe('contre-passation', () => {
  it('inverse débits et crédits et reste équilibrée', () => {
    const originale = {
      libelle: 'Facture Total',
      pieceRef: 'FA-2025-014',
      lines: [ligne('606100', 20_000, 0), ligne('445660', 4_000, 0), ligne('512000', 0, 24_000)],
    }
    const extourne = reverse(originale, { date: new Date('2025-04-02'), journalCode: 'OD' })

    expect(isBalanced(extourne.lines)).toBe(true)
    expect(extourne.lines[0]?.credit).toBe(20_000)
    expect(extourne.lines[0]?.debit).toBe(0)
    expect(extourne.lines[2]?.debit).toBe(24_000)
    expect(extourne.libelle).toContain('Extourne')
    expect(extourne.origine).toBe('contrepassation')
    expect(extourne.pieceRef).toBe('FA-2025-014')
  })

  it('ne reprend pas le lettrage de l’écriture d’origine', () => {
    const lettree = { ...ligne('411000', 12_000, 0), lettre: 'A' }
    const extourne = reverse(
      { libelle: 'x', pieceRef: null, lines: [lettree, ligne('706000', 0, 12_000)] },
      { date: new Date('2025-05-01'), journalCode: 'OD' },
    )
    expect(extourne.lines[0]?.lettre).toBeNull()
  })
})

describe('schéma d’écriture', () => {
  it('exige au moins deux lignes', () => {
    expect(() =>
      entrySchema.parse({
        journalCode: 'AC',
        date: new Date('2025-01-01'),
        libelle: 'Solo',
        lines: [{ accountNumero: '606100', debit: 100, credit: 0, libelle: 'x' }],
      }),
    ).toThrow()
  })

  it('refuse un compte hors plan comptable', () => {
    expect(() =>
      lineSchema.parse({ accountNumero: '906100', debit: 100, credit: 0, libelle: 'x' }),
    ).toThrow()
  })
})
