/**
 * Amortissements : plans linéaire et dégressif.
 *
 * Deux conventions fiscales françaises structurent ce fichier, et elles ne
 * sont pas les mêmes selon le mode :
 *
 *  - LINÉAIRE  : prorata temporis en JOURS, sur une année de 360 jours
 *                (12 mois de 30 jours), à compter de la date de mise en service.
 *  - DÉGRESSIF : prorata en MOIS ENTIERS, le mois d'acquisition étant compté
 *                en entier quel qu'en soit le jour.
 *
 * Le dégressif bascule en linéaire dès que le taux linéaire sur la durée
 * résiduelle devient plus avantageux — c'est obligatoire, pas optionnel.
 */

import { roundHalfUp, type Cents } from './money'

export const DEPRECIATION_MODES = ['lineaire', 'degressif', 'non_amortissable'] as const
export type DepreciationMode = (typeof DEPRECIATION_MODES)[number]

export interface FiscalWindow {
  readonly dateDebut: Date
  readonly dateFin: Date
}

export interface DepreciationInput {
  readonly valeurBrute: Cents
  readonly valeurResiduelle?: Cents
  readonly dateMiseEnService: Date
  readonly dureeMois: number
  readonly mode: DepreciationMode
  /** Exercices à couvrir, dans l'ordre. Permet les exercices non civils. */
  readonly exercices: readonly FiscalWindow[]
  /** Cession éventuelle : le plan s'arrête au prorata de la date. */
  readonly dateCession?: Date | null
}

export interface DepreciationRow {
  readonly exercice: FiscalWindow
  readonly base: Cents
  /** Taux effectivement appliqué, en millièmes de pourcent. */
  readonly taux: number
  readonly dotation: Cents
  readonly cumule: Cents
  readonly vnc: Cents
  /** Vrai lorsque le dégressif a basculé en linéaire sur cette annuité. */
  readonly bascule: boolean
}

/**
 * Nombre de jours entre deux dates en base 360 (30E/360) : tout mois vaut 30
 * jours. C'est la base de calcul du prorata temporis en amortissement linéaire.
 */
export function days360(start: Date, end: Date): number {
  const d1 = Math.min(start.getUTCDate(), 30)
  const d2 = Math.min(end.getUTCDate(), 30)
  return (
    (end.getUTCFullYear() - start.getUTCFullYear()) * 360 +
    (end.getUTCMonth() - start.getUTCMonth()) * 30 +
    (d2 - d1)
  )
}

