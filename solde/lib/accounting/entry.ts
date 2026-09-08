/**
 * L'écriture : structure, invariants, contre-passation.
 *
 * Les trois invariants tenus ici sont ceux qui font qu'un registre est une
 * comptabilité et non un tableur :
 *   1. partie double  — somme(débits) = somme(crédits) ;
 *   2. unilatéralité  — une ligne porte un débit OU un crédit, jamais les deux,
 *                       jamais rien ;
 *   3. immutabilité   — une écriture validée ne se modifie pas, elle se
 *                       contre-passe.
 */

import { z } from 'zod'
import { assertCents, sumCents, type Cents } from './money'
import { isValidAccountNumber } from './account'

export const ENTRY_STATUSES = ['brouillon', 'validee'] as const
export type EntryStatus = (typeof ENTRY_STATUSES)[number]

export const JOURNAL_TYPES = ['achat', 'vente', 'banque', 'caisse', 'od', 'anouveaux'] as const
export type JournalType = (typeof JOURNAL_TYPES)[number]

export const ENTRY_ORIGINS = [
  'saisie',
  'import',
  'ia',
  'facturation',
  'amortissement',
  'tva',
  'anouveaux',
  'contrepassation',
] as const
export type EntryOrigin = (typeof ENTRY_ORIGINS)[number]

export const lineSchema = z
  .object({
    accountNumero: z.string().refine(isValidAccountNumber, {
      message: 'Numéro de compte hors plan comptable',
    }),
    debit: z.number().int().min(0).default(0),
    credit: z.number().int().min(0).default(0),
    libelle: z.string().min(1, 'Libellé de ligne obligatoire').max(200),
    position: z.number().int().min(0).default(0),
    lettre: z.string().regex(/^[A-Z]{1,3}$/).nullable().default(null),
    echeance: z.date().nullable().default(null),
    partnerCode: z.string().nullable().default(null),
    analyticSectionCode: z.string().nullable().default(null),
  })
  .refine((line) => (line.debit > 0) !== (line.credit > 0), {
    message: 'Une ligne porte soit un débit, soit un crédit — jamais les deux, jamais zéro',
  })

export type EntryLineInput = z.input<typeof lineSchema>
export type EntryLine = z.output<typeof lineSchema>

export const entrySchema = z.object({
  journalCode: z.string().min(1).max(8),
  date: z.date(),
  libelle: z.string().min(1, 'Libellé obligatoire').max(200),
  pieceRef: z.string().max(60).nullable().default(null),
  origine: z.enum(ENTRY_ORIGINS).default('saisie'),
  lines: z.array(lineSchema).min(2, 'Une écriture compte au moins deux lignes'),
})

export type EntryInput = z.input<typeof entrySchema>
export type Entry = z.output<typeof entrySchema>

export interface EntryTotals {
  readonly debit: Cents
  readonly credit: Cents
  /** débit − crédit. Zéro = équilibre. Signé : la balance penche du côté du signe. */
  readonly ecart: Cents
}

export function totals(lines: readonly { debit: Cents; credit: Cents }[]): EntryTotals {
  const debit = sumCents(lines.map((l) => assertCents(l.debit, 'débit')))
  const credit = sumCents(lines.map((l) => assertCents(l.credit, 'crédit')))
  return { debit, credit, ecart: debit - credit }
}

export function isBalanced(lines: readonly { debit: Cents; credit: Cents }[]): boolean {
  return totals(lines).ecart === 0
}

export type EntryProblemCode =
  | 'desequilibre'
  | 'ligne_bilaterale'
  | 'ligne_vide'
  | 'lignes_insuffisantes'
  | 'compte_invalide'
  | 'montant_non_entier'
  | 'date_hors_exercice'
  | 'exercice_clos'
  | 'ecriture_validee'

export interface EntryProblem {
  readonly code: EntryProblemCode
  readonly message: string
  /** Index de la ligne fautive, si le problème est local. */
  readonly ligne?: number
}

