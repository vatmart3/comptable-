/**
 * Cas limites du moteur. Ce que l'étudiant tape rarement, mais que le moteur
 * doit traiter sans jamais renvoyer un résultat approximatif ni lever.
 */
import { describe, expect, it } from 'vitest'
import { euros, formatMontant, parseMontant, somme } from './core/montant'
import { ajouterMois, composer, decomposer, finDeMois, formatDateFr, rangDuMois } from './core/dates'
import { calculerTotauxPiece } from './calculs/piece'
import { balance, balanceAgee } from './calculs/balance'
import { grandLivre } from './calculs/grand-livre'
import { bilan, compteDeResultat } from './calculs/etats-financiers'
import { declarationCA3 } from './calculs/ca3'
import { lettreDeRang, lignesLettrables, verifierLettrage } from './calculs/lettrage'
import { etatDeRapprochement } from './calculs/rapprochement'
import { exporterFEC, analyserFEC, lignesFEC } from './export/fec'
import { controlerDossier } from './controles/global'
import { controlerEcriture } from './controles'
import { DOSSIER, ECRITURES, EXERCICE, ecriture, ligne } from './fixtures/garage-vidal'

describe('montants et dates aux bornes', () => {
  it('refuse un montant hors des entiers sûrs', () => {
    expect(parseMontant('999999999999999999999')).toBeNull()
    expect(formatMontant(0)).toBe('0,00')
    expect(formatMontant(1234, { signe: true })).toBe('+12,34')
  })

  it('ne casse pas sur une date malformée', () => {
    expect(decomposer('pas une date')).toBeNull()
    expect(rangDuMois('pas une date', EXERCICE)).toBeNull()
    expect(finDeMois('pas une date')).toBe('pas une date')
    expect(ajouterMois('pas une date', 3)).toBe('pas une date')
    expect(formatDateFr('pas une date')).toBe('pas une date')
    expect(composer(2025, 3, 7)).toBe('2025-03-07')
  })
})

describe('pièce sans ligne ni taux', () => {
  it('rend des totaux nuls plutôt que NaN', () => {
    const totaux = calculerTotauxPiece({ lignes: [] })
    expect(totaux.totalTTC).toBe(0)
    expect(totaux.basesParTaux).toEqual([])
  })

  it('applique au port le taux de la première ligne quand aucun n’est précisé', () => {
    const totaux = calculerTotauxPiece({
      lignes: [{ designation: 'Livres', quantite: 1, prixUnitaireHT: euros(100), tauxTVA: 550 }],
      port: euros(10),
    })
    expect(totaux.basesParTaux).toEqual([{ taux: 550, base: euros(110), tva: euros(6.05) }])
  })

  it('facture un port seul au taux normal', () => {
    const totaux = calculerTotauxPiece({ lignes: [], port: euros(50) })
    expect(totaux.basesParTaux).toEqual([{ taux: 2000, base: euros(50), tva: euros(10) }])
  })
})

describe('restitutions sur un dossier vide', () => {
  it('rend une balance équilibrée et vide', () => {
    const vide = balance([])
    expect(vide.lignes).toEqual([])
    expect(vide.equilibree).toBe(true)
    expect(grandLivre([])).toEqual([])
    expect(balanceAgee([], '2025-12-31')).toEqual([])
  })

  it('rend un bilan et un compte de résultat à zéro', () => {
    expect(bilan([]).totalActif).toBe(0)
    expect(bilan([]).equilibre).toBe(true)
    expect(compteDeResultat([]).resultatNet).toBe(0)
    expect(controlerDossier([])).toEqual([])
  })

  it('rend une déclaration de TVA sans écriture de liquidation', () => {
    const ca3 = declarationCA3([], { debut: '2025-01-01', fin: '2025-01-31' })
    expect(ca3.tvaCollectee).toBe(0)
    expect(ca3.ecritureDeLiquidation).toEqual([])
  })

  it('exporte un FEC réduit à son en-tête', () => {
    const { contenu } = exporterFEC(DOSSIER, [])
    expect(analyserFEC(contenu).lignes).toEqual([])
    expect(analyserFEC(contenu).anomalies).toEqual([])
  })
})

