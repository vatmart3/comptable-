import { arrondi, type Centimes } from '../core/montant'
import { ajouterMois, comparerDates, jours30360, rangDuMois, type DateComptable, type Exercice } from '../core/dates'

export type ModeAmortissement = 'lineaire' | 'degressif'

export interface Immobilisation {
  id: string
  compte: string
  libelle: string
  /** Valeur d'origine hors TVA déductible. */
  valeurOrigine: Centimes
  /** Valeur résiduelle prévue en fin d'utilisation. Elle ne s'amortit pas. */
  valeurResiduelle?: Centimes
  dateAcquisition: DateComptable
  dateMiseEnService: DateComptable
  dureeAnnees: number
  mode: ModeAmortissement
  compteAmortissement: string
}

export interface LigneAmortissement {
  rang: number
  exercice: Exercice
  /** Base restant à amortir à l'ouverture : base amortissable en linéaire, valeur nette en dégressif. */
  baseDeCalcul: Centimes
  /** Jours en linéaire, mois en dégressif. Null pour une annuité pleine. */
  prorata: { unite: 'jours' | 'mois'; valeur: number; sur: number } | null
  dotation: Centimes
  cumul: Centimes
  valeurNetteComptable: Centimes
  /** En dégressif, l'annuité a basculé sur le mode linéaire résiduel. */
  bascule?: boolean
}

/** La base amortissable exclut la valeur résiduelle. */
export function baseAmortissable(immobilisation: Immobilisation): Centimes {
  return immobilisation.valeurOrigine - (immobilisation.valeurResiduelle ?? 0)
}

/** Coefficients du dégressif : 1,25 de 3 à 4 ans, 1,75 de 5 à 6 ans, 2,25 au-delà. */
export function coefficientDegressif(dureeAnnees: number): number {
  if (dureeAnnees <= 2) return 1
  if (dureeAnnees <= 4) return 1.25
  if (dureeAnnees <= 6) return 1.75
  return 2.25
}

export function tauxLineaire(dureeAnnees: number): number {
  return 1 / dureeAnnees
}

export function tauxDegressif(dureeAnnees: number): number {
  return tauxLineaire(dureeAnnees) * coefficientDegressif(dureeAnnees)
}

/**
 * Jours d'amortissement de la mise en service à la clôture, base 30/360,
 * jour de mise en service compris. Une mise en service au 15 mars sur un
 * exercice civil donne 286 jours.
 */
export function joursProrata(miseEnService: DateComptable, finExercice: DateComptable): number {
  if (comparerDates(miseEnService, finExercice) > 0) return 0
  return Math.min(360, jours30360(miseEnService, finExercice) + 1)
}

/** Mois entiers du premier jour du mois d'acquisition à la clôture. */
export function moisProrata(acquisition: DateComptable, exercice: Exercice): number {
  const rangAcquisition = rangDuMois(acquisition, exercice)
  if (rangAcquisition === null) return 0
  return Math.max(0, Math.min(12, 12 - rangAcquisition + 1))
}

function exerciceSuivant(exercice: Exercice): Exercice {
  return { debut: ajouterMois(exercice.debut, 12), fin: ajouterMois(exercice.fin, 12) }
}

/** Premier exercice couvrant la date de mise en service. */
function exerciceDeDepart(immobilisation: Immobilisation, reference: Exercice): Exercice {
  let exercice = reference
  let garde = 0
  while (comparerDates(immobilisation.dateMiseEnService, exercice.debut) < 0 && garde < 100) {
    exercice = { debut: ajouterMois(exercice.debut, -12), fin: ajouterMois(exercice.fin, -12) }
    garde += 1
  }
  garde = 0
  while (comparerDates(immobilisation.dateMiseEnService, exercice.fin) > 0 && garde < 100) {
    exercice = exerciceSuivant(exercice)
    garde += 1
  }
  return exercice
}

/**
 * Plan d'amortissement complet.
 * Le cumul atteint exactement la base amortissable : la dernière annuité
 * absorbe les centimes d'arrondi, elle n'est jamais recalculée.
 */
export function planAmortissement(
  immobilisation: Immobilisation,
  exerciceReference: Exercice,
): LigneAmortissement[] {
  return immobilisation.mode === 'lineaire'
    ? planLineaire(immobilisation, exerciceReference)
    : planDegressif(immobilisation, exerciceReference)
}

