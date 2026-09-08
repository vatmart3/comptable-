import { describe, expect, it } from 'vitest'
import {
  affectationResultat,
  carryForward,
  closingChecks,
  COMPTE_RESULTAT_BENEFICE,
  COMPTE_RESULTAT_PERTE,
} from '@/lib/accounting/closing'
import { balanceIsSquare, computeBalance, type StatementLine } from '@/lib/accounting/statements'
import { accountNature } from '@/lib/accounting/account'

function ligne(accountNumero: string, debit: number, credit: number): StatementLine {
  return {
    accountNumero,
    accountLibelle: accountNumero,
    date: new Date('2025-06-15'),
    journalCode: 'OD',
    entryNumero: 1,
    entryId: 'e1',
    libelle: 'x',
    debit,
    credit,
    lettre: null,
  }
}

// Exercice fictif : capital 10 000, matériel 12 000, banque 8 000, client 4 000,
// fournisseur 4 000, report 120 de 2 000, ventes 40 000, achats 32 000.
// Balance carrée : 56 000 au débit comme au crédit. Bénéfice = 8 000.
const BALANCE = computeBalance([
  ligne('101000', 0, 1_000_000),
  ligne('218300', 1_200_000, 0),
  ligne('512000', 800_000, 0),
  ligne('401000', 0, 400_000),
  ligne('706000', 0, 4_000_000),
  ligne('606100', 3_200_000, 0),
  ligne('411000', 400_000, 0),
  ligne('120000', 0, 200_000),
])

describe('à-nouveaux', () => {
  const report = carryForward(BALANCE)

  it('part d’une balance carrée — sinon rien de ce qui suit n’a de sens', () => {
    expect(balanceIsSquare(BALANCE)).toBe(true)
  })

  it('est équilibrée par construction', () => {
    expect(report.equilibree).toBe(true)
    const debit = report.lines.reduce((acc, l) => acc + l.debit, 0)
    const credit = report.lines.reduce((acc, l) => acc + l.credit, 0)
    expect(debit).toBe(credit)
  })

  it('ne reporte AUCUN compte de gestion — c’est la règle', () => {
    for (const line of report.lines) {
      expect(accountNature(line.accountNumero)).not.toBe('gestion')
    }
    expect(report.lines.some((l) => l.accountNumero === '706000')).toBe(false)
    expect(report.lines.some((l) => l.accountNumero === '606100')).toBe(false)
  })

  it('reporte les comptes de bilan à l’identique', () => {
    const materiel = report.lines.find((l) => l.accountNumero === '218300')
    expect(materiel?.debit).toBe(1_200_000)
    const capital = report.lines.find((l) => l.accountNumero === '101000')
    expect(capital?.credit).toBe(1_000_000)
  })

  it('porte le résultat au compte 120000 en cas de bénéfice', () => {
    expect(report.resultat).toBe(800_000)
    expect(report.compteResultat).toBe(COMPTE_RESULTAT_BENEFICE)
    const resultat = report.lines.filter((l) => l.accountNumero === COMPTE_RESULTAT_BENEFICE)
    // Le 120000 de l'exercice précédent (200 000) + le résultat de l'exercice.
    expect(resultat.some((l) => l.credit === 800_000)).toBe(true)
  })

  it('porte le résultat au compte 129000 en cas de perte', () => {
    const deficitaire = computeBalance([
      ligne('101000', 0, 1_000_000),
      ligne('512000', 400_000, 0),
      ligne('706000', 0, 1_000_000),
      ligne('606100', 1_600_000, 0),
    ])
    const report = carryForward(deficitaire)
    expect(report.resultat).toBe(-600_000)
    expect(report.compteResultat).toBe(COMPTE_RESULTAT_PERTE)
    const perte = report.lines.find((l) => l.accountNumero === COMPTE_RESULTAT_PERTE)
    expect(perte?.debit).toBe(600_000)
    expect(report.equilibree).toBe(true)
  })

  it('ne reporte pas les comptes soldés', () => {
    const avecSolde = computeBalance([
      ligne('101000', 0, 1_000_000),
      ligne('512000', 1_000_000, 0),
      ligne('471000', 50_000, 0),
      ligne('471000', 0, 50_000),
    ])
    const report = carryForward(avecSolde)
    expect(report.lines.some((l) => l.accountNumero === '471000')).toBe(false)
  })
})

describe('affectation du résultat', () => {
  it('solde le bénéfice vers réserves et report à nouveau', () => {
    const lignes = affectationResultat({
      resultat: 800_000,
      versReservesLegales: 40_000,
      versDividendes: 300_000,
    })
    const debit = lignes.reduce((acc, l) => acc + l.debit, 0)
    const credit = lignes.reduce((acc, l) => acc + l.credit, 0)
    expect(debit).toBe(credit)
    expect(lignes.find((l) => l.accountNumero === '106100')?.credit).toBe(40_000)
    expect(lignes.find((l) => l.accountNumero === '457000')?.credit).toBe(300_000)
    expect(lignes.find((l) => l.accountNumero === '110000')?.credit).toBe(460_000)
  })

  it('reporte une perte au 119000', () => {
    const lignes = affectationResultat({ resultat: -250_000 })
    expect(lignes.find((l) => l.accountNumero === '119000')?.debit).toBe(250_000)
    expect(lignes.find((l) => l.accountNumero === '129000')?.credit).toBe(250_000)
  })

  it('ne fait rien sur un résultat nul', () => {
    expect(affectationResultat({ resultat: 0 })).toEqual([])
  })
})

describe('contrôles de clôture', () => {
  it('bloque sur un compte d’attente non soldé', () => {
    const balance = computeBalance([ligne('471000', 45_000, 0), ligne('512000', 0, 45_000)])
    const checks = closingChecks(balance)
    const attente = checks.find((c) => c.code === 'compte_attente_non_solde')
    expect(attente?.gravite).toBe(3)
    expect(attente?.montant).toBe(45_000)
  })

  it('bloque sur des virements internes non soldés', () => {
    const balance = computeBalance([ligne('580000', 100_000, 0), ligne('512000', 0, 100_000)])
    expect(closingChecks(balance).some((c) => c.code === 'virements_internes')).toBe(true)
  })

  it('signale un compte client créditeur', () => {
    const balance = computeBalance([ligne('411000', 0, 120_000), ligne('706000', 120_000, 0)])
    expect(closingChecks(balance).some((c) => c.code === 'client_crediteur')).toBe(true)
  })

  it('signale un compte fournisseur débiteur', () => {
    const balance = computeBalance([ligne('401000', 120_000, 0), ligne('512000', 0, 120_000)])
    expect(closingChecks(balance).some((c) => c.code === 'fournisseur_debiteur')).toBe(true)
  })

  it('ne dit rien d’un exercice sain', () => {
    expect(closingChecks(BALANCE)).toEqual([])
  })
})
