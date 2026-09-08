/**
 * Fichier des Écritures Comptables (FEC).
 *
 * Arrêté du 29 juillet 2013, art. A47 A-1 du LPF : 18 champs, dans cet ordre,
 * séparateur `|` ou tabulation, encodage UTF-8 ou ISO 8859-15, dates au format
 * AAAAMMJJ, nom du fichier `SIRENFECAAAAMMJJ.txt` où AAAAMMJJ est la date de
 * clôture de l'exercice.
 *
 * Trois contraintes qu'on oublie souvent et qui font rejeter un FEC :
 *   - seules les écritures VALIDÉES y figurent (jamais les brouillons) ;
 *   - un champ ne peut pas contenir le séparateur ni un retour à la ligne ;
 *   - `EcritureLet` et `DateLet` vont par paire : lettré sans date, ou l'inverse,
 *     est une anomalie.
 */

import { formatPlain, type Cents } from './money'

export const FEC_SEPARATOR = '|'

export const FEC_FIELDS = [
  'JournalCode',
  'JournalLib',
  'EcritureNum',
  'EcritureDate',
  'CompteNum',
  'CompteLib',
  'CompAuxNum',
  'CompAuxLib',
  'PieceRef',
  'PieceDate',
  'EcritureLib',
  'Debit',
  'Credit',
  'EcritureLet',
  'DateLet',
  'ValidDate',
  'Montantdevise',
  'Idevise',
] as const

export type FecField = (typeof FEC_FIELDS)[number]

export interface FecSourceLine {
  readonly journalCode: string
  readonly journalLib: string
  readonly ecritureNum: string
  readonly ecritureDate: Date
  readonly compteNum: string
  readonly compteLib: string
  readonly compAuxNum: string | null
  readonly compAuxLib: string | null
  readonly pieceRef: string | null
  readonly pieceDate: Date | null
  readonly ecritureLib: string
  readonly debit: Cents
  readonly credit: Cents
  readonly ecritureLet: string | null
  readonly dateLet: Date | null
  readonly validDate: Date
  readonly montantDevise: Cents | null
  readonly idevise: string | null
}

