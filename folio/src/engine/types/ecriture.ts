import type { Centimes } from '../core/montant'
import type { DateComptable } from '../core/dates'
import type { CodeJournal } from './journal'

export interface LigneEcriture {
  compteNumero: string
  libelle: string
  debit: Centimes
  credit: Centimes
  /** Date d'échéance, pour la balance âgée des comptes de tiers. */
  echeance?: DateComptable
  /** Compte auxiliaire (code client ou fournisseur). */
  auxiliaire?: string
  /** Code de lettrage porté sur la ligne (A, AA, AB…). */
  lettrage?: string
  /** Date à laquelle le lettrage a été posé. */
  dateLettrage?: DateComptable
  /** La ligne a été pointée lors d'un rapprochement bancaire. */
  pointee?: boolean
}

export interface Ecriture {
  id: string
  dossierId: string
  journalCode: CodeJournal
  date: DateComptable
  numeroPiece: string
  libelle: string
  lignes: LigneEcriture[]
  validee: boolean
  /** Date de validation, obligatoire au FEC pour une écriture validée. */
  dateValidation?: DateComptable
  /** Référence de la pièce justificative rattachée. */
  pieceId?: string
}

export function totalDebit(ecriture: { lignes: readonly LigneEcriture[] }): Centimes {
  let total = 0
  for (const ligne of ecriture.lignes) total += ligne.debit
  return total
}

export function totalCredit(ecriture: { lignes: readonly LigneEcriture[] }): Centimes {
  let total = 0
  for (const ligne of ecriture.lignes) total += ligne.credit
  return total
}

/** Écart débit-crédit. Zéro quand l'écriture est équilibrée. */
export function desequilibre(ecriture: { lignes: readonly LigneEcriture[] }): Centimes {
  return totalDebit(ecriture) - totalCredit(ecriture)
}
