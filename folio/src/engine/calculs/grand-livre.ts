import type { Centimes } from '../core/montant'
import { comparerDates, type DateComptable } from '../core/dates'
import { resoudreCompte } from '../referentiel/plan-comptable'
import type { Compte } from '../types/compte'
import type { Ecriture } from '../types/ecriture'
import type { CodeJournal } from '../types/journal'

export interface LigneGrandLivre {
  ecritureId: string
  date: DateComptable
  journalCode: CodeJournal
  numeroPiece: string
  libelle: string
  debit: Centimes
  credit: Centimes
  /** Solde après cette ligne, positif au débit. */
  soldeProgressif: Centimes
  lettrage?: string
  echeance?: DateComptable
}

export interface CompteGrandLivre {
  numero: string
  libelle: string
  compte: Compte | undefined
  lignes: LigneGrandLivre[]
  totalDebit: Centimes
  totalCredit: Centimes
  /** Solde algébrique : positif débiteur, négatif créditeur. */
  solde: Centimes
}

export interface OptionsRestitution {
  /** N'inclure que les écritures validées. Vrai par défaut. */
  seulementValidees?: boolean
  dateMin?: DateComptable
  dateMax?: DateComptable
  /** Restreindre à ces comptes, préfixes acceptés. */
  comptes?: readonly string[]
  journaux?: readonly CodeJournal[]
}

export function filtrerEcritures(
  ecritures: readonly Ecriture[],
  options: OptionsRestitution = {},
): Ecriture[] {
  const seulementValidees = options.seulementValidees ?? true
  return ecritures
    .filter((e) => (seulementValidees ? e.validee : true))
    .filter((e) => (options.dateMin ? comparerDates(e.date, options.dateMin) >= 0 : true))
    .filter((e) => (options.dateMax ? comparerDates(e.date, options.dateMax) <= 0 : true))
    .filter((e) => (options.journaux ? options.journaux.includes(e.journalCode) : true))
    .sort(
      (a, b) =>
        comparerDates(a.date, b.date) ||
        a.journalCode.localeCompare(b.journalCode) ||
        a.numeroPiece.localeCompare(b.numeroPiece, 'fr', { numeric: true }) ||
        a.id.localeCompare(b.id),
    )
}

const concerne = (numero: string, filtres?: readonly string[]): boolean =>
  filtres === undefined || filtres.some((filtre) => numero.startsWith(filtre))

/** Grand livre : les comptes, chacun avec son détail et son solde progressif. */
export function grandLivre(
  ecritures: readonly Ecriture[],
  options: OptionsRestitution = {},
): CompteGrandLivre[] {
  const parCompte = new Map<string, CompteGrandLivre>()

  for (const ecriture of filtrerEcritures(ecritures, options)) {
    for (const ligne of ecriture.lignes) {
      if (!concerne(ligne.compteNumero, options.comptes)) continue
      let compte = parCompte.get(ligne.compteNumero)
      if (!compte) {
        const reference = resoudreCompte(ligne.compteNumero)
        compte = {
          numero: ligne.compteNumero,
          libelle: reference?.libelle ?? ligne.libelle,
          compte: reference,
          lignes: [],
          totalDebit: 0,
          totalCredit: 0,
          solde: 0,
        }
        parCompte.set(ligne.compteNumero, compte)
      }
      compte.totalDebit += ligne.debit
      compte.totalCredit += ligne.credit
      compte.solde = compte.totalDebit - compte.totalCredit
      compte.lignes.push({
        ecritureId: ecriture.id,
        date: ecriture.date,
        journalCode: ecriture.journalCode,
        numeroPiece: ecriture.numeroPiece,
        libelle: ligne.libelle || ecriture.libelle,
        debit: ligne.debit,
        credit: ligne.credit,
        soldeProgressif: compte.solde,
        ...(ligne.lettrage ? { lettrage: ligne.lettrage } : {}),
        ...(ligne.echeance ? { echeance: ligne.echeance } : {}),
      })
    }
  }

  return [...parCompte.values()].sort((a, b) => a.numero.localeCompare(b.numero))
}

/** Journal général : les écritures dans l'ordre, tous journaux confondus. */
export function journalGeneral(
  ecritures: readonly Ecriture[],
  options: OptionsRestitution = {},
): Ecriture[] {
  return filtrerEcritures(ecritures, options)
}
