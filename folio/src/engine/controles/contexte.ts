import type { Exercice } from '../core/dates'
import type { Ecriture } from '../types/ecriture'
import type { Piece } from '../types/piece'

export interface ContexteControle {
  exercice: Exercice
  /** Écritures déjà enregistrées, pour détecter une pièce comptabilisée deux fois. */
  ecrituresExistantes?: readonly Ecriture[]
  /** Pièce justificative rattachée, quand le contrôle peut s'y référer. */
  piece?: Piece
  /** Le dossier impose un numéro de pièce sur toute écriture. */
  numeroPieceObligatoire?: boolean
}
