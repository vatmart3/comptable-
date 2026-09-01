/**
 * Dates comptables.
 *
 * Une date est une chaîne ISO « AAAA-MM-JJ ». Le moteur ne construit jamais
 * d'objet Date : le fuseau du navigateur décalerait une écriture du 31 décembre
 * sur l'exercice suivant.
 */

/** Date au format AAAA-MM-JJ. */
export type DateComptable = string

const FORMAT = /^(\d{4})-(\d{2})-(\d{2})$/

export interface PartiesDate {
  annee: number
  mois: number
  jour: number
}

export function estDateValide(date: string): date is DateComptable {
  const parties = decomposer(date)
  if (!parties) return false
  return parties.jour <= joursDansLeMois(parties.annee, parties.mois)
}

export function decomposer(date: string): PartiesDate | null {
  const trouve = FORMAT.exec(date)
  if (!trouve) return null
  const annee = Number(trouve[1])
  const mois = Number(trouve[2])
  const jour = Number(trouve[3])
  if (mois < 1 || mois > 12 || jour < 1 || jour > 31) return null
  return { annee, mois, jour }
}

export function composer(annee: number, mois: number, jour: number): DateComptable {
  return `${String(annee).padStart(4, '0')}-${String(mois).padStart(2, '0')}-${String(jour).padStart(2, '0')}`
}

export function estBissextile(annee: number): boolean {
  return (annee % 4 === 0 && annee % 100 !== 0) || annee % 400 === 0
}

export function joursDansLeMois(annee: number, mois: number): number {
  if (mois === 2) return estBissextile(annee) ? 29 : 28
  return [4, 6, 9, 11].includes(mois) ? 30 : 31
}

/** Compare deux dates ISO. L'ordre lexicographique est l'ordre chronologique. */
export function comparerDates(a: DateComptable, b: DateComptable): number {
  return a < b ? -1 : a > b ? 1 : 0
}

export interface Exercice {
  debut: DateComptable
  fin: DateComptable
}

export function dansExercice(date: DateComptable, exercice: Exercice): boolean {
  return date >= exercice.debut && date <= exercice.fin
}

/** Rang du mois dans l'exercice, 1 pour le mois d'ouverture. */
export function rangDuMois(date: DateComptable, exercice: Exercice): number | null {
  const d = decomposer(date)
  const debut = decomposer(exercice.debut)
  if (!d || !debut) return null
  return (d.annee - debut.annee) * 12 + (d.mois - debut.mois) + 1
}

/** Dernier jour du mois d'une date. */
export function finDeMois(date: DateComptable): DateComptable {
  const d = decomposer(date)
  if (!d) return date
  return composer(d.annee, d.mois, joursDansLeMois(d.annee, d.mois))
}

/** Ajoute un nombre de mois, en repliant sur le dernier jour du mois cible. */
export function ajouterMois(date: DateComptable, mois: number): DateComptable {
  const d = decomposer(date)
  if (!d) return date
  const total = d.annee * 12 + (d.mois - 1) + mois
  const annee = Math.floor(total / 12)
  const nouveauMois = (total % 12) + 1
  const jour = Math.min(d.jour, joursDansLeMois(annee, nouveauMois))
  return composer(annee, nouveauMois, jour)
}

/**
 * Nombre de jours entre deux dates en base 30/360, convention retenue en
 * France pour le prorata temporis : tous les mois comptent 30 jours, l'année
 * 360. Le résultat inclut le jour de début et exclut le jour de fin.
 *
 * Une date de fin tombant le dernier jour de son mois compte pour le 30 :
 * sans cela, un trimestre s'achevant le 28 février compterait 88 jours au
 * lieu de 90 et fausserait toutes les régularisations de fin d'exercice.
 */
export function jours30360(debut: DateComptable, fin: DateComptable): number {
  const d = decomposer(debut)
  const f = decomposer(fin)
  if (!d || !f) return 0
  const jourDebut = Math.min(d.jour, 30)
  const finDeMois = f.jour === joursDansLeMois(f.annee, f.mois)
  const jourFin = finDeMois ? 30 : Math.min(f.jour, 30)
  return (f.annee - d.annee) * 360 + (f.mois - d.mois) * 30 + (jourFin - jourDebut)
}

/** Nombre de jours réels entre deux dates, fin exclue. */
export function joursReels(debut: DateComptable, fin: DateComptable): number {
  return numeroDeJour(fin) - numeroDeJour(debut)
}

/** Jour julien simplifié, utilisé pour les différences de dates. */
export function numeroDeJour(date: DateComptable): number {
  const d = decomposer(date)
  if (!d) return 0
  const a = Math.floor((14 - d.mois) / 12)
  const y = d.annee + 4800 - a
  const m = d.mois + 12 * a - 3
  return (
    d.jour +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045
  )
}

/** Rend la date au format français JJ/MM/AAAA. */
export function formatDateFr(date: DateComptable): string {
  const d = decomposer(date)
  if (!d) return date
  return `${String(d.jour).padStart(2, '0')}/${String(d.mois).padStart(2, '0')}/${d.annee}`
}

/** Format FEC : AAAAMMJJ. */
export function formatDateFec(date: DateComptable): string {
  return date.replace(/-/g, '')
}
