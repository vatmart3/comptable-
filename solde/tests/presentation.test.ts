/**
 * Bilan, compte de résultat, balance : les documents que l'étudiant doit
 * savoir dresser. Si l'atelier les présente faux, il lui apprend faux.
 */
import { describe, expect, it } from 'vitest'
import { computeBalance, type StatementLine } from '@/lib/accounting/statements'
import { balanceQuatreColonnes, bilan, compteDeResultat } from '@/lib/accounting/presentation'

let n = 0
function l(numero: string, debit: number, credit: number, libelle = numero): StatementLine {
  n += 1
  return {
    accountNumero: numero,
    accountLibelle: libelle,
    date: new Date('2025-06-01'),
    journalCode: 'OD',
    entryNumero: n,
    entryId: `e${n}`,
    libelle,
    debit,
    credit,
    lettre: null,
  }
}

// Cas d'école : une entreprise avec immobilisation amortie, stock déprécié,
// clients dépréciés, fournisseurs, emprunt, et un bénéfice de 23 000 €.
// La balance est carrée à 168 000 € — sans quoi rien de ce qui suit n'aurait
// de sens, et c'est la première chose que le test vérifie.
const BALANCE = computeBalance([
  l('101000', 0, 5_000_000, 'Capital'),
  l('164000', 0, 1_200_000, 'Emprunt'),
  l('218300', 2_400_000, 0, 'Matériel informatique'),
  l('281830', 0, 480_000, 'Amortissements matériel'),
  l('370000', 900_000, 0, 'Stock de marchandises'),
  l('397000', 0, 60_000, 'Dépréciation du stock'),
  l('411000', 1_800_000, 0, 'Clients'),
  l('491000', 0, 120_000, 'Dépréciation des clients'),
  l('512000', 4_960_000, 0, 'Banque'),
  l('401000', 0, 800_000, 'Fournisseurs'),
  l('445711', 0, 200_000, 'TVA collectée'),
  l('445660', 100_000, 0, 'TVA déductible'),
  l('607000', 4_000_000, 0, 'Achats de marchandises'),
  l('613200', 600_000, 0, 'Loyer'),
  l('641100', 1_500_000, 0, 'Salaires'),
  l('681120', 480_000, 0, 'Dotation aux amortissements'),
  l('661100', 60_000, 0, 'Intérêts'),
  l('707000', 0, 8_000_000, 'Ventes de marchandises'),
  l('706000', 0, 940_000, 'Prestations'),
])

describe('bilan', () => {
  const b = bilan(BALANCE)

  it('part d’une balance carrée', () => {
    const debit = BALANCE.reduce((total, compte) => total + compte.debit, 0)
    const credit = BALANCE.reduce((total, compte) => total + compte.credit, 0)
    expect(debit).toBe(credit)
  })

  it('s’équilibre — actif = passif', () => {
    expect(b.ecart).toBe(0)
    expect(b.totalActif).toBe(b.totalPassif)
  })

  it('présente l’actif en brut, amortissements et net', () => {
    const corporelles = b.actif[0]?.lignes.find((ligne) => ligne.code === 'AI2')
    expect(corporelles?.brut).toBe(2_400_000)
    expect(corporelles?.amortissements).toBe(480_000)
    expect(corporelles?.net).toBe(1_920_000)
  })

  it('déduit les dépréciations du stock et des créances, sans les mettre au passif', () => {
    const stocks = b.actif[1]?.lignes.find((ligne) => ligne.code === 'AC1')
    expect(stocks?.amortissements).toBe(60_000)
    expect(stocks?.net).toBe(840_000)

    const clients = b.actif[1]?.lignes.find((ligne) => ligne.code === 'AC2')
    expect(clients?.net).toBe(1_680_000)

    // Aucun compte 39 ou 49 ne doit apparaître au passif.
    const comptesPassif = b.passif.flatMap((bloc) => bloc.lignes.flatMap((ligne) => ligne.comptes))
    expect(comptesPassif.some((compte) => compte.numero.startsWith('39'))).toBe(false)
    expect(comptesPassif.some((compte) => compte.numero.startsWith('49'))).toBe(false)
  })

  it('porte le résultat dans les capitaux propres', () => {
    const resultat = b.passif[0]?.lignes.find((ligne) => ligne.code === 'CP5')
    expect(resultat?.net).toBe(b.resultat)
    expect(b.resultat).toBe(2_300_000)
    expect(resultat?.libelle).toContain('bénéfice')
  })

  it('classe la TVA collectée en dettes et la TVA déductible en créances', () => {
    const dettesFiscales = b.passif[1]?.lignes.find((ligne) => ligne.code === 'DE3')
    expect(dettesFiscales?.net).toBe(200_000)

    const autresCreances = b.actif[1]?.lignes.find((ligne) => ligne.code === 'AC3')
    expect(autresCreances?.net).toBe(100_000)
  })

  it('sépare emprunts et dettes fournisseurs', () => {
    expect(b.passif[1]?.lignes.find((ligne) => ligne.code === 'DE1')?.net).toBe(1_200_000)
    expect(b.passif[1]?.lignes.find((ligne) => ligne.code === 'DE2')?.net).toBe(800_000)
  })

  it('annonce une perte quand le résultat est négatif', () => {
    const deficitaire = computeBalance([
      l('101000', 0, 1_000_000),
      l('512000', 400_000, 0),
      l('607000', 900_000, 0),
      l('707000', 0, 300_000),
    ])
    const perte = bilan(deficitaire)
    expect(perte.resultat).toBe(-600_000)
    expect(perte.ecart).toBe(0)
    expect(perte.passif[0]?.lignes.find((ligne) => ligne.code === 'CP5')?.libelle).toContain('perte')
  })
})

