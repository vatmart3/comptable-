import { somme, tvaSurBase, type Centimes, type PointsDeBase } from '../core/montant'
import type { DateComptable } from '../core/dates'
import { COMPTES_TVA, TAUX_TVA } from '../referentiel/tva'
import type { Ecriture, LigneEcriture } from '../types/ecriture'
import { filtrerEcritures, type OptionsRestitution } from './grand-livre'

export interface BaseImposable {
  taux: PointsDeBase
  base: Centimes
  tva: Centimes
}

export interface DeclarationCA3 {
  periode: { debut: DateComptable; fin: DateComptable }
  /** Ligne 01 : ventes et prestations de services. */
  chiffreAffairesTaxable: Centimes
  /** Lignes 08, 09, 9B : bases par taux et TVA correspondante. */
  bases: BaseImposable[]
  /** Base dont le taux n'a pas pu être déterminé (facture à plusieurs taux). */
  baseIndeterminee: Centimes
  /** Ligne 16 : TVA brute due. */
  tvaCollectee: Centimes
  /** Ligne 19 : TVA déductible sur immobilisations. */
  tvaDeductibleImmobilisations: Centimes
  /** Ligne 20 : TVA déductible sur autres biens et services. */
  tvaDeductibleBiensServices: Centimes
  /** Ligne 22 : crédit de TVA reporté de la déclaration précédente. */
  creditAnterieur: Centimes
  /** Ligne 23 : total de la TVA déductible. */
  tvaDeductibleTotale: Centimes
  /** Ligne 28 : TVA à décaisser, zéro en cas de crédit. */
  tvaADecaisser: Centimes
  /** Ligne 27 : crédit de TVA à reporter, zéro en cas de TVA à payer. */
  creditAReporter: Centimes
  /** Écriture de liquidation à passer au journal des opérations diverses. */
  ecritureDeLiquidation: LigneEcriture[]
}

const COMPTES_PRODUITS_TAXABLES = ['70', '7085']

function mouvementNet(lignes: readonly LigneEcriture[], racine: string, sens: 'debit' | 'credit'): Centimes {
  return somme(
    lignes
      .filter((ligne) => ligne.compteNumero.startsWith(racine))
      .map((ligne) => (sens === 'credit' ? ligne.credit - ligne.debit : ligne.debit - ligne.credit)),
  )
}

/**
 * Détermine le taux d'une écriture de vente en confrontant la TVA collectée
 * à la base des comptes de produits. Une facture à plusieurs taux ne peut pas
 * être ventilée depuis l'écriture seule : sa base est déclarée indéterminée.
 */
function tauxDeLEcriture(ecriture: Ecriture): { taux: PointsDeBase | null; base: Centimes; tva: Centimes } {
  const base = somme(
    COMPTES_PRODUITS_TAXABLES.map((racine) => mouvementNet(ecriture.lignes, racine, 'credit')),
  )
  const tva = mouvementNet(ecriture.lignes, COMPTES_TVA.collectee, 'credit')
  if (tva === 0) return { taux: null, base: 0, tva: 0 }
  for (const { taux } of TAUX_TVA) {
    if (taux === 0) continue
    if (tvaSurBase(base, taux) === tva) return { taux, base, tva }
  }
  return { taux: null, base, tva }
}

export interface OptionsCA3 extends OptionsRestitution {
  /** Crédit de TVA reporté de la période précédente. */
  creditAnterieur?: Centimes
  /** Inclure les écritures de liquidation elles-mêmes. Faux par défaut. */
  inclureLiquidations?: boolean
}

/**
 * Une écriture qui touche au compte 44551, au crédit de TVA à reporter ou au
 * remboursement demandé est une écriture de liquidation ou son règlement :
 * elle solde la période, elle n'en fait pas partie. La déclarer reviendrait à
 * annuler la TVA que l'on cherche précisément à déclarer.
 */
export function estEcritureDeLiquidation(ecriture: Ecriture): boolean {
  const comptes = [COMPTES_TVA.aDecaisser, COMPTES_TVA.creditAReporter, COMPTES_TVA.remboursementDemande]
  return ecriture.lignes.some((ligne) => comptes.some((compte) => ligne.compteNumero.startsWith(compte)))
}