function planLineaire(
  immobilisation: Immobilisation,
  exerciceReference: Exercice,
): LigneAmortissement[] {
  const base = baseAmortissable(immobilisation)
  const annuitePleine = base / immobilisation.dureeAnnees
  const lignes: LigneAmortissement[] = []
  let exercice = exerciceDeDepart(immobilisation, exerciceReference)
  let cumul = 0
  let rang = 1

  const jours = joursProrata(immobilisation.dateMiseEnService, exercice.fin)
  const derniereAnnuiteEstPartielle = jours < 360
  const nombreDeLignes = immobilisation.dureeAnnees + (derniereAnnuiteEstPartielle ? 1 : 0)

  while (rang <= nombreDeLignes && cumul < base) {
    const proportion = rang === 1 ? jours / 360 : 1
    const brute = rang === 1 ? annuitePleine * proportion : annuitePleine
    const derniere = rang === nombreDeLignes
    const dotation = derniere ? base - cumul : Math.min(arrondi(brute), base - cumul)
    cumul += dotation
    lignes.push({
      rang,
      exercice,
      baseDeCalcul: base,
      prorata: rang === 1 && jours < 360 ? { unite: 'jours', valeur: jours, sur: 360 } : null,
      dotation,
      cumul,
      valeurNetteComptable: immobilisation.valeurOrigine - cumul,
    })
    exercice = exerciceSuivant(exercice)
    rang += 1
  }
  return lignes
}

function planDegressif(
  immobilisation: Immobilisation,
  exerciceReference: Exercice,
): LigneAmortissement[] {
  const base = baseAmortissable(immobilisation)
  const taux = tauxDegressif(immobilisation.dureeAnnees)
  const lignes: LigneAmortissement[] = []
  let exercice = exerciceDeDepart(immobilisation, exerciceReference)
  let cumul = 0

  for (let rang = 1; rang <= immobilisation.dureeAnnees; rang += 1) {
    const restant = base - cumul
    const anneesRestantes = immobilisation.dureeAnnees - rang + 1
    const mois = rang === 1 ? moisProrata(immobilisation.dateAcquisition, exercice) : 12
    const degressive = restant * taux * (mois / 12)
    const lineaireResiduelle = anneesRestantes > 0 ? restant / anneesRestantes : restant
    const bascule = rang > 1 && lineaireResiduelle >= degressive
    const brute = bascule ? lineaireResiduelle : degressive
    const derniere = rang === immobilisation.dureeAnnees
    const dotation = derniere ? restant : Math.min(arrondi(brute), restant)
    cumul += dotation
    lignes.push({
      rang,
      exercice,
      baseDeCalcul: restant,
      prorata: rang === 1 && mois < 12 ? { unite: 'mois', valeur: mois, sur: 12 } : null,
      dotation,
      cumul,
      valeurNetteComptable: immobilisation.valeurOrigine - cumul,
      ...(bascule ? { bascule: true } : {}),
    })
    exercice = exerciceSuivant(exercice)
    if (cumul >= base) break
  }
  return lignes
}

/** Annuité d'un exercice donné, ou zéro si l'immobilisation n'est plus amortie. */
export function dotationDeLExercice(
  immobilisation: Immobilisation,
  exercice: Exercice,
): Centimes {
  const plan = planAmortissement(immobilisation, exercice)
  return plan.find((ligne) => ligne.exercice.debut === exercice.debut)?.dotation ?? 0
}

/** Cumul des amortissements à la clôture d'un exercice. */
export function cumulALaCloture(immobilisation: Immobilisation, exercice: Exercice): Centimes {
  const plan = planAmortissement(immobilisation, exercice)
  const ligne = plan.find((l) => l.exercice.debut === exercice.debut)
  if (ligne) return ligne.cumul
  const derniereAnterieure = [...plan]
    .reverse()
    .find((l) => comparerDates(l.exercice.fin, exercice.fin) <= 0)
  return derniereAnterieure?.cumul ?? 0
}

/**
 * Dépréciation d'une immobilisation : elle porte sur la valeur nette
 * comptable, jamais sur la valeur brute.
 */
export function depreciationImmobilisation(
  valeurNetteComptable: Centimes,
  valeurActuelle: Centimes,
): Centimes {
  return Math.max(0, valeurNetteComptable - valeurActuelle)
}
