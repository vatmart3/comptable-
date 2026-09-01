import type { Centimes } from '../core/montant'

/** Classe du plan comptable général : 1 à 5 pour le bilan, 6 et 7 pour la gestion. */
export type ClasseCompte = 1 | 2 | 3 | 4 | 5 | 6 | 7

/** Un compte alimente soit le bilan, soit le compte de résultat. */
export type TypeCompte = 'bilan' | 'gestion'

/** Sens dans lequel le compte fonctionne habituellement. */
export type SensNormal = 'debit' | 'credit' | 'mixte'

export interface Compte {
  numero: string
  libelle: string
  classe: ClasseCompte
  type: TypeCompte
  /** Le compte accepte le lettrage (comptes de tiers). */
  lettrable: boolean
  /** Le compte accepte le rapprochement bancaire (comptes 512, 514, 53). */
  rapprochable: boolean
  /** Sens habituel, utilisé pour détecter une écriture passée à l'envers. */
  sensNormal: SensNormal
  /** Le compte tient une comptabilité auxiliaire (clients, fournisseurs). */
  auxiliaire?: boolean
}

export interface SoldeCompte {
  compte: Compte
  totalDebit: Centimes
  totalCredit: Centimes
  /** Solde algébrique : positif au débit, négatif au crédit. */
  solde: Centimes
}
