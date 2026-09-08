/**
 * L'état de l'atelier et sa persistance.
 *
 * Tout vit dans le navigateur : aucun compte à créer, aucun serveur à joindre.
 * L'atelier doit s'ouvrir en cours, sur un téléphone, sans réseau — c'est la
 * seule contrainte qui compte pour un étudiant à qui l'on demande de passer
 * une écriture dans les dix minutes.
 */

import type { Cents } from '../../lib/accounting/money'

export interface LigneSaisie {
  id: string
  compte: string
  libelleCompte: string
  libelle: string
  debit: Cents
  credit: Cents
}

export interface EcritureSaisie {
  id: string
  date: string
  journal: string
  piece: string
  libelle: string
  lignes: LigneSaisie[]
  /** Renseigné quand l'écriture vient d'un exercice corrigé. */
  exerciceId?: string
}

export interface Etat {
  readonly version: 1
  ecritures: EcritureSaisie[]
  /** Exercices réussis, pour suivre sa progression. */
  reussis: string[]
  onglet: Onglet
}

export type Onglet = 'journal' | 'grandlivre' | 'balance' | 'bilan' | 'resultat' | 'exercices'

export const JOURNAUX = [
  { code: 'AC', libelle: 'Achats' },
  { code: 'VE', libelle: 'Ventes' },
  { code: 'BQ', libelle: 'Banque' },
  { code: 'CA', libelle: 'Caisse' },
  { code: 'OD', libelle: 'Opérations diverses' },
] as const

const CLE = 'atelier-comptable-v1'

export function etatVide(): Etat {
  return { version: 1, ecritures: [], reussis: [], onglet: 'journal' }
}

export function charger(): Etat {
  try {
    const brut = localStorage.getItem(CLE)
    if (!brut) return etatVide()
    const lu = JSON.parse(brut) as Partial<Etat>
    if (lu.version !== 1 || !Array.isArray(lu.ecritures)) return etatVide()
    return {
      version: 1,
      ecritures: lu.ecritures,
      reussis: Array.isArray(lu.reussis) ? lu.reussis : [],
      onglet: lu.onglet ?? 'journal',
    }
  } catch {
    // Navigation privée, stockage plein, données corrompues : on repart d'un
    // atelier vide plutôt que de planter au chargement.
    return etatVide()
  }
}

export function enregistrer(etat: Etat): void {
  try {
    localStorage.setItem(CLE, JSON.stringify(etat))
  } catch {
    // Le travail de la séance reste en mémoire même si l'écriture échoue.
  }
}

let compteur = 0
export function identifiant(): string {
  compteur += 1
  return `${Date.now().toString(36)}-${compteur.toString(36)}`
}

export function ligneVide(): LigneSaisie {
  return { id: identifiant(), compte: '', libelleCompte: '', libelle: '', debit: 0, credit: 0 }
}

export function ecritureVide(): EcritureSaisie {
  const aujourdhui = new Date().toISOString().slice(0, 10)
  return {
    id: identifiant(),
    date: aujourdhui,
    journal: 'AC',
    piece: '',
    libelle: '',
    lignes: [ligneVide(), ligneVide()],
  }
}

export function totaux(lignes: readonly LigneSaisie[]): {
  debit: Cents
  credit: Cents
  ecart: Cents
  equilibree: boolean
} {
  const debit = lignes.reduce((total, ligne) => total + ligne.debit, 0)
  const credit = lignes.reduce((total, ligne) => total + ligne.credit, 0)
  return {
    debit,
    credit,
    ecart: debit - credit,
    equilibree: debit === credit && debit > 0,
  }
}

/** Une écriture n'entre au journal que complète : équilibrée, comptes remplis. */
export function recevable(ecriture: EcritureSaisie): boolean {
  const remplies = ecriture.lignes.filter(
    (ligne) => ligne.compte.length >= 3 && (ligne.debit > 0 || ligne.credit > 0),
  )
  if (remplies.length < 2) return false
  return totaux(remplies).equilibree && ecriture.libelle.trim().length > 0
}

/** Les lignes réellement saisies, prêtes à être enregistrées. */
export function lignesUtiles(ecriture: EcritureSaisie): LigneSaisie[] {
  return ecriture.lignes.filter(
    (ligne) => ligne.compte.length >= 3 && (ligne.debit > 0 || ligne.credit > 0),
  )
}