/** Nombre de mois entiers, mois de départ compté en entier (règle du dégressif). */
export function monthsInclusive(start: Date, end: Date): number {
  const months =
    (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + (end.getUTCMonth() - start.getUTCMonth())
  return Math.max(0, months + 1)
}

/**
 * Coefficient dégressif applicable aux biens acquis depuis le 1er janvier 2001
 * (art. 39 A du CGI). En dessous de 3 ans, le dégressif n'est pas ouvert.
 */
export function coefficientDegressif(dureeMois: number): number {
  const annees = dureeMois / 12
  if (annees < 3) return 1
  if (annees <= 4) return 1.25
  if (annees <= 6) return 1.75
  return 2.25
}

/** Taux linéaire annuel en millièmes de pourcent (5 ans → 20 000). */
export function tauxLineaire(dureeMois: number): number {
  return roundHalfUp((12 / dureeMois) * 100_000)
}

/**
 * Fraction de l'exercice pendant laquelle le bien est amorti, en millièmes.
 * 1 000 = exercice plein.
 */
function fractionExercice(
  input: DepreciationInput,
  exercice: FiscalWindow,
  mode: DepreciationMode,
): number {
  const debutAmortissement =
    input.dateMiseEnService > exercice.dateDebut ? input.dateMiseEnService : exercice.dateDebut
  const finAmortissement =
    input.dateCession && input.dateCession < exercice.dateFin ? input.dateCession : exercice.dateFin

  if (finAmortissement < debutAmortissement) return 0

  if (mode === 'degressif') {
    const moisExercice = monthsInclusive(exercice.dateDebut, exercice.dateFin)
    const mois = monthsInclusive(debutAmortissement, finAmortissement)
    return Math.min(1000, roundHalfUp((mois / moisExercice) * 1000))
  }

  const joursExercice = days360(exercice.dateDebut, exercice.dateFin) + 1
  const jours = days360(debutAmortissement, finAmortissement) + 1
  return Math.min(1000, roundHalfUp((jours / joursExercice) * 1000))
}

/**
 * Construit le plan d'amortissement complet. La dernière annuité absorbe les
 * arrondis : un plan qui ne solde pas exactement la base amortissable est un
 * plan faux.
 */
export function buildPlan(input: DepreciationInput): DepreciationRow[] {
  const residuelle = input.valeurResiduelle ?? 0
  const baseAmortissable = input.valeurBrute - residuelle
  const rows: DepreciationRow[] = []

  if (input.mode === 'non_amortissable' || baseAmortissable <= 0 || input.dureeMois <= 0) {
    return rows
  }

  const tauxL = tauxLineaire(input.dureeMois)
  const coef = coefficientDegressif(input.dureeMois)
  const tauxD = roundHalfUp(tauxL * coef)

  let cumule = 0
  let basculee = false
  const dureeAnnees = input.dureeMois / 12
  let anneesEcoulees = 0

  for (const exercice of input.exercices) {
    const restant = baseAmortissable - cumule
    if (restant <= 0) break

    const fraction = fractionExercice(input, exercice, input.mode)
    if (fraction === 0) {
      rows.push({
        exercice,
        base: input.mode === 'degressif' ? restant : baseAmortissable,
        taux: 0,
        dotation: 0,
        cumule,
        vnc: input.valeurBrute - cumule,
        bascule: false,
      })
      continue
    }

    const fractionExerciceEcoule =
      (days360(exercice.dateDebut, exercice.dateFin) + 1) / 360
    const anneesRestantes = Math.max(0.0001, dureeAnnees - anneesEcoulees)

    let taux: number
    let base: Cents
    let bascule = false

    if (input.mode === 'lineaire') {
      taux = tauxL
      base = baseAmortissable
    } else {
      // Bascule obligatoire : dès que 1/n restant dépasse le taux dégressif.
      const tauxLineaireResiduel = roundHalfUp((1 / anneesRestantes) * 100_000)
      if (basculee || tauxLineaireResiduel >= tauxD) {
        basculee = true
        bascule = true
        taux = tauxLineaireResiduel
      } else {
        taux = tauxD
      }
      base = restant
    }

    let dotation = roundHalfUp((base * taux * fraction) / (100_000 * 1000))
    if (dotation > restant) dotation = restant

    // Dernière annuité : on solde exactement.
    const estDerniere =
      exercice === input.exercices[input.exercices.length - 1] ||
      (input.dateCession != null && input.dateCession <= exercice.dateFin)
    if (estDerniere && dotation < restant && input.dateCession == null) {
      const couvertureComplete = anneesEcoulees + fractionExerciceEcoule >= dureeAnnees - 0.0001
      if (couvertureComplete) dotation = restant
    }

    cumule += dotation
    anneesEcoulees += (fractionExerciceEcoule * fraction) / 1000
    rows.push({
      exercice,
      base,
      taux,
      dotation,
      cumule,
      vnc: input.valeurBrute - cumule,
      bascule,
    })

    if (input.dateCession && input.dateCession <= exercice.dateFin) break
  }

  return rows
}

/** Génère la suite d'exercices civils nécessaires pour amortir entièrement le bien. */
export function exercicesCivils(depuis: Date, nombre: number): FiscalWindow[] {
  const windows: FiscalWindow[] = []
  const anneeDepart = depuis.getUTCFullYear()
  for (let index = 0; index < nombre; index += 1) {
    windows.push({
      dateDebut: new Date(Date.UTC(anneeDepart + index, 0, 1)),
      dateFin: new Date(Date.UTC(anneeDepart + index, 11, 31)),
    })
  }
  return windows
}

/** Valeur nette comptable à la fin d'un exercice donné. */
export function vncAt(plan: readonly DepreciationRow[], dateFin: Date): Cents | null {
  let last: DepreciationRow | null = null
  for (const row of plan) {
    if (row.exercice.dateFin <= dateFin) last = row
  }
  return last ? last.vnc : null
}

/** Écriture de dotation : 681120 au débit, 28xxxx au crédit. */
export interface DepreciationEntryLine {
  readonly accountNumero: string
  readonly debit: Cents
  readonly credit: Cents
  readonly libelle: string
}

export function dotationEntry(args: {
  readonly dotation: Cents
  readonly compteAmortissement: string
  readonly compteDotation?: string
  readonly libelle: string
}): DepreciationEntryLine[] {
  if (args.dotation <= 0) return []
  const compteDotation = args.compteDotation ?? '681120'
  return [
    { accountNumero: compteDotation, debit: args.dotation, credit: 0, libelle: args.libelle },
    { accountNumero: args.compteAmortissement, debit: 0, credit: args.dotation, libelle: args.libelle },
  ]
}
