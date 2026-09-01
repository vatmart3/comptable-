/** Journaux obligatoires du dossier d'entraînement. */
export type CodeJournal = 'AN' | 'AC' | 'VE' | 'BQ' | 'CA' | 'OD'

export type NatureJournal =
  | 'a-nouveaux'
  | 'achats'
  | 'ventes'
  | 'tresorerie'
  | 'operations-diverses'

export interface Journal {
  code: CodeJournal
  libelle: string
  nature: NatureJournal
  /** Compte de contrepartie imposé (512 pour la banque, 530 pour la caisse). */
  compteContrepartie?: string
  /**
   * Comptes dont la présence rend le journal cohérent.
   * Un achat passé au journal des ventes est une erreur de structure.
   */
  comptesPivots: readonly string[]
}
