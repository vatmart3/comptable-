import { somme, type Centimes } from '../core/montant'
import type { DateComptable } from '../core/dates'
import { resoudreCompte } from '../referentiel/plan-comptable'
import type { Ecriture, LigneEcriture } from '../types/ecriture'

export interface ReferenceLigne {
  ecritureId: string
  ligneIndex: number
}

export interface LigneLettrable extends ReferenceLigne {
  compteNumero: string
  date: DateComptable
  numeroPiece: string
  libelle: string
  debit: Centimes
  credit: Centimes
  lettrage?: string
}

/** Lettres de lettrage : A à Z, puis AA, AB… L'ordre est stable. */
export function prochaineLettre(dejaUtilisees: Iterable<string>): string {
  const utilisees = new Set(dejaUtilisees)
  for (let rang = 0; ; rang += 1) {
    const lettre = lettreDeRang(rang)
    if (!utilisees.has(lettre)) return lettre
  }
}

export function lettreDeRang(rang: number): string {
  let reste = rang
  let lettre = ''
  do {
    lettre = String.fromCharCode(65 + (reste % 26)) + lettre
    reste = Math.floor(reste / 26) - 1
  } while (reste >= 0)
  return lettre
}

export function lignesLettrables(
  ecritures: readonly Ecriture[],
  compteNumero: string,
): LigneLettrable[] {
  const compte = resoudreCompte(compteNumero)
  if (compte && !compte.lettrable) return []
  const lignes: LigneLettrable[] = []
  for (const ecriture of ecritures) {
    ecriture.lignes.forEach((ligne, ligneIndex) => {
      if (ligne.compteNumero !== compteNumero) return
      lignes.push({
        ecritureId: ecriture.id,
        ligneIndex,
        compteNumero: ligne.compteNumero,
        date: ecriture.date,
        numeroPiece: ecriture.numeroPiece,
        libelle: ligne.libelle || ecriture.libelle,
        debit: ligne.debit,
        credit: ligne.credit,
        ...(ligne.lettrage ? { lettrage: ligne.lettrage } : {}),
      })
    })
  }
  return lignes.sort((a, b) => a.date.localeCompare(b.date) || a.numeroPiece.localeCompare(b.numeroPiece))
}

/** Un groupe ne se lettre que si son débit égale son crédit. */
export function groupeEquilibre(lignes: readonly Pick<LigneEcriture, 'debit' | 'credit'>[]): boolean {
  return somme(lignes.map((l) => l.debit)) === somme(lignes.map((l) => l.credit))
}

export interface ResultatLettrage {
  possible: boolean
  ecart: Centimes
  lettre?: string
}

export function verifierLettrage(
  lignes: readonly Pick<LigneEcriture, 'debit' | 'credit'>[],
  lettresUtilisees: Iterable<string> = [],
): ResultatLettrage {
  const ecart = somme(lignes.map((l) => l.debit)) - somme(lignes.map((l) => l.credit))
  if (lignes.length < 2 || ecart !== 0) return { possible: false, ecart }
  return { possible: true, ecart: 0, lettre: prochaineLettre(lettresUtilisees) }
}

/**
 * Lettrage automatique : rapproche une facture de son règlement quand les
 * montants coïncident exactement. Ne devine rien au-delà.
 */
export function lettrageAutomatique(lignes: readonly LigneLettrable[]): {
  groupes: LigneLettrable[][]
  lettres: string[]
} {
  const disponibles = lignes.filter((ligne) => !ligne.lettrage)
  const debits = disponibles.filter((l) => l.debit > 0)
  const credits = disponibles.filter((l) => l.credit > 0)
  const consommes = new Set<string>()
  const groupes: LigneLettrable[][] = []
  const lettres: string[] = []
  const cle = (ligne: ReferenceLigne) => `${ligne.ecritureId}#${ligne.ligneIndex}`

  for (const debit of debits) {
    if (consommes.has(cle(debit))) continue
    const credit = credits.find((c) => !consommes.has(cle(c)) && c.credit === debit.debit)
    if (!credit) continue
    consommes.add(cle(debit))
    consommes.add(cle(credit))
    const lettre = prochaineLettre([...lignes.flatMap((l) => (l.lettrage ? [l.lettrage] : [])), ...lettres])
    lettres.push(lettre)
    groupes.push([debit, credit])
  }

  return { groupes, lettres }
}

/** Applique un lettrage aux écritures et renvoie une copie modifiée. */
export function appliquerLettrage(
  ecritures: readonly Ecriture[],
  references: readonly ReferenceLigne[],
  lettre: string,
  dateLettrage?: DateComptable,
): Ecriture[] {
  const cibles = new Set(references.map((r) => `${r.ecritureId}#${r.ligneIndex}`))
  return ecritures.map((ecriture) => ({
    ...ecriture,
    lignes: ecriture.lignes.map((ligne, index) =>
      cibles.has(`${ecriture.id}#${index}`)
        ? { ...ligne, lettrage: lettre, ...(dateLettrage ? { dateLettrage } : {}) }
        : ligne,
    ),
  }))
}

/** Comptes de tiers soldés dont les écritures ne sont pas lettrées. */
export function comptesSoldesNonLettres(ecritures: readonly Ecriture[]): string[] {
  const parCompte = new Map<string, { solde: Centimes; nonLettrees: number }>()
  for (const ecriture of ecritures) {
    for (const ligne of ecriture.lignes) {
      const compte = resoudreCompte(ligne.compteNumero)
      if (!compte?.lettrable) continue
      const entree = parCompte.get(ligne.compteNumero) ?? { solde: 0, nonLettrees: 0 }
      entree.solde += ligne.debit - ligne.credit
      if (!ligne.lettrage) entree.nonLettrees += 1
      parCompte.set(ligne.compteNumero, entree)
    }
  }
  return [...parCompte.entries()]
    .filter(([, valeur]) => valeur.solde === 0 && valeur.nonLettrees > 0)
    .map(([numero]) => numero)
    .sort()
}