describe('perte et découvert', () => {
  const perte = [
    ecriture('p1', 'AN', '2025-01-01', 'AN-2025', 'Reprise', [
      ligne('512', 'Banque', 1000, 0),
      ligne('101', 'Capital', 0, 1000),
    ]),
    ecriture('p2', 'AC', '2025-03-02', 'FA-1', 'Honoraires', [
      ligne('6226', 'Honoraires', 3000, 0),
      ligne('401', 'Avocat', 0, 3000),
    ]),
    ecriture('p3', 'BQ', '2025-03-20', 'BQ-1', 'Règlement', [
      ligne('401', 'Avocat', 3000, 0),
      ligne('512', 'Banque', 0, 3000),
    ]),
  ]

  it('porte la perte au passif et le découvert au passif', () => {
    const etat = bilan(perte)
    expect(etat.resultat).toBe(euros(-3000))
    expect(etat.resultatParDifference).toBe(euros(-3000))
    expect(etat.equilibre).toBe(true)
    expect(etat.totalActif).toBe(0)
    const dettes = etat.passif.find((r) => r.code === 'DT')
    expect(dettes?.postes.find((p) => p.code === 'DB')?.net).toBe(euros(2000))
  })

  it('concorde avec le compte de résultat', () => {
    expect(compteDeResultat(perte).resultatNet).toBe(bilan(perte).resultatParDifference)
    expect(controlerDossier(perte).map((e) => e.code)).toEqual(['GLOB_TIERS_SOLDE_NON_LETTRE'])
  })
})

describe('lettrage et rapprochement aux bornes', () => {
  it('numérote au-delà de la vingt-sixième lettre', () => {
    expect(lettreDeRang(51)).toBe('AZ')
    expect(lettreDeRang(701)).toBe('ZZ')
    expect(lettreDeRang(702)).toBe('AAA')
  })

  it('refuse de lettrer un compte qui ne l’est pas', () => {
    expect(lignesLettrables(ECRITURES, '512')).toEqual([])
    expect(verifierLettrage([]).possible).toBe(false)
  })

  it('signale un rapprochement qui ne tombe pas juste', () => {
    const etat = etatDeRapprochement({
      compteBanque: '512',
      dateArrete: '2025-02-28',
      lignesComptables: [],
      lignesReleve: [],
      soldeReleve: euros(100),
    })
    expect(etat.justifie).toBe(false)
    expect(etat.ecart).toBe(euros(-100))
  })
})

describe('écriture ventilée sur un compte auxiliaire', () => {
  const auxiliaire = ecriture('aux', 'VE', '2025-04-02', 'FV-300', 'Facture Bru', [
    ligne('411BRU', 'Client Bru', 1200, 0, { auxiliaire: 'BRU', echeance: '2025-05-02' }),
    ligne('707', 'Ventes', 0, 1000),
    ligne('44571', 'TVA collectée', 0, 200),
  ])

  it('passe les contrôles de structure', () => {
    expect(controlerEcriture(auxiliaire, { exercice: EXERCICE })).toEqual([])
  })

  it('porte le compte auxiliaire au FEC', () => {
    const lignes = lignesFEC(DOSSIER, [...ECRITURES, auxiliaire])
    const ligneAux = lignes.find((l) => l.CompteNum === '411BRU')!
    expect(ligneAux.CompAuxNum).toBe('BRU')
    expect(ligneAux.CompAuxLib).toBe('Client Bru')
  })

  it('entre dans la balance âgée sous son auxiliaire', () => {
    const agee = balanceAgee([auxiliaire], '2025-06-01')
    expect(agee[0]?.auxiliaire).toBe('BRU')
    expect(agee[0]?.tranches['1-30']).toBe(euros(1200))
    expect(somme(Object.values(agee[0]!.tranches))).toBe(euros(1200))
  })
})
