import { describe, expect, it } from 'vitest'
import {
  baseFromTax,
  buildCa3,
  ca3Entry,
  ca3DueDate,
  COMPTES_TVA,
  fromExclusive,
  fromInclusive,
  inferTaux,
  TAUX,
  type VatLine,
} from '@/lib/accounting/vat'

describe('calcul de TVA', () => {
  it('calcule depuis une base hors taxe', () => {
    expect(fromExclusive(100_000, TAUX.NORMAL)).toEqual({
      ht: 100_000,
      tva: 20_000,
      ttc: 120_000,
      taux: TAUX.NORMAL,
    })
  })

  it('calcule depuis un TTC — le cas réel de la saisie', () => {
    // « payé 240 € de gasoil » : 240 € est un TTC.
    const resultat = fromInclusive(24_000, TAUX.NORMAL)
    expect(resultat.ht).toBe(20_000)
    expect(resultat.tva).toBe(4_000)
    expect(resultat.ht + resultat.tva).toBe(24_000)
  })

  it('ne perd jamais un centime entre HT, TVA et TTC', () => {
    for (const ttc of [999, 1_001, 3_333, 12_345, 999_999]) {
      for (const taux of [TAUX.NORMAL, TAUX.INTERMEDIAIRE, TAUX.REDUIT, TAUX.PARTICULIER]) {
        const r = fromInclusive(ttc, taux)
        expect(r.ht + r.tva).toBe(ttc)
      }
    }
  })

  it('devine le taux appliqué', () => {
    expect(inferTaux(100_000, 20_000)).toBe(TAUX.NORMAL)
    expect(inferTaux(100_000, 5_500)).toBe(TAUX.REDUIT)
    expect(inferTaux(100_000, 7_000)).toBeNull()
  })

  it('reconstitue la base depuis la seule taxe', () => {
    expect(baseFromTax(20_000, TAUX.NORMAL)).toBe(100_000)
    expect(baseFromTax(5_500, TAUX.REDUIT)).toBe(100_000)
    expect(baseFromTax(0, TAUX.EXONERE)).toBe(0)
  })
})

describe('CA3', () => {
  // Trimestre : 50 000 € HT de prestations à 20 %, 10 000 € HT de ventes à 5,5 %,
  // 8 000 € HT d'achats à 20 %, et 12 000 € HT d'immobilisation à 20 %.
  const lignes: VatLine[] = [
    { accountNumero: '706000', debit: 0, credit: 5_000_000 },
    { accountNumero: '445711', debit: 0, credit: 1_000_000 },
    { accountNumero: '707100', debit: 0, credit: 1_000_000 },
    { accountNumero: '445713', debit: 0, credit: 55_000 },
    { accountNumero: '606100', debit: 800_000, credit: 0 },
    { accountNumero: '445660', debit: 160_000, credit: 0 },
    { accountNumero: '218300', debit: 1_200_000, credit: 0 },
    { accountNumero: '445620', debit: 240_000, credit: 0 },
  ]

  it('ventile la TVA collectée par taux', () => {
    const { cases } = buildCa3({ lines: lignes })
    expect(cases['08']).toBe(1_000_000)
    expect(cases['09']).toBe(55_000)
    expect(cases['16']).toBe(1_055_000)
  })

  it('reconstitue les bases hors taxe', () => {
    const { cases } = buildCa3({ lines: lignes })
    expect(cases['01']).toBe(5_000_000 + 1_000_000)
  })

  it('sépare la TVA déductible sur immobilisations de celle sur biens et services', () => {
    const { cases } = buildCa3({ lines: lignes })
    expect(cases['19']).toBe(240_000)
    expect(cases['20']).toBe(160_000)
    expect(cases['23']).toBe(400_000)
  })

  it('calcule la TVA nette due', () => {
    const { cases, tvaNette } = buildCa3({ lines: lignes })
    expect(tvaNette).toBe(1_055_000 - 400_000)
    expect(cases['28']).toBe(655_000)
    expect(cases['27']).toBe(0)
  })

  it('bascule en crédit de TVA quand la déductible dépasse la collectée', () => {
    const { cases, tvaNette } = buildCa3({
      lines: [
        { accountNumero: '445711', debit: 0, credit: 10_000 },
        { accountNumero: '706000', debit: 0, credit: 50_000 },
        { accountNumero: '445620', debit: 500_000, credit: 0 },
        { accountNumero: '218300', debit: 2_500_000, credit: 0 },
      ],
    })
    expect(tvaNette).toBe(-490_000)
    expect(cases['27']).toBe(490_000)
    expect(cases['28']).toBe(0)
  })

  it('reprend le crédit de TVA de la période précédente en case 22', () => {
    const { cases } = buildCa3({ lines: lignes, creditReporte: 100_000 })
    expect(cases['22']).toBe(100_000)
    expect(cases['23']).toBe(500_000)
    expect(cases['28']).toBe(555_000)
  })

  it('signale l’incohérence entre TVA collectée et chiffre d’affaires', () => {
    const { controles } = buildCa3({
      lines: [
        { accountNumero: '445711', debit: 0, credit: 1_000_000 },
        { accountNumero: '706000', debit: 0, credit: 100_000 },
      ],
    })
    const coherence = controles.find((c) => c.code === 'coherence_ca')
    expect(coherence).toBeDefined()
    expect(coherence?.gravite).toBe('bloquant')
  })

  it('bloque si le compte d’attente 471 n’est pas soldé', () => {
    const { controles } = buildCa3({
      lines: [...lignes, { accountNumero: '471000', debit: 45_000, credit: 0 }],
    })
    expect(controles.some((c) => c.code === 'compte_attente')).toBe(true)
  })
})

describe('écriture de déclaration', () => {
  const lignes: VatLine[] = [
    { accountNumero: '706000', debit: 0, credit: 5_000_000 },
    { accountNumero: '445711', debit: 0, credit: 1_000_000 },
    { accountNumero: '445660', debit: 160_000, credit: 0 },
  ]

  it('solde les comptes de TVA et constate la dette', () => {
    const resultat = buildCa3({ lines: lignes })
    const ecriture = ca3Entry(resultat, 'TVA T1 2025')

    const debit = ecriture.reduce((acc, l) => acc + l.debit, 0)
    const credit = ecriture.reduce((acc, l) => acc + l.credit, 0)
    expect(debit).toBe(credit)

    const decaisser = ecriture.find((l) => l.accountNumero === COMPTES_TVA.aDecaisser)
    expect(decaisser?.credit).toBe(840_000)
  })

  it('constate un crédit reportable quand la TVA est négative', () => {
    const resultat = buildCa3({
      lines: [{ accountNumero: '445660', debit: 100_000, credit: 0 }],
    })
    const ecriture = ca3Entry(resultat, 'TVA T1 2025')
    const credit = ecriture.find((l) => l.accountNumero === COMPTES_TVA.creditAReporter)
    expect(credit?.debit).toBe(100_000)
    expect(ecriture.reduce((a, l) => a + l.debit, 0)).toBe(
      ecriture.reduce((a, l) => a + l.credit, 0),
    )
  })
})

describe('échéance', () => {
  it('place la CA3 du mois au 24 du mois suivant', () => {
    const echeance = ca3DueDate(new Date(Date.UTC(2025, 2, 31)))
    expect(echeance.toISOString().slice(0, 10)).toBe('2025-04-24')
  })
})
