import { describe, expect, it } from 'vitest'
import {
  balanceIsSquare,
  balanceSheet,
  computeBalance,
  incomeStatement,
  ratios,
  resultatExercice,
  runningLedger,
  sig,
  soldeInattendu,
  type StatementLine,
} from '@/lib/accounting/statements'

let compteur = 0
function ligne(
  accountNumero: string,
  debit: number,
  credit: number,
  date = '2025-06-15',
): StatementLine {
  compteur += 1
  return {
    accountNumero,
    accountLibelle: accountNumero,
    date: new Date(date),
    journalCode: 'OD',
    entryNumero: compteur,
    entryId: `e${compteur}`,
    libelle: 'x',
    debit,
    credit,
    lettre: null,
  }
}

describe('balance', () => {
  const balance = computeBalance([
    ligne('512000', 100_000, 0),
    ligne('512000', 0, 30_000),
    ligne('706000', 0, 70_000),
  ])

  it('agrège débits et crédits par compte', () => {
    const banque = balance.find((a) => a.numero === '512000')
    expect(banque?.debit).toBe(100_000)
    expect(banque?.credit).toBe(30_000)
    expect(banque?.solde).toBe(70_000)
    expect(banque?.mouvements).toBe(2)
  })

  it('donne le sens du solde', () => {
    expect(balance.find((a) => a.numero === '512000')?.sens).toBe('debit')
    expect(balance.find((a) => a.numero === '706000')?.sens).toBe('credit')
  })

  it('trie dans l’ordre du plan comptable', () => {
    expect(balance.map((a) => a.numero)).toEqual(['512000', '706000'])
  })

  it('vérifie que la balance générale est carrée', () => {
    expect(balanceIsSquare(balance)).toBe(true)
    expect(balanceIsSquare(computeBalance([ligne('512000', 100, 0)]))).toBe(false)
  })
})

describe('grand livre — Le Fil', () => {
  it('calcule le solde progressif dans l’ordre chronologique', () => {
    const rows = runningLedger([
      ligne('512000', 0, 30_000, '2025-03-10'),
      ligne('512000', 100_000, 0, '2025-01-05'),
      ligne('512000', 50_000, 0, '2025-02-01'),
    ])
    expect(rows.map((r) => r.soldeProgressif)).toEqual([100_000, 150_000, 120_000])
  })

  it('part d’un solde initial', () => {
    const rows = runningLedger([ligne('512000', 100_000, 0)], 500_000)
    expect(rows[0]?.soldeProgressif).toBe(600_000)
  })
})

describe('compte de résultat', () => {
  const balance = computeBalance([
    ligne('706000', 0, 10_000_000),
    ligne('607000', 4_000_000, 0),
    ligne('641100', 3_000_000, 0),
    ligne('661100', 200_000, 0),
    ligne('775000', 0, 500_000),
    ligne('675000', 300_000, 0),
    ligne('695000', 400_000, 0),
  ])
  const cr = incomeStatement(balance)

  it('sépare exploitation, financier et exceptionnel', () => {
    expect(cr.resultatExploitation).toBe(3_000_000)
    expect(cr.resultatFinancier).toBe(-200_000)
    expect(cr.resultatExceptionnel).toBe(200_000)
  })

  it('calcule le résultat courant avant impôts', () => {
    expect(cr.resultatCourant).toBe(2_800_000)
  })

  it('déduit l’impôt pour le résultat net', () => {
    expect(cr.resultatNet).toBe(2_600_000)
  })

  it('concorde avec le résultat brut produits − charges', () => {
    expect(resultatExercice(balance)).toBe(2_600_000)
  })
})

describe('soldes intermédiaires de gestion', () => {
  const balance = computeBalance([
    ligne('707000', 0, 20_000_000), // ventes de marchandises
    ligne('607000', 12_000_000, 0), // achats de marchandises
    ligne('706000', 0, 5_000_000), // prestations
    ligne('613200', 2_400_000, 0), // loyer
    ligne('641100', 6_000_000, 0), // salaires
    ligne('645100', 2_000_000, 0), // charges sociales
    ligne('635100', 300_000, 0), // CFE
    ligne('681120', 800_000, 0), // dotations
  ])
  const indicateurs = sig(balance)

  it('calcule la marge commerciale', () => {
    expect(indicateurs.margeCommerciale).toBe(8_000_000)
  })

  it('calcule la production de l’exercice', () => {
    expect(indicateurs.productionExercice).toBe(5_000_000)
  })

  it('déduit les consommations externes pour la valeur ajoutée', () => {
    expect(indicateurs.valeurAjoutee).toBe(8_000_000 + 5_000_000 - 2_400_000)
  })

  it('déduit impôts et personnel pour l’EBE', () => {
    expect(indicateurs.excedentBrutExploitation).toBe(10_600_000 - 300_000 - 8_000_000)
  })

  it('neutralise les dotations dans la CAF', () => {
    expect(indicateurs.capaciteAutofinancement).toBe(indicateurs.resultatNet + 800_000)
  })
})

describe('bilan', () => {
  const balance = computeBalance([
    ligne('101000', 0, 5_000_000),
    ligne('218300', 1_200_000, 0),
    ligne('281830', 0, 240_000),
    ligne('370000', 800_000, 0),
    ligne('411000', 2_400_000, 0),
    ligne('512000', 3_040_000, 0),
    ligne('401000', 0, 1_200_000),
    ligne('706000', 0, 4_000_000),
    ligne('607000', 3_000_000, 0),
  ])

  it('part d’une balance carrée', () => {
    expect(balanceIsSquare(balance)).toBe(true)
  })

  it('équilibre actif et passif — résultat compris', () => {
    const bilan = balanceSheet(balance)
    expect(bilan.ecart).toBe(0)
    expect(bilan.actif.total).toBe(bilan.passif.total)
  })

  it('présente les immobilisations en brut, amortissements et net', () => {
    const bilan = balanceSheet(balance)
    expect(bilan.actif.immobilisationsBrutes).toBe(1_200_000)
    expect(bilan.actif.amortissements).toBe(240_000)
    expect(bilan.actif.immobilisationsNettes).toBe(960_000)
  })

  it('porte le résultat au passif', () => {
    expect(balanceSheet(balance).passif.resultat).toBe(1_000_000)
  })
})

describe('ratios', () => {
  it('calcule marge nette et délai clients', () => {
    const balance = computeBalance([
      ligne('706000', 0, 10_000_000),
      ligne('607000', 8_000_000, 0),
      ligne('411000', 1_200_000, 0),
      ligne('445711', 0, 2_000_000),
      ligne('512000', 800_000, 0),
      ligne('101000', 0, 2_000_000),
    ])
    const r = ratios(balance)
    expect(r.margeNette).toBe(200) // 20,0 %
    expect(r.delaiClients).toBe(37)
  })
})

describe('sens des soldes', () => {
  it('signale un compte au solde inversé', () => {
    const balance = computeBalance([ligne('606100', 0, 100_000), ligne('512000', 100_000, 0)])
    const charge = balance.find((a) => a.numero === '606100')
    expect(charge && soldeInattendu(charge)).toBe(true)
  })

  it('ne signale pas un compte mixte au solde créditeur', () => {
    const balance = computeBalance([ligne('512000', 0, 100_000), ligne('706000', 100_000, 0)])
    const banque = balance.find((a) => a.numero === '512000')
    expect(banque && soldeInattendu(banque)).toBe(false)
  })
})
