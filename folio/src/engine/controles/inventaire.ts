import { arrondi, type Centimes } from '../core/montant'
import type { DateComptable, Exercice } from '../core/dates'
import { dansExercice, formatDateFr } from '../core/dates'
import {
  baseAmortissable,
  dotationDeLExercice,
  joursProrata,
  moisProrata,
  type Immobilisation,
} from '../calculs/amortissements'
import { partConstateeDAvance, type BaseProrata, type PeriodeCouverte } from '../calculs/regularisations'
import { creerEcart, type Ecart } from './catalogue'
import { TOLERANCE_ARRONDI } from './montants'

/**
 * Contrôle une dotation aux amortissements saisie par l'étudiant.
 * Nomme la cause exacte : base amortissable, prorata temporis, ou arrondi.
 */
export function controlerDotation(
  immobilisation: Immobilisation,
  exercice: Exercice,
  dotationSaisie: Centimes,
): Ecart[] {
  const attendue = dotationDeLExercice(immobilisation, exercice)
  if (dotationSaisie === attendue) return []

  const base = baseAmortissable(immobilisation)
  const duree = immobilisation.dureeAnnees

  // Valeur résiduelle ignorée : la dotation est calculée sur la valeur d'origine.
  if (base !== immobilisation.valeurOrigine) {
    const proportion =
      immobilisation.mode === 'lineaire'
        ? joursProrata(immobilisation.dateMiseEnService, exercice.fin) / 360
        : moisProrata(immobilisation.dateAcquisition, exercice) / 12
    const surValeurOrigine = arrondi((immobilisation.valeurOrigine / duree) * (proportion || 1))
    if (dotationSaisie === surValeurOrigine) {
      return [
        creerEcart('INV_BASE_AMORTISSABLE', {
          montantConstate: immobilisation.valeurOrigine,
          montantAttendu: base,
        }),
      ]
    }
  }

  // La règle de prorata du mode, rappelée quel que soit l'écart constaté.
  const precision =
    immobilisation.mode === 'lineaire'
      ? `La première annuité court du ${formatDateFr(immobilisation.dateMiseEnService)} à la clôture, soit ${joursProrata(immobilisation.dateMiseEnService, exercice.fin)} jours sur 360.`
      : `En dégressif, la première annuité court en mois entiers depuis le premier jour du mois d’acquisition, soit ${moisProrata(immobilisation.dateAcquisition, exercice)} mois sur 12.`

  // Prorata oublié : l'annuité pleine est portée sur un exercice incomplet.
  const annuitePleine = arrondi(base / duree)
  if (dotationSaisie === annuitePleine && attendue !== annuitePleine) {
    return [
      creerEcart('INV_PRORATA_TEMPORIS', {
        montantConstate: dotationSaisie,
        montantAttendu: attendue,
        precision,
      }),
    ]
  }

  if (Math.abs(dotationSaisie - attendue) <= TOLERANCE_ARRONDI) {
    return [
      creerEcart('MT_ECART_ARRONDI', {
        compteConstate: immobilisation.compteAmortissement,
        montantConstate: dotationSaisie - attendue,
        montantAttendu: attendue,
      }),
    ]
  }

  return [
    creerEcart('INV_PRORATA_TEMPORIS', {
      montantConstate: dotationSaisie,
      montantAttendu: attendue,
      precision,
    }),
  ]
}

/**
 * Contrôle une dépréciation : elle porte sur la valeur nette comptable,
 * jamais sur la valeur brute.
 */
export function controlerDepreciation(
  parametres: {
    valeurBrute: Centimes
    cumulAmortissements: Centimes
    valeurActuelle: Centimes
  },
  depreciationSaisie: Centimes,
): Ecart[] {
  const valeurNette = parametres.valeurBrute - parametres.cumulAmortissements
  const attendue = Math.max(0, valeurNette - parametres.valeurActuelle)
  if (depreciationSaisie === attendue) return []

  const surBrut = Math.max(0, parametres.valeurBrute - parametres.valeurActuelle)
  if (depreciationSaisie === surBrut && surBrut !== attendue) {
    return [
      creerEcart('INV_DEPRECIATION_SUR_BRUT', {
        montantConstate: parametres.valeurBrute,
        montantAttendu: valeurNette,
      }),
    ]
  }

  return [
    creerEcart('MT_MONTANT_ERRONE', {
      montantConstate: depreciationSaisie,
      montantAttendu: attendue,
      precision: 'La dépréciation est la différence entre la valeur nette comptable et la valeur actuelle.',
    }),
  ]
}

/**
 * Contrôle le rattachement d'une charge ou d'un produit à l'exercice.
 * La part qui déborde la clôture se régularise, elle ne reste pas en charge.
 */
export function controlerRattachement(
  parametres: {
    montant: Centimes
    periode: PeriodeCouverte
    exercice: Exercice
    base?: BaseProrata
  },
  montantRegulariseSaisi: Centimes,
): Ecart[] {
  const attendu = partConstateeDAvance(
    parametres.montant,
    parametres.periode,
    parametres.exercice,
    parametres.base ?? '30/360',
  )
  if (montantRegulariseSaisi === attendu) return []

  if (Math.abs(montantRegulariseSaisi - attendu) <= TOLERANCE_ARRONDI) {
    return [
      creerEcart('MT_ECART_ARRONDI', {
        montantConstate: montantRegulariseSaisi - attendu,
        montantAttendu: attendu,
      }),
    ]
  }

  return [
    creerEcart('INV_RATTACHEMENT_EXERCICE', {
      montantConstate: montantRegulariseSaisi,
      montantAttendu: attendu,
      date: parametres.periode.debut,
      exerciceFin: parametres.exercice.fin,
      precision: `La période court du ${formatDateFr(parametres.periode.debut)} au ${formatDateFr(parametres.periode.fin)} : la part postérieure à la clôture se porte en 486 ou en 487.`,
    }),
  ]
}

/** Une opération datée hors exercice ne se comptabilise pas telle quelle. */
export function controlerDateDOperation(
  date: DateComptable,
  exercice: Exercice,
): Ecart[] {
  if (dansExercice(date, exercice)) return []
  return [
    creerEcart('INV_RATTACHEMENT_EXERCICE', {
      date,
      exerciceFin: exercice.fin,
    }),
  ]
}
