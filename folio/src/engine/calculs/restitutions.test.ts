import { describe, expect, it } from 'vitest'
import { euros } from '../core/montant'
import { DOSSIER, ECRITURES, ecriture, ligne } from '../fixtures/garage-vidal'
import { balance, balanceAgee, soldeDe } from './balance'
import { grandLivre, journalGeneral } from './grand-livre'
import { bilan, compteDeResultat, resultatDesComptesDeGestion } from './etats-financiers'
import { declarationCA3 } from './ca3'
import {
  appliquerLettrage,
  comptesSoldesNonLettres,
  lettreDeRang,
  lignesLettrables,
  lettrageAutomatique,
  prochaineLettre,
  verifierLettrage,
} from './lettrage'
import { etatDeRapprochement, lignesDuCompte, pointageAutomatique } from './rapprochement'

describe('journal général et grand livre', () => {
  it('rend les écritures dans l’ordre chronologique', () => {
    const journal = journalGeneral(ECRITURES)
    expect(journal.map((e) => e.id)).toEqual(['e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'e7'])
  })

  it('écarte les écritures non validées par défaut', () => {
    const brouillon = ecriture('e8', 'OD', '2025-03-01', 'OD-99', 'Brouillon', [
      ligne('607', 'Achat', 100, 0),
      ligne('401', 'Fournisseur', 0, 100),
    ])
    brouillon.validee = false
    expect(journalGeneral([...ECRITURES, brouillon])).toHaveLength(7)
    expect(journalGeneral([...ECRITURES, brouillon], { seulementValidees: false })).toHaveLength(8)
  })

  it('tient le solde progressif de chaque compte', () => {
    const banque = grandLivre(ECRITURES, { comptes: ['512'] })[0]
    expect(banque?.lignes.map((l) => l.soldeProgressif)).toEqual([
      euros(20000),
      euros(22400),
      euros(21200),
    ])
    expect(banque?.solde).toBe(euros(21200))
  })
})

describe('balance', () => {
  const calculee = balance(ECRITURES)

  it('est équilibrée', () => {
    expect(calculee.equilibree).toBe(true)
    expect(calculee.totalDebit).toBe(euros(31200))
    expect(calculee.totalCredit).toBe(euros(31200))
    expect(calculee.totalSoldeDebiteur).toBe(calculee.totalSoldeCrediteur)
  })

  it('donne les soldes attendus', () => {
    expect(soldeDe(calculee, '512')).toBe(euros(21200))
    expect(soldeDe(calculee, '401')).toBe(euros(-2400))
    expect(soldeDe(calculee, '411')).toBe(0)
    expect(soldeDe(calculee, '445')).toBe(euros(-200))
  })

  it('ventile les créances par ancienneté', () => {
    const nonLettree = ecriture('e9', 'VE', '2025-11-02', 'FV-233', 'Facture Bru', [
      ligne('411BRU', 'Client Bru', 1200, 0, { echeance: '2025-12-02' }),
      ligne('707', 'Ventes', 0, 1000),
      ligne('44571', 'TVA collectée', 0, 200),
    ])
    const agee = balanceAgee([...ECRITURES, nonLettree], '2025-12-31')
    expect(agee).toHaveLength(1)
    expect(agee[0]?.compte).toBe('411BRU')
    expect(agee[0]?.total).toBe(euros(1200))
    expect(agee[0]?.tranches['1-30']).toBe(euros(1200))
  })
})

describe('états financiers', () => {
  it('produit un bilan équilibré', () => {
    const etat = bilan(ECRITURES)
    expect(etat.totalActif).toBe(euros(22400))
    expect(etat.totalPassif).toBe(euros(22400))
    expect(etat.equilibre).toBe(true)
  })

  it('présente l’immobilisation en brut, amortissements et net', () => {
    const poste = bilan(ECRITURES).actif[0]?.postes.find((p) => p.code === 'AG')
    expect(poste?.brut).toBe(euros(3000))
    expect(poste?.deduction).toBe(euros(1800))
    expect(poste?.net).toBe(euros(1200))
  })

  it('donne le même résultat au bilan et au compte de résultat', () => {
    const etatBilan = bilan(ECRITURES)
    const etatResultat = compteDeResultat(ECRITURES)
    expect(etatResultat.resultatNet).toBe(euros(400))
    expect(etatBilan.resultat).toBe(etatResultat.resultatNet)
    expect(resultatDesComptesDeGestion(balance(ECRITURES))).toBe(euros(400))
  })

  it('détaille le compte de résultat', () => {
    const etat = compteDeResultat(ECRITURES)
    expect(etat.totalCharges).toBe(euros(1600))
    expect(etat.totalProduits).toBe(euros(2000))
    expect(etat.resultatExploitation).toBe(euros(400))
    expect(etat.resultatFinancier).toBe(0)
    const achats = etat.charges[0]?.postes.find((p) => p.code === 'FA')
    expect(achats?.net).toBe(euros(1000))
  })

  it('regroupe les postes en système abrégé sans changer les totaux', () => {
    const developpe = bilan(ECRITURES, { systeme: 'developpe' })
    const abrege = bilan(ECRITURES, { systeme: 'abrege' })
    expect(abrege.totalActif).toBe(developpe.totalActif)
    expect(abrege.actif[0]?.postes.map((p) => p.code)).toEqual(['AY'])
    const resultatAbrege = compteDeResultat(ECRITURES, { systeme: 'abrege' })
    expect(resultatAbrege.resultatNet).toBe(euros(400))
    expect(resultatAbrege.produits[0]?.postes[0]?.libelle).toBe('Chiffre d’affaires net')
  })
})

describe('déclaration de TVA', () => {
  const ca3 = declarationCA3(ECRITURES, { debut: '2025-02-01', fin: '2025-02-28' })

  it('liquide la TVA du mois', () => {
    expect(ca3.tvaCollectee).toBe(euros(400))
    expect(ca3.tvaDeductibleBiensServices).toBe(euros(200))
    expect(ca3.tvaADecaisser).toBe(euros(200))
    expect(ca3.creditAReporter).toBe(0)
  })

  it('ventile la base par taux', () => {
    expect(ca3.bases).toEqual([{ taux: 2000, base: euros(2000), tva: euros(400) }])
    expect(ca3.baseIndeterminee).toBe(0)
    expect(ca3.chiffreAffairesTaxable).toBe(euros(2000))
  })

  it('propose l’écriture de liquidation équilibrée', () => {
    const debit = ca3.ecritureDeLiquidation.reduce((total, l) => total + l.debit, 0)
    const credit = ca3.ecritureDeLiquidation.reduce((total, l) => total + l.credit, 0)
    expect(debit).toBe(credit)
    expect(ca3.ecritureDeLiquidation.map((l) => l.compteNumero)).toEqual(['44571', '44566', '44551'])
  })

  it('constate un crédit de TVA quand la TVA déductible l’emporte', () => {
    const janvier = declarationCA3(ECRITURES, { debut: '2025-01-01', fin: '2025-01-31' })
    expect(janvier.tvaADecaisser).toBe(0)
    const achatSeul = declarationCA3([ECRITURES[1]!], { debut: '2025-02-01', fin: '2025-02-28' })
    expect(achatSeul.creditAReporter).toBe(euros(200))
    expect(achatSeul.ecritureDeLiquidation.map((l) => l.compteNumero)).toEqual(['44566', '44567'])
  })
})

describe('lettrage', () => {
  it('numérote les lettres dans l’ordre', () => {
    expect(lettreDeRang(0)).toBe('A')
    expect(lettreDeRang(25)).toBe('Z')
    expect(lettreDeRang(26)).toBe('AA')
    expect(prochaineLettre(['A', 'B'])).toBe('C')
  })

  it('refuse un groupe déséquilibré', () => {
    expect(verifierLettrage([{ debit: euros(100), credit: 0 }])).toEqual({
      possible: false,
      ecart: euros(100),
    })
    const resultat = verifierLettrage([
      { debit: euros(100), credit: 0 },
      { debit: 0, credit: euros(100) },
    ])
    expect(resultat.possible).toBe(true)
    expect(resultat.lettre).toBe('A')
  })

  it('rapproche automatiquement une facture de son règlement', () => {
    const sansLettrage = ECRITURES.map((e) => ({
      ...e,
      lignes: e.lignes.map(({ lettrage, dateLettrage, ...reste }) => {
        void lettrage
        void dateLettrage
        return reste
      }),
    }))
    const lignes = lignesLettrables(sansLettrage, '411')
    const { groupes, lettres } = lettrageAutomatique(lignes)
    expect(groupes).toHaveLength(1)
    expect(lettres).toEqual(['A'])
    const apres = appliquerLettrage(sansLettrage, groupes[0]!, 'A', '2025-02-15')
    expect(comptesSoldesNonLettres(apres)).not.toContain('411')
  })

  it('signale un compte de tiers soldé mais non lettré', () => {
    const sansLettrage = ECRITURES.map((e) => ({
      ...e,
      lignes: e.lignes.map(({ lettrage, ...reste }) => {
        void lettrage
        return reste
      }),
    }))
    expect(comptesSoldesNonLettres(sansLettrage)).toEqual(['411'])
  })
})

describe('rapprochement bancaire', () => {
  const lignesComptables = lignesDuCompte(ECRITURES, '512')
  const releve = [
    { id: 'r1', date: '2025-01-01', libelle: 'Solde à nouveau', debit: 0, credit: euros(20000) },
    { id: 'r2', date: '2025-02-16', libelle: 'Virement Mercier', debit: 0, credit: euros(2400) },
  ]

  it('pointe les opérations de même montant', () => {
    const { comptables, releve: releveePointe } = pointageAutomatique(lignesComptables, releve)
    expect(comptables.filter((l) => l.pointee)).toHaveLength(2)
    expect(releveePointe.every((l) => l.pointee)).toBe(true)
  })

  it('justifie l’écart par le chèque non débité', () => {
    const { comptables, releve: releveePointe } = pointageAutomatique(lignesComptables, releve)
    const etat = etatDeRapprochement({
      compteBanque: '512',
      dateArrete: '2025-02-28',
      lignesComptables: comptables,
      lignesReleve: releveePointe,
      soldeReleve: euros(22400),
    })
    expect(etat.soldeComptable).toBe(euros(21200))
    expect(etat.enComptabiliteSeulement).toHaveLength(1)
    expect(etat.enComptabiliteSeulement[0]?.numeroPiece).toBe('BQ-019')
    expect(etat.justifie).toBe(true)
    expect(etat.ecart).toBe(0)
  })
})

describe('dossier de référence', () => {
  it('couvre l’exercice déclaré', () => {
    expect(DOSSIER.exerciceDebut).toBe('2025-01-01')
    expect(ECRITURES.every((e) => e.date >= DOSSIER.exerciceDebut && e.date <= DOSSIER.exerciceFin)).toBe(true)
  })
})