/** AAAAMMJJ, en UTC : un FEC ne dépend pas du fuseau de celui qui l'exporte. */
export function fecDate(date: Date | null): string {
  if (!date) return ''
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}${month}${day}`
}

/**
 * Nettoie un champ : le séparateur et les sauts de ligne sont interdits,
 * sous peine de décaler toutes les colonnes suivantes.
 */
export function fecField(value: string | null | undefined): string {
  if (value == null) return ''
  return value.replace(/[|\t\r\n]/g, ' ').replace(/\s{2,}/g, ' ').trim()
}

export function fecRow(line: FecSourceLine): string {
  const cells: string[] = [
    fecField(line.journalCode),
    fecField(line.journalLib),
    fecField(line.ecritureNum),
    fecDate(line.ecritureDate),
    fecField(line.compteNum),
    fecField(line.compteLib),
    fecField(line.compAuxNum),
    fecField(line.compAuxLib),
    fecField(line.pieceRef),
    fecDate(line.pieceDate ?? line.ecritureDate),
    fecField(line.ecritureLib),
    formatPlain(line.debit),
    formatPlain(line.credit),
    fecField(line.ecritureLet),
    fecDate(line.dateLet),
    fecDate(line.validDate),
    line.montantDevise == null ? '' : formatPlain(line.montantDevise),
    fecField(line.idevise),
  ]
  return cells.join(FEC_SEPARATOR)
}

export function fecHeader(): string {
  return FEC_FIELDS.join(FEC_SEPARATOR)
}

/** Le fichier complet. Retours à la ligne en \r\n, comme l'attend l'administration. */
export function buildFec(lines: readonly FecSourceLine[]): string {
  return [fecHeader(), ...lines.map(fecRow)].join('\r\n') + '\r\n'
}

/** `123456789FEC20251231.txt` */
export function fecFileName(siren: string, dateCloture: Date): string {
  const digits = siren.replace(/\D/g, '').slice(0, 9)
  return `${digits}FEC${fecDate(dateCloture)}.txt`
}

// ── Contrôle du fichier produit ─────────────────────────────────────────────

export interface FecProblem {
  readonly ligne: number
  readonly champ: FecField | 'structure'
  readonly message: string
}

/**
 * Relit le FEC produit et vérifie ce que l'administration vérifiera :
 * nombre de colonnes, format des dates, équilibre global, cohérence du lettrage.
 */
export function auditFec(content: string): FecProblem[] {
  const problems: FecProblem[] = []
  const rows = content.split(/\r?\n/).filter((row) => row.length > 0)

  if (rows.length === 0) {
    return [{ ligne: 0, champ: 'structure', message: 'Fichier vide.' }]
  }

  const header = rows[0]?.split(FEC_SEPARATOR) ?? []
  if (header.length !== FEC_FIELDS.length) {
    problems.push({
      ligne: 1,
      champ: 'structure',
      message: `En-tête : ${header.length} colonnes au lieu de ${FEC_FIELDS.length}.`,
    })
  }
  FEC_FIELDS.forEach((field, index) => {
    if (header[index] !== field) {
      problems.push({
        ligne: 1,
        champ: field,
        message: `Colonne ${index + 1} : « ${header[index] ?? ''} » au lieu de « ${field} ».`,
      })
    }
  })

  let totalDebit = 0
  let totalCredit = 0

  for (let index = 1; index < rows.length; index += 1) {
    const row = rows[index]
    if (row === undefined) continue
    const cells = row.split(FEC_SEPARATOR)
    const ligne = index + 1

    if (cells.length !== FEC_FIELDS.length) {
      problems.push({
        ligne,
        champ: 'structure',
        message: `${cells.length} colonnes au lieu de ${FEC_FIELDS.length}.`,
      })
      continue
    }

    const cell = (field: FecField): string => cells[FEC_FIELDS.indexOf(field)] ?? ''

    for (const field of ['EcritureDate', 'ValidDate'] as const) {
      if (!/^\d{8}$/.test(cell(field))) {
        problems.push({ ligne, champ: field, message: `Date « ${cell(field)} » : format AAAAMMJJ attendu.` })
      }
    }
    for (const field of ['PieceDate', 'DateLet'] as const) {
      const value = cell(field)
      if (value !== '' && !/^\d{8}$/.test(value)) {
        problems.push({ ligne, champ: field, message: `Date « ${value} » : format AAAAMMJJ attendu.` })
      }
    }

    for (const field of ['JournalCode', 'EcritureNum', 'CompteNum', 'EcritureLib'] as const) {
      if (cell(field) === '') {
        problems.push({ ligne, champ: field, message: 'Champ obligatoire vide.' })
      }
    }

    const debit = parseFecAmount(cell('Debit'))
    const credit = parseFecAmount(cell('Credit'))
    if (debit == null) {
      problems.push({ ligne, champ: 'Debit', message: `Montant illisible : « ${cell('Debit')} ».` })
    }
    if (credit == null) {
      problems.push({ ligne, champ: 'Credit', message: `Montant illisible : « ${cell('Credit')} ».` })
    }
    if (debit != null && credit != null) {
      if (debit !== 0 && credit !== 0) {
        problems.push({ ligne, champ: 'Debit', message: 'Débit et crédit renseignés sur la même ligne.' })
      }
      totalDebit += debit
      totalCredit += credit
    }

    const lettre = cell('EcritureLet')
    const dateLet = cell('DateLet')
    if ((lettre === '') !== (dateLet === '')) {
      problems.push({
        ligne,
        champ: 'EcritureLet',
        message: 'Lettrage incomplet : la lettre et la date de lettrage vont par paire.',
      })
    }
  }

  if (totalDebit !== totalCredit) {
    problems.push({
      ligne: 0,
      champ: 'structure',
      message: `Fichier déséquilibré : ${formatPlain(totalDebit)} au débit contre ${formatPlain(totalCredit)} au crédit.`,
    })
  }

  return problems
}

export function parseFecAmount(value: string): Cents | null {
  const trimmed = value.trim()
  if (trimmed === '') return 0
  if (!/^-?\d+([.,]\d{1,2})?$/.test(trimmed)) return null
  const normalized = trimmed.replace(',', '.')
  const parsed = Number(normalized)
  if (!Number.isFinite(parsed)) return null
  return Math.round(parsed * 100)
}
