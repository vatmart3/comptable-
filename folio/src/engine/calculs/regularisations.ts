import { arrondi, type Centimes } from '../core/montant'
import { comparerDates, jours30360, rangDuMois, type DateComptable, type Exercice } from '../core/dates'

export type BaseProrata = '30/360' | 'mois'

export interface PeriodeCouverte {
  debut: DateComptable
  fin: DateComptable
}

/** Durée d'une période, dans l'unité choisie, bornes comprises. */
export function dureePeriode(periode: PeriodeCouverte, base: BaseProrata): number {
  if (base === 'mois') {
    const rang = rangDuMois(periode.fin, { debut: periode.debut, fin: periode.fin })
    return rang ?? 0
  }
  return jours30360(periode.debut, periode.fin) + 1
}

/**
 * Part d'une charge ou d'un produit qui concerne l'exercice suivant.
 * C'est le montant à porter en 486 charges constatées d'avance,
 * ou en 487 produits constatés d'avance.
 */
export function partConstateeDAvance(
  montant: Centimes,
  periode: PeriodeCouverte,
  exercice: Exercice,
  base: BaseProrata = '30/360',
): Centimes {
  if (comparerDates(periode.fin, exercice.fin) <= 0) return 0
  if (comparerDates(periode.debut, exercice.fin) > 0) return montant

  const totale = dureePeriode(periode, base)
  if (totale <= 0) return 0

  const ecoulee =
    base === 'mois'
      ? (rangDuMois(exercice.fin, { debut: periode.debut, fin: periode.fin }) ?? 0)
      : jours30360(periode.debut, exercice.fin) + 1

  const restante = Math.max(0, totale - ecoulee)
  return arrondi((montant * restante) / totale)
}

/** Part qui revient à l'exercice en cours. Complément exact du montant reporté. */
export function partRattacheeALExercice(
  montant: Centimes,
  periode: PeriodeCouverte,
  exercice: Exercice,
  base: BaseProrata = '30/360',
): Centimes {
  return montant - partConstateeDAvance(montant, periode, exercice, base)
}

/**
 * Charge à rattacher dont la facture n'est pas parvenue.
 * Le montant hors taxes va au compte de charge, la TVA au compte 44586,
 * la dette au compte 408.
 */
export interface FactureNonParvenue {
  compteCharge: string
  montantHT: Centimes
  montantTVA: Centimes
}

export function ecritureFactureNonParvenue(fnp: FactureNonParvenue): {
  compte: string
  debit: Centimes
  credit: Centimes
}[] {
  return [
    { compte: fnp.compteCharge, debit: fnp.montantHT, credit: 0 },
    { compte: '44586', debit: fnp.montantTVA, credit: 0 },
    { compte: '408', debit: 0, credit: fnp.montantHT + fnp.montantTVA },
  ]
}

/** Produit à rattacher non encore facturé : 418, 44587, compte de produit. */
export function ecritureFactureAEtablir(produit: {
  compteProduit: string
  montantHT: Centimes
  montantTVA: Centimes
}): { compte: string; debit: Centimes; credit: Centimes }[] {
  return [
    { compte: '418', debit: produit.montantHT + produit.montantTVA, credit: 0 },
    { compte: produit.compteProduit, debit: 0, credit: produit.montantHT },
    { compte: '44587', debit: 0, credit: produit.montantTVA },
  ]
}
