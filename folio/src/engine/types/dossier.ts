import type { DateComptable } from '../core/dates'

export type FormeJuridique = 'SARL' | 'SAS' | 'SA' | 'EURL' | 'SASU' | 'EI' | 'SNC'

/** La version 1 ne couvre que le réel normal. Le type prépare la suite. */
export type RegimeTVA = 'reel-normal' | 'reel-simplifie' | 'franchise'

export type StatutDossier = 'ouvert' | 'clos' | 'archive'

export interface Dossier {
  id: string
  raisonSociale: string
  formeJuridique: FormeJuridique
  /** SIREN à neuf chiffres, requis pour nommer le fichier FEC. */
  siren: string
  regimeTVA: RegimeTVA
  exerciceDebut: DateComptable
  exerciceFin: DateComptable
  planComptableId: string
  statut: StatutDossier
  adresse?: string
  /** Date de clôture de l'exercice précédent, pour contrôler les à-nouveaux. */
  exercicePrecedentFin?: DateComptable
}