export function declarationCA3(
  ecritures: readonly Ecriture[],
  periode: { debut: DateComptable; fin: DateComptable },
  options: OptionsCA3 = {},
): DeclarationCA3 {
  const retenues = filtrerEcritures(ecritures, {
    ...options,
    dateMin: periode.debut,
    dateMax: periode.fin,
  }).filter((ecriture) => options.inclureLiquidations === true || !estEcritureDeLiquidation(ecriture))

  const parTaux = new Map<PointsDeBase, BaseImposable>()
  let baseIndeterminee = 0
  let tvaCollectee = 0

  for (const ecriture of retenues) {
    const { taux, base, tva } = tauxDeLEcriture(ecriture)
    tvaCollectee += tva
    if (tva === 0) continue
    if (taux === null) {
      baseIndeterminee += base
      continue
    }
    const existante = parTaux.get(taux) ?? { taux, base: 0, tva: 0 }
    existante.base += base
    existante.tva += tva
    parTaux.set(taux, existante)
  }

  const toutesLignes = retenues.flatMap((e) => e.lignes)
  const tvaDeductibleBiensServices = mouvementNet(toutesLignes, COMPTES_TVA.deductibleBiensServices, 'debit')
  const tvaDeductibleImmobilisations = mouvementNet(toutesLignes, COMPTES_TVA.deductibleImmobilisations, 'debit')
  const creditAnterieur = options.creditAnterieur ?? 0
  const tvaDeductibleTotale = tvaDeductibleBiensServices + tvaDeductibleImmobilisations + creditAnterieur
  const solde = tvaCollectee - tvaDeductibleTotale

  const chiffreAffairesTaxable = somme(
    COMPTES_PRODUITS_TAXABLES.map((racine) => mouvementNet(toutesLignes, racine, 'credit')),
  )

  const bases = [...parTaux.values()].sort((a, b) => b.taux - a.taux)

  return {
    periode,
    chiffreAffairesTaxable,
    bases,
    baseIndeterminee,
    tvaCollectee,
    tvaDeductibleImmobilisations,
    tvaDeductibleBiensServices,
    creditAnterieur,
    tvaDeductibleTotale,
    tvaADecaisser: solde > 0 ? solde : 0,
    creditAReporter: solde < 0 ? -solde : 0,
    ecritureDeLiquidation: ecritureDeLiquidation({
      tvaCollectee,
      tvaDeductibleBiensServices,
      tvaDeductibleImmobilisations,
      creditAnterieur,
      solde,
      finDePeriode: periode.fin,
    }),
  }
}

function ecritureDeLiquidation(parametres: {
  tvaCollectee: Centimes
  tvaDeductibleBiensServices: Centimes
  tvaDeductibleImmobilisations: Centimes
  creditAnterieur: Centimes
  solde: Centimes
  finDePeriode: DateComptable
}): LigneEcriture[] {
  const lignes: LigneEcriture[] = []
  const ajouter = (compte: string, libelle: string, debit: Centimes, credit: Centimes) => {
    if (debit === 0 && credit === 0) return
    lignes.push({ compteNumero: compte, libelle, debit, credit })
  }

  ajouter(COMPTES_TVA.collectee, 'TVA collectée', parametres.tvaCollectee, 0)
  ajouter(COMPTES_TVA.deductibleBiensServices, 'TVA déductible sur biens et services', 0, parametres.tvaDeductibleBiensServices)
  ajouter(COMPTES_TVA.deductibleImmobilisations, 'TVA déductible sur immobilisations', 0, parametres.tvaDeductibleImmobilisations)
  ajouter(COMPTES_TVA.creditAReporter, 'Crédit de TVA imputé', 0, parametres.creditAnterieur)

  if (parametres.solde > 0) {
    ajouter(COMPTES_TVA.aDecaisser, 'TVA à décaisser', 0, parametres.solde)
  } else if (parametres.solde < 0) {
    ajouter(COMPTES_TVA.creditAReporter, 'Crédit de TVA à reporter', -parametres.solde, 0)
  }
  return lignes
}