export interface FiscalPeriod {
  readonly dateDebut: Date
  readonly dateFin: Date
  readonly statut: 'ouvert' | 'en_cloture' | 'cloture'
}

/**
 * Contrôle complet avant enregistrement. Renvoie la liste des problèmes
 * plutôt que de lever : l'interface a besoin de tous les torts d'un coup,
 * pas du premier rencontré.
 */
export function checkEntry(
  entry: { lines: readonly EntryLine[]; date: Date },
  period?: FiscalPeriod,
): EntryProblem[] {
  const problems: EntryProblem[] = []

  if (entry.lines.length < 2) {
    problems.push({
      code: 'lignes_insuffisantes',
      message: 'Une écriture en partie double compte au moins deux lignes.',
    })
  }

  entry.lines.forEach((line, index) => {
    if (!Number.isSafeInteger(line.debit) || !Number.isSafeInteger(line.credit)) {
      problems.push({
        code: 'montant_non_entier',
        message: 'Les montants sont des entiers de centimes.',
        ligne: index,
      })
      return
    }
    if (line.debit > 0 && line.credit > 0) {
      problems.push({
        code: 'ligne_bilaterale',
        message: 'Une ligne ne peut pas être au débit et au crédit.',
        ligne: index,
      })
    }
    if (line.debit === 0 && line.credit === 0) {
      problems.push({
        code: 'ligne_vide',
        message: 'Une ligne sans montant n’a rien à faire dans un journal.',
        ligne: index,
      })
    }
    if (!isValidAccountNumber(line.accountNumero)) {
      problems.push({
        code: 'compte_invalide',
        message: `Le compte ${line.accountNumero} n’existe pas au plan comptable.`,
        ligne: index,
      })
    }
  })

  const { ecart } = totals(entry.lines)
  if (ecart !== 0) {
    problems.push({
      code: 'desequilibre',
      message: 'Débit et crédit ne s’équilibrent pas.',
    })
  }

  if (period) {
    if (entry.date < period.dateDebut || entry.date > period.dateFin) {
      problems.push({
        code: 'date_hors_exercice',
        message: 'La date sort de l’exercice sélectionné.',
      })
    }
    if (period.statut === 'cloture') {
      problems.push({
        code: 'exercice_clos',
        message: 'L’exercice est clôturé : plus aucune écriture ne peut y entrer.',
      })
    }
  }

  return problems
}

export function assertRecordable(
  entry: { lines: readonly EntryLine[]; date: Date },
  period?: FiscalPeriod,
): void {
  const problems = checkEntry(entry, period)
  if (problems.length > 0) {
    throw new EntryValidationError(problems)
  }
}

export class EntryValidationError extends Error {
  readonly problems: readonly EntryProblem[]

  constructor(problems: readonly EntryProblem[]) {
    super(problems.map((p) => p.message).join(' '))
    this.name = 'EntryValidationError'
    this.problems = problems
  }
}

/**
 * Contre-passation : l'unique façon légale de corriger une écriture validée.
 * Débits et crédits sont échangés, le lettrage n'est pas repris (les deux
 * écritures se lettreront ensemble), le libellé porte la trace de l'origine.
 */
export function reverse(
  entry: { readonly libelle: string; readonly lines: readonly EntryLine[]; readonly pieceRef: string | null },
  options: { readonly date: Date; readonly journalCode: string; readonly motif?: string },
): Entry {
  return {
    journalCode: options.journalCode,
    date: options.date,
    libelle: options.motif
      ? `Extourne — ${entry.libelle} (${options.motif})`
      : `Extourne — ${entry.libelle}`,
    pieceRef: entry.pieceRef,
    origine: 'contrepassation',
    lines: entry.lines.map((line, index) => ({
      ...line,
      debit: line.credit,
      credit: line.debit,
      position: index,
      lettre: null,
      dateLettrage: null,
    })) as EntryLine[],
  }
}

/** Solde d'une ligne au sens du grand livre : débit positif, crédit négatif. */
export function signedAmount(line: { debit: Cents; credit: Cents }): Cents {
  return line.debit - line.credit
}
