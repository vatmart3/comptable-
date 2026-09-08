import { describe, expect, it } from 'vitest'
import {
  auditFec,
  buildFec,
  FEC_FIELDS,
  FEC_SEPARATOR,
  fecDate,
  fecFileName,
  fecField,
  fecRow,
  parseFecAmount,
  type FecSourceLine,
} from '@/lib/accounting/fec'

function source(overrides: Partial<FecSourceLine> = {}): FecSourceLine {
  return {
    journalCode: 'VE',
    journalLib: 'Ventes',
    ecritureNum: '42',
    ecritureDate: new Date(Date.UTC(2025, 2, 14)),
    compteNum: '411000',
    compteLib: 'Clients',
    compAuxNum: 'CLIDUP',
    compAuxLib: 'Dupont SARL',
    pieceRef: 'FA-2025-0042',
    pieceDate: new Date(Date.UTC(2025, 2, 14)),
    ecritureLib: 'Facture Dupont',
    debit: 120_000,
    credit: 0,
    ecritureLet: 'A',
    dateLet: new Date(Date.UTC(2025, 3, 2)),
    validDate: new Date(Date.UTC(2025, 2, 15)),
    montantDevise: null,
    idevise: null,
    ...overrides,
  }
}

describe('structure du fichier', () => {
  it('déclare les 18 champs réglementaires dans l’ordre', () => {
    expect(FEC_FIELDS).toHaveLength(18)
    expect(FEC_FIELDS[0]).toBe('JournalCode')
    expect(FEC_FIELDS[11]).toBe('Debit')
    expect(FEC_FIELDS[12]).toBe('Credit')
    expect(FEC_FIELDS[17]).toBe('Idevise')
  })

  it('sépare par le pipe', () => {
    expect(FEC_SEPARATOR).toBe('|')
    expect(fecRow(source()).split('|')).toHaveLength(18)
  })

  it('produit un en-tête conforme', () => {
    const fichier = buildFec([source()])
    expect(fichier.split('\r\n')[0]).toBe(FEC_FIELDS.join('|'))
  })

  it('termine les lignes par CRLF', () => {
    expect(buildFec([source()]).endsWith('\r\n')).toBe(true)
  })
})

describe('formats', () => {
  it('date les écritures en AAAAMMJJ, en UTC', () => {
    expect(fecDate(new Date(Date.UTC(2025, 0, 5)))).toBe('20250105')
    expect(fecDate(new Date(Date.UTC(2025, 11, 31)))).toBe('20251231')
    expect(fecDate(null)).toBe('')
  })

  it('écrit les montants avec une virgule décimale et deux décimales', () => {
    const cells = fecRow(source({ debit: 123_456, credit: 0 })).split('|')
    expect(cells[11]).toBe('1234,56')
    expect(cells[12]).toBe('0,00')
  })

  it('neutralise le séparateur présent dans un libellé', () => {
    expect(fecField('Facture | Dupont')).toBe('Facture Dupont')
    const cells = fecRow(source({ ecritureLib: 'Avoir | remise\nfin d’année' })).split('|')
    expect(cells).toHaveLength(18)
    expect(cells[10]).not.toContain('|')
  })

  it('relit un montant FEC', () => {
    expect(parseFecAmount('1234,56')).toBe(123_456)
    expect(parseFecAmount('1234.56')).toBe(123_456)
    expect(parseFecAmount('0,00')).toBe(0)
    expect(parseFecAmount('')).toBe(0)
    expect(parseFecAmount('1 234,56')).toBeNull()
  })
})

describe('nom du fichier', () => {
  it('suit le format SIRENFECAAAAMMJJ.txt', () => {
    expect(fecFileName('812345678', new Date(Date.UTC(2025, 11, 31)))).toBe('812345678FEC20251231.txt')
  })

  it('ne retient que les 9 chiffres du SIREN', () => {
    expect(fecFileName('812 345 678 00019', new Date(Date.UTC(2025, 11, 31)))).toBe(
      '812345678FEC20251231.txt',
    )
  })
})

describe('audit du fichier produit', () => {
  const lignes = [
    source(),
    source({
      compteNum: '706000',
      compteLib: 'Prestations de services',
      compAuxNum: null,
      compAuxLib: null,
      debit: 0,
      credit: 100_000,
      ecritureLet: null,
      dateLet: null,
    }),
    source({
      compteNum: '445711',
      compteLib: 'TVA collectée 20 %',
      compAuxNum: null,
      compAuxLib: null,
      debit: 0,
      credit: 20_000,
      ecritureLet: null,
      dateLet: null,
    }),
  ]

  it('valide un fichier conforme et équilibré', () => {
    expect(auditFec(buildFec(lignes))).toEqual([])
  })

  it('refuse un fichier déséquilibré', () => {
    const bancal = buildFec([lignes[0]!, lignes[1]!])
    const problems = auditFec(bancal)
    expect(problems.some((p) => p.message.includes('déséquilibré'))).toBe(true)
  })

  it('refuse une ligne portant débit et crédit', () => {
    const problems = auditFec(buildFec([source({ debit: 100, credit: 100 })]))
    expect(problems.some((p) => p.champ === 'Debit' && p.message.includes('même ligne'))).toBe(true)
  })

  it('refuse un lettrage sans date de lettrage', () => {
    const problems = auditFec(buildFec([source({ ecritureLet: 'A', dateLet: null })]))
    expect(problems.some((p) => p.champ === 'EcritureLet')).toBe(true)
  })

  it('refuse un champ obligatoire vide', () => {
    const problems = auditFec(buildFec([source({ ecritureLib: '' })]))
    expect(problems.some((p) => p.champ === 'EcritureLib')).toBe(true)
  })

  it('refuse un en-tête altéré', () => {
    const fichier = buildFec(lignes).replace('JournalCode', 'Journal')
    expect(auditFec(fichier).some((p) => p.champ === 'JournalCode')).toBe(true)
  })

  it('refuse un nombre de colonnes incorrect', () => {
    const fichier = buildFec(lignes).replace('\r\nVE|Ventes|42', '\r\nVE|Ventes')
    expect(auditFec(fichier).some((p) => p.champ === 'structure')).toBe(true)
  })

  it('refuse un fichier vide', () => {
    expect(auditFec('')).toHaveLength(1)
  })
})
