import type { DateComptable } from '../core/dates'
import type { CodeEcart } from '../controles/codes'
import type { LigneEcriture } from './ecriture'
import type { CodeJournal } from './journal'
import type { Piece } from './piece'

/** Processus du référentiel BTS CG. */
export type Processus = 'P1' | 'P2' | 'P3' | 'P4' | 'P5' | 'P6' | 'P7'

export const LIBELLES_PROCESSUS: Record<Processus, string> = {
  P1: 'Contrôle et traitement comptable des opérations commerciales',
  P2: 'Contrôle et production de l’information financière',
  P3: 'Gestion des obligations fiscales',
  P4: 'Gestion des relations sociales',
  P5: 'Analyse et prévision de l’activité',
  P6: 'Analyse de la situation financière',
  P7: 'Fiabilisation de l’information et système d’information',
}

/** Difficulté du dossier, nommée en vocabulaire de formation, jamais en jeu. */
export type Niveau = 'decouverte' | 'application' | 'approfondissement' | 'examen'

/** Une étape est une pièce à comptabiliser, ou un traitement à conduire. */
export type NatureEtape =
  | 'saisie'
  | 'lettrage'
  | 'rapprochement'
  | 'declaration-tva'
  | 'inventaire'
  | 'cloture'

export interface EtapeEntrainement {
  id: string
  ordre: number
  nature: NatureEtape
  intitule: string
  /** Consigne affichée à l'étudiant, en vocabulaire comptable. */
  consigne: string
  pieceId?: string
  journalAttendu?: CodeJournal
  dateAttendue?: DateComptable
  ecritureAttendue: LigneEcriture[]
  /** Points attribués à l'étape en mode examen. */
  bareme: number
  /** Écarts que l'étape est conçue pour faire apparaître. */
  ecartsAnticipes?: readonly CodeEcart[]
  processus: Processus
}

export interface EvenementDossier {
  date: DateComptable
  intitule: string
  description: string
}

export interface DossierEntrainement {
  id: string
  titre: string
  processus: Processus[]
  niveau: Niveau
  /** L'entreprise, son dirigeant, ses ennuis. Le dossier a une histoire. */
  contexteNarratif: string
  entreprise: {
    raisonSociale: string
    formeJuridique: string
    siren: string
    activite: string
    dirigeant: string
    exerciceDebut: DateComptable
    exerciceFin: DateComptable
  }
  pieces: Piece[]
  evenements: EvenementDossier[]
  etapes: EtapeEntrainement[]
  /** Durée du mode examen, en minutes. */
  dureeExamen: number
  /** Total des points du barème, contrôlé à la construction du dossier. */
  baremeTotal: number
}

export interface TentativeEtudiant {
  id: string
  dossierId: string
  etapeId: string
  ecritureSaisie: LigneEcriture[]
  journalSaisi?: CodeJournal
  dateSaisie?: DateComptable
  ecritureAttendue: LigneEcriture[]
  /** Codes d'écart relevés par le moteur. Typés, jamais libres. */
  ecartTypes: CodeEcart[]
  /** Points obtenus sur le barème de l'étape. */
  pointsObtenus: number
  /** Temps passé sur l'étape, en secondes. */
  tempsPasse: number
  dateTentative: string
  reussie: boolean
}