describe('compte de résultat', () => {
  const cr = compteDeResultat(BALANCE)

  it('classe les charges par nature', () => {
    const trouve = (code: string): number =>
      cr.charges.find((ligne) => ligne.code === code)?.net ?? -1
    expect(trouve('CH1')).toBe(4_000_000) // achats de marchandises
    expect(trouve('CH3')).toBe(600_000) // autres achats et charges externes
    expect(trouve('CH5')).toBe(1_500_000) // charges de personnel
    expect(trouve('CH6')).toBe(480_000) // dotations
    expect(trouve('CH8')).toBe(60_000) // charges financières
  })

  it('classe les produits par nature', () => {
    expect(cr.produits.find((ligne) => ligne.code === 'PR1')?.net).toBe(8_000_000)
    expect(cr.produits.find((ligne) => ligne.code === 'PR2')?.net).toBe(940_000)
  })

  it('donne le même résultat que le bilan', () => {
    expect(cr.resultat).toBe(bilan(BALANCE).resultat)
    expect(cr.totalProduits - cr.totalCharges).toBe(cr.resultat)
    expect(cr.beneficiaire).toBe(true)
  })

  it('déduit les rabais obtenus des charges et les rabais accordés des produits', () => {
    const avecRabais = computeBalance([
      l('607000', 1_000_000, 0),
      l('609000', 0, 100_000), // rabais obtenu : diminue la charge
      l('707000', 0, 2_000_000),
      l('709000', 50_000, 0), // rabais accordé : diminue le produit
      l('512000', 1_150_000, 0),
      l('101000', 0, 100_000),
    ])
    const resultat = compteDeResultat(avecRabais)
    expect(resultat.charges.find((ligne) => ligne.code === 'CH1')?.net).toBe(1_000_000)
    expect(resultat.charges.find((ligne) => ligne.code === 'CH3')?.net).toBe(-100_000)
    expect(resultat.produits.find((ligne) => ligne.code === 'PR2')?.net).toBe(-50_000)
    expect(resultat.resultat).toBe(2_000_000 - 50_000 - 1_000_000 + 100_000)
  })
})

describe('balance à quatre colonnes', () => {
  const b = balanceQuatreColonnes(BALANCE)

  it('égalise les mouvements et les soldes deux à deux', () => {
    expect(b.equilibree).toBe(true)
    expect(b.totalMouvementDebit).toBe(b.totalMouvementCredit)
    expect(b.totalSoldeDebiteur).toBe(b.totalSoldeCrediteur)
  })

  it('ne donne jamais un solde des deux côtés pour un même compte', () => {
    for (const ligne of b.lignes) {
      expect(ligne.soldeDebiteur === 0 || ligne.soldeCrediteur === 0).toBe(true)
    }
  })

  it('place les comptes selon le sens de leur solde', () => {
    const banque = b.lignes.find((ligne) => ligne.numero === '512000')
    expect(banque?.soldeDebiteur).toBe(4_960_000)
    expect(banque?.soldeCrediteur).toBe(0)

    const capital = b.lignes.find((ligne) => ligne.numero === '101000')
    expect(capital?.soldeCrediteur).toBe(5_000_000)
    expect(capital?.soldeDebiteur).toBe(0)
  })

  it('écarte les comptes sans mouvement', () => {
    expect(b.lignes.every((ligne) => ligne.mouvementDebit > 0 || ligne.mouvementCredit > 0)).toBe(true)
  })
})
