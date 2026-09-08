/**
 * Lettrage : rapprocher une facture de son règlement.
 *
 * Un lettrage n'est valide que si les lignes qu'il réunit appartiennent au
 * même compte et se soldent exactement. Le lettrage partiel existe (une
 * facture réglée en deux fois) : il porte alors une lettre minuscule par
 * convention professionnelle, jusqu'à ce que le solde tombe à zéro.
 */

import type { Cents } from './money'
import { isLettrable } from './account'

export interface LetterableLine {
  readonly id: string
  readonly accountNumero: string
  readonly date: Date
  readonly libelle: string
  readonly debit: Cents
  readonly credit: Cents
  readonly lettre: string | null
  readonly partnerCode?: string | null
  readonly pieceRef?: string | null
}

/**
 * Suite bijective base 26 : A, B… Z, AA, AB… ZZ, AAA.
 * On ne réutilise jamais une lettre libérée : la piste d'audit exige que
 * « lettré B » désigne toujours le même rapprochement, même délettré.
 */
export function letterAt(index: number): string {
  if (index < 1) throw new RangeError('Le lettrage commence à 1')
  let remaining = index
  let letters = ''
  while (remaining > 0) {
    const rest = (remaining - 1) % 26
    letters = String.fromCharCode(65 + rest) + letters
    remaining = Math.floor((remaining - 1) / 26)
  }
  return letters
}

export function letterIndex(letter: string): number {
  let index = 0
  for (const char of letter.toUpperCase()) {
    index = index * 26 + (char.charCodeAt(0) - 64)
  }
  return index
}

export function nextLetter(used: readonly string[]): string {
  let max = 0
  for (const letter of used) {
    const index = letterIndex(letter)
    if (index > max) max = index
  }
  return letterAt(max + 1)
}

export type LetteringProblem =
  | { readonly code: 'comptes_differents'; readonly message: string }
  | { readonly code: 'compte_non_lettrable'; readonly message: string }
  | { readonly code: 'deja_lettre'; readonly message: string; readonly ids: readonly string[] }
  | { readonly code: 'ecart'; readonly message: string; readonly ecart: Cents }
  | { readonly code: 'un_seul_sens'; readonly message: string }

export interface LetteringVerdict {
  readonly ok: boolean
  readonly total: Cents
  readonly ecart: Cents
  readonly partiel: boolean
  readonly problems: readonly LetteringProblem[]
}

/**
 * Vérifie un groupe de lignes candidat au lettrage.
 * `autoriserPartiel` accepte un écart : le groupe est alors lettré
 * partiellement, et le solde résiduel reste ouvert.
 */
export function checkLettering(
  lines: readonly LetterableLine[],
  options: { autoriserPartiel?: boolean } = {},
): LetteringVerdict {
  const problems: LetteringProblem[] = []
  let total = 0
  let debit = 0
  let credit = 0
  const comptes = new Set<string>()
  const dejaLettrees: string[] = []

  for (const line of lines) {
    comptes.add(line.accountNumero)
    total += line.debit - line.credit
    debit += line.debit
    credit += line.credit
    if (line.lettre) dejaLettrees.push(line.id)
  }

  if (comptes.size > 1) {
    problems.push({
      code: 'comptes_differents',
      message: 'Le lettrage réunit des lignes de comptes différents.',
    })
  }
  const compte = [...comptes][0]
  if (compte && !isLettrable(compte)) {
    problems.push({
      code: 'compte_non_lettrable',
      message: `Le compte ${compte} n’est pas lettrable.`,
    })
  }
  if (dejaLettrees.length > 0) {
    problems.push({
      code: 'deja_lettre',
      message: 'Certaines lignes sont déjà lettrées ; délettrez-les d’abord.',
      ids: dejaLettrees,
    })
  }
  if (debit === 0 || credit === 0) {
    problems.push({
      code: 'un_seul_sens',
      message: 'Un lettrage confronte au moins un débit et un crédit.',
    })
  }
  if (total !== 0 && !options.autoriserPartiel) {
    problems.push({
      code: 'ecart',
      message: 'Le groupe ne se solde pas.',
      ecart: total,
    })
  }

  return {
    ok: problems.length === 0,
    total: debit,
    ecart: total,
    partiel: total !== 0,
    problems,
  }
}

