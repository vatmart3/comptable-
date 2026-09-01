import type { Centimes, PointsDeBase } from '../core/montant'
import type { DateComptable } from '../core/dates'
import type { LigneEcriture } from './ecriture'
import type { CodeJournal } from './journal'

export type TypePiece =
  | 'facture-achat'
  | 'facture-vente'
  | 'avoir-achat'
  | 'avoir-vente'
  | 'releve-bancaire'
  | 'bulletin-paie'
  | 'contrat'
  | 'note-interne'

/** Une ligne d'article telle qu'elle figure sur la facture rendue à l'écran. */
export interface LigneArticle {
  designation: string
  quantite: number
  prixUnitaireHT: Centimes
  tauxTVA: PointsDeBase
  /** Remise de ligne en points de base : 5 % = 500. */
  remise?: PointsDeBase
}

/** Détail chiffré de la pièce, servant aussi de base aux contrôles de montants. */
export interface DetailPiece {
  lignes: LigneArticle[]
  /** Remise, rabais ou ristourne appliqués au pied de facture. */
  reductionsCommerciales?: Centimes
  /** Escompte de règlement, compte 665 chez l'acheteur, 765 chez le vendeur. */
  escompte?: Centimes
  /** Port facturé, soumis à la TVA du bien transporté. */
  port?: Centimes
  tauxTVAPort?: PointsDeBase
  /** Emballages consignés, compte 4096 ou 4196, hors champ de la TVA. */
  consignation?: Centimes
  /** Acompte déjà versé et déduit du net à payer. */
  acompte?: Centimes
}

export interface Piece {
  id: string
  type: TypePiece
  /** Émetteur de la pièce : fournisseur, banque, organisme. */
  emetteur: string
  /** Destinataire, pour une facture émise par le dossier. */
  destinataire?: string
  numero: string
  date: DateComptable
  echeance?: DateComptable
  detail: DetailPiece
  /** Totaux figurant au pied de la pièce, tels que l'étudiant les lit. */
  montantHT: Centimes
  montantTVA: Centimes
  montantTTC: Centimes
  netAPayer: Centimes
  /** Écriture attendue et journal attendu, pour la correction. */
  journalAttendu: CodeJournal
  ecritureAttendue: LigneEcriture[]
  /** Mention libre reproduite sur la pièce (conditions, escompte, consigne). */
  mentions?: string[]
}
