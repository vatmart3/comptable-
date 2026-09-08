/**
 * Le seed de démonstration est du code livré : il doit être testé comme tel.
 * Une démo fausse est pire qu'une démo absente — elle donne confiance à tort.
 */
import { describe, expect, it } from 'vitest'
import { genererDemo } from '@/prisma/data/demo'
import { isBalanced, totals } from '@/lib/accounting/entry'
import { computeBalance, balanceIsSquare, balanceSheet, incomeStatement, type StatementLine } from '@/lib/accounting/statements'
import { isValidAccountNumber } from '@/lib/accounting/account'
import { PCG } from '@/prisma/data/pcg'

const ANNEE = 2025
const ECRITURES = genererDemo(ANNEE)

function enLignesDeBalance(): StatementLine[] {
  return ECRITURES.flatMap((ecriture, index) =>
    ecriture.lines.map((ligne) => ({
      accountNumero: ligne.accountNumero,
      accountLibelle: ligne.accountNumero,
      date: ecriture.date,
      journalCode: ecriture.journalCode,
      entryNumero: index + 1,
      entryId: `e${index}`,
      libelle: ligne.libelle,
      debit: ligne.debit,
      credit: ligne.credit,
      lettre: null,
    })),
  )
}

describe('génération de la démonstration', () => {
  it('est déterministe : deux appels donnent exactement la même année', () => {
    expect(JSON.stringify(genererDemo(ANNEE))).toBe(JSON.stringify(genererDemo(ANNEE)))
  })

  it('produit une année entière d’activité', () => {
    expect(ECRITURES.length).toBeGreaterThan(120)
    const mois = new Set(ECRITURES.map((ecriture) => ecriture.date.getUTCMonth()))
    expect(mois.size).toBe(12)
  })

  it('reste dans l’exercice', () => {
    for (const ecriture of ECRITURES) {
      expect(ecriture.date.getUTCFullYear()).toBe(ANNEE)
    }
  })

  it('est triée chronologiquement', () => {
    for (let index = 1; index < ECRITURES.length; index += 1) {
      expect(ECRITURES[index]!.date.getTime()).toBeGreaterThanOrEqual(
        ECRITURES[index - 1]!.date.getTime(),
      )
    }
  })

  it('n’émet que des écritures équilibrées', () => {
    for (const ecriture of ECRITURES) {
      expect(isBalanced(ecriture.lines), `${ecriture.libelle} du ${ecriture.date.toISOString()}`).toBe(true)
    }
  })

  it('n’émet que des lignes unilatérales et non nulles', () => {
    for (const ecriture of ECRITURES) {
      for (const ligne of ecriture.lines) {
        expect((ligne.debit > 0) !== (ligne.credit > 0)).toBe(true)
        expect(Number.isSafeInteger(ligne.debit + ligne.credit)).toBe(true)
      }
    }
  })

  it('n’utilise que des comptes du plan seedé', () => {
    const connus = new Set(PCG.map((compte) => compte.numero))
    for (const ecriture of ECRITURES) {
      for (const ligne of ecriture.lines) {
        expect(isValidAccountNumber(ligne.accountNumero)).toBe(true)
        expect(connus.has(ligne.accountNumero), `compte ${ligne.accountNumero} hors PCG`).toBe(true)
      }
    }
  })

  it('n’utilise que les journaux seedés', () => {
    const journaux = new Set(ECRITURES.map((ecriture) => ecriture.journalCode))
    expect([...journaux].sort()).toEqual(['AC', 'AN', 'BQ', 'OD', 'VE'])
  })

  it('ouvre l’exercice par une écriture d’à-nouveaux équilibrée', () => {
    const premiere = ECRITURES[0]
    expect(premiere?.journalCode).toBe('AN')
    expect(premiere?.date.toISOString().slice(0, 10)).toBe(`${ANNEE}-01-01`)
    expect(totals(premiere!.lines).ecart).toBe(0)
  })
})

describe('vraisemblance comptable de la démonstration', () => {
  const balance = computeBalance(enLignesDeBalance())

  it('produit une balance générale carrée', () => {
    expect(balanceIsSquare(balance)).toBe(true)
  })

  it('produit un bilan qui s’équilibre', () => {
    expect(balanceSheet(balance).ecart).toBe(0)
  })

  it('décrit un studio rentable, pas une entreprise en perte', () => {
    const cr = incomeStatement(balance)
    expect(cr.resultatNet).toBeGreaterThan(0)
    const ca = -balance
      .filter((compte) => compte.numero.startsWith('70'))
      .reduce((total, compte) => total + compte.solde, 0)
    expect(ca).toBeGreaterThan(15_000_000) // au moins 150 000 €
  })

  it('laisse des créances clients ouvertes à la clôture — il faut bien lettrer', () => {
    const clients = balance.find((compte) => compte.numero === '411000')
    expect(clients?.solde).toBeGreaterThan(0)
  })

  it('laisse une trésorerie positive', () => {
    const banque = balance.find((compte) => compte.numero === '512000')
    expect(banque?.solde).toBeGreaterThan(0)
  })

  it('collecte plus de TVA qu’elle n’en déduit — c’est une activité de services', () => {
    const collectee = -(balance.find((compte) => compte.numero === '445711')?.solde ?? 0)
    const deductible = balance
      .filter((compte) => compte.numero.startsWith('4456'))
      .reduce((total, compte) => total + compte.solde, 0)
    expect(collectee).toBeGreaterThan(deductible)
  })
})
