import { formatMontant, type Centimes } from '../core/montant'
import { formatDateFec, type DateComptable } from '../core/dates'
import { resoudreCompte } from '../referentiel/plan-comptable'
import { trouverJournal } from '../referentiel/journaux'
import type { Dossier } from '../types/dossier'
import type { Ecriture } from '../types/ecriture'
import { filtrerEcritures } from '../calculs/grand-livre'

/**
 * Fichier des écritures comptables, article A. 47 A-1 du livre des procédures
 * fiscales : dix-huit champs, séparateur tabulation, en-tête nommé, dates au
 * format AAAAMMJJ, montants à deux décimales avec la virgule.
 */
export const CHAMPS_FEC = [
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

export type ChampFEC = (typeof CHAMPS_FEC)[number]
export type LigneFEC = Record<ChampFEC, string>

export const SEPARATEUR_FEC = '\t'

/** Nom réglementaire : SIREN, « FEC », date de clôture, extension txt. */
export function nomFichierFEC(dossier: Dossier): string {
  return `${dossier.siren}FEC${formatDateFec(dossier.exerciceFin)}.txt`
}

function montantFEC(centimes: Centimes): string {
  return formatMontant(centimes).replace(/[\s\u00a0\u202f]/g, '')
}

function nettoyer(texte: string): string {
  return texte.replace(/[\t\r\n]+/g, ' ').trim()
}

export interface OptionsFEC {
  /** Date de validation par défaut, si l'écriture n'en porte pas. */
  dateValidationParDefaut?: DateComptable
}

/** Construit les lignes du FEC, numérotées chronologiquement par journal. */
export function lignesFEC(
  dossier: Dossier,
  ecritures: readonly Ecriture[],
  options: OptionsFEC = {},
): LigneFEC[] {
  const retenues = filtrerEcritures(ecritures, {
    seulementValidees: true,
    dateMin: dossier.exerciceDebut,
    dateMax: dossier.exerciceFin,
  })

  const compteurs = new Map<string, number>()
  const lignes: LigneFEC[] = []

  for (const ecriture of retenues) {
    const rang = (compteurs.get(ecriture.journalCode) ?? 0) + 1
    compteurs.set(ecriture.journalCode, rang)
    const numero = `${ecriture.journalCode}${String(rang).padStart(6, '0')}`
    const journal = trouverJournal(ecriture.journalCode)
    const dateValidation =
      ecriture.dateValidation ?? options.dateValidationParDefaut ?? dossier.exerciceFin

    for (const ligne of ecriture.lignes) {
      const compte = resoudreCompte(ligne.compteNumero)
      lignes.push({
        JournalCode: ecriture.journalCode,
        JournalLib: nettoyer(journal?.libelle ?? ecriture.journalCode),
        EcritureNum: numero,
        EcritureDate: formatDateFec(ecriture.date),
        CompteNum: ligne.compteNumero,
        CompteLib: nettoyer(compte?.libelle ?? ligne.libelle),
        CompAuxNum: ligne.auxiliaire ?? '',
        CompAuxLib: ligne.auxiliaire ? nettoyer(ligne.libelle) : '',
        PieceRef: nettoyer(ecriture.numeroPiece),
        PieceDate: formatDateFec(ecriture.date),
        EcritureLib: nettoyer(ligne.libelle || ecriture.libelle),
        Debit: montantFEC(ligne.debit),
        Credit: montantFEC(ligne.credit),
        EcritureLet: ligne.lettrage ?? '',
        DateLet: ligne.dateLettrage ? formatDateFec(ligne.dateLettrage) : '',
        ValidDate: formatDateFec(dateValidation),
        Montantdevise: '',
        Idevise: '',
      })
    }
  }

  return lignes
}

export function exporterFEC(
  dossier: Dossier,
  ecritures: readonly Ecriture[],
  options: OptionsFEC = {},
): { nom: string; contenu: string } {
  const lignes = lignesFEC(dossier, ecritures, options)
  const corps = lignes.map((ligne) => CHAMPS_FEC.map((champ) => ligne[champ]).join(SEPARATEUR_FEC))
  return {
    nom: nomFichierFEC(dossier),
    contenu: [CHAMPS_FEC.join(SEPARATEUR_FEC), ...corps].join('\r\n') + '\r\n',
  }
}

export interface AnomalieFEC {
  ligne: number
  champ?: ChampFEC
  message: string
}

/**
 * Relit un FEC et signale ses anomalies de structure.
 * Sert de contrôle de sortie : un fichier produit par FOLIO doit se relire
 * sans aucune anomalie.
 */
export function analyserFEC(contenu: string): { lignes: LigneFEC[]; anomalies: AnomalieFEC[] } {
  const anomalies: AnomalieFEC[] = []
  const lignesBrutes = contenu.split(/\r?\n/).filter((ligne) => ligne !== '')
  if (lignesBrutes.length === 0) {
    return { lignes: [], anomalies: [{ ligne: 0, message: 'Fichier vide.' }] }
  }

  const entete = lignesBrutes[0]!.split(SEPARATEUR_FEC)
  if (entete.length !== CHAMPS_FEC.length) {
    anomalies.push({
      ligne: 1,
      message: `L’en-tête compte ${entete.length} champs au lieu de ${CHAMPS_FEC.length}.`,
    })
  }
  CHAMPS_FEC.forEach((champ, index) => {
    if (entete[index] !== champ) {
      anomalies.push({ ligne: 1, champ, message: `Champ ${index + 1} attendu « ${champ} ».` })
    }
  })

  const lignes: LigneFEC[] = []
  let totalDebit = 0
  let totalCredit = 0

  lignesBrutes.slice(1).forEach((brute, index) => {
    const numeroLigne = index + 2
    const valeurs = brute.split(SEPARATEUR_FEC)
    if (valeurs.length !== CHAMPS_FEC.length) {
      anomalies.push({
        ligne: numeroLigne,
        message: `${valeurs.length} champs au lieu de ${CHAMPS_FEC.length}.`,
      })
      return
    }
    const ligne = Object.fromEntries(
      CHAMPS_FEC.map((champ, position) => [champ, valeurs[position]!]),
    ) as LigneFEC
    lignes.push(ligne)

    for (const champ of ['EcritureDate', 'PieceDate', 'ValidDate'] as const) {
      if (!/^\d{8}$/.test(ligne[champ])) {
        anomalies.push({ ligne: numeroLigne, champ, message: 'Date attendue au format AAAAMMJJ.' })
      }
    }
    if (ligne.DateLet !== '' && !/^\d{8}$/.test(ligne.DateLet)) {
      anomalies.push({ ligne: numeroLigne, champ: 'DateLet', message: 'Date attendue au format AAAAMMJJ.' })
    }
    for (const champ of ['Debit', 'Credit'] as const) {
      if (!/^-?\d+,\d{2}$/.test(ligne[champ])) {
        anomalies.push({
          ligne: numeroLigne,
          champ,
          message: 'Montant attendu à deux décimales, virgule décimale.',
        })
      }
    }
    if (ligne.CompteNum.trim() === '') {
      anomalies.push({ ligne: numeroLigne, champ: 'CompteNum', message: 'Numéro de compte absent.' })
    }
    if (ligne.EcritureNum.trim() === '') {
      anomalies.push({ ligne: numeroLigne, champ: 'EcritureNum', message: 'Numéro d’écriture absent.' })
    }
    if (ligne.PieceRef.trim() === '') {
      anomalies.push({ ligne: numeroLigne, champ: 'PieceRef', message: 'Référence de pièce absente.' })
    }
    totalDebit += lireMontantFEC(ligne.Debit)
    totalCredit += lireMontantFEC(ligne.Credit)
  })

  if (totalDebit !== totalCredit) {
    anomalies.push({
      ligne: 0,
      message: `Le fichier est déséquilibré : ${formatMontant(totalDebit)} au débit contre ${formatMontant(totalCredit)} au crédit.`,
    })
  }

  return { lignes, anomalies }
}

export function lireMontantFEC(valeur: string): Centimes {
  const nettoye = valeur.replace(/\s/g, '').replace(',', '.')
  const nombre = Number(nettoye)
  return Number.isFinite(nombre) ? Math.round(nombre * 100) : 0
}