// ── Propositions de rapprochement (Le Lettrage Magnétique) ──────────────────

export interface LetteringMatch {
  readonly debitIds: readonly string[]
  readonly creditIds: readonly string[]
  readonly montant: Cents
  /** Score en millièmes. 1000 = certitude. */
  readonly score: number
  readonly raison: string
}

const JOUR_MS = 86_400_000

function scoreDates(a: Date, b: Date): number {
  const jours = Math.abs(a.getTime() - b.getTime()) / JOUR_MS
  if (jours <= 2) return 200
  if (jours <= 10) return 150
  if (jours <= 45) return 100
  if (jours <= 120) return 40
  return 0
}

function scoreReference(a: LetterableLine, b: LetterableLine): number {
  if (a.pieceRef && b.pieceRef && a.pieceRef === b.pieceRef) return 250
  const ref = a.pieceRef ?? ''
  if (ref.length >= 4 && b.libelle.includes(ref)) return 200
  const refB = b.pieceRef ?? ''
  if (refB.length >= 4 && a.libelle.includes(refB)) return 200
  return 0
}

/**
 * Propose les paires évidentes : même compte, même montant, sens opposés.
 * Le score combine l'exactitude du montant (dominante), la proximité de date
 * et la présence de la référence de pièce dans le libellé du règlement.
 * L'appariement est glouton — une ligne n'est proposée qu'une fois.
 */
export function proposeMatches(lines: readonly LetterableLine[]): LetteringMatch[] {
  const ouverts = lines.filter((line) => line.lettre == null)
  const debits = ouverts.filter((line) => line.debit > 0)
  const credits = ouverts.filter((line) => line.credit > 0)

  const candidates: (LetteringMatch & { readonly debitId: string; readonly creditId: string })[] = []

  for (const debitLine of debits) {
    for (const creditLine of credits) {
      if (debitLine.accountNumero !== creditLine.accountNumero) continue
      if (debitLine.debit !== creditLine.credit) continue

      let score = 550
      score += scoreDates(debitLine.date, creditLine.date)
      score += scoreReference(debitLine, creditLine)
      if (debitLine.partnerCode && debitLine.partnerCode === creditLine.partnerCode) score += 100
      score = Math.min(1000, score)

      const jours = Math.round(Math.abs(debitLine.date.getTime() - creditLine.date.getTime()) / JOUR_MS)
      candidates.push({
        debitId: debitLine.id,
        creditId: creditLine.id,
        debitIds: [debitLine.id],
        creditIds: [creditLine.id],
        montant: debitLine.debit,
        score,
        raison:
          score >= 900
            ? `Montant identique et règlement à ${jours} jour${jours > 1 ? 's' : ''}.`
            : `Montant identique, écart de ${jours} jours.`,
      })
    }
  }

  candidates.sort((a, b) => b.score - a.score || a.montant - b.montant)

  const pris = new Set<string>()
  const retenus: LetteringMatch[] = []
  for (const candidate of candidates) {
    if (pris.has(candidate.debitId) || pris.has(candidate.creditId)) continue
    pris.add(candidate.debitId)
    pris.add(candidate.creditId)
    retenus.push({
      debitIds: candidate.debitIds,
      creditIds: candidate.creditIds,
      montant: candidate.montant,
      score: candidate.score,
      raison: candidate.raison,
    })
  }
  return retenus
}

/** Solde restant dû d'un compte de tiers : lignes non lettrées uniquement. */
export function soldeOuvert(lines: readonly LetterableLine[]): Cents {
  let total = 0
  for (const line of lines) {
    if (line.lettre == null) total += line.debit - line.credit
  }
  return total
}
