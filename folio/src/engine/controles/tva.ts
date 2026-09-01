import { somme, tvaSurBase, type Centimes, type PointsDeBase } from '../core/montant'
import { calculerTotauxPiece } from '../calculs/piece'
import { COMPTES_TVA, TAUX_TVA } from '../referentiel/tva'
import type { LigneEcriture } from '../types/ecriture'
import type { Piece } from '../types/piece'
import { estCompteTVA, montantDeLigne } from './aides'
import { creerEcart, type Ecart } from './catalogue'

const PAIRES: readonly (readonly [string, string, 'TVA_CONFUSION_44566_44562' | 'TVA_CONFUSION_44571_44551'])[] = [
  [COMPTES_TVA.deductibleBiensServices, COMPTES_TVA.deductibleImmobilisations, 'TVA_CONFUSION_44566_44562'],
  [COMPTES_TVA.collectee, COMPTES_TVA.aDecaisser, 'TVA_CONFUSION_44571_44551'],
]

/** Confusion entre deux comptes de TVA. Renvoie null si la paire n'en est pas une. */
export function classerConfusionComptesTVA(
  compteConstate: string,
  compteAttendu: string,
): Ecart | null {
  for (const [a, b, code] of PAIRES) {
    const correspond =
      (compteConstate === a && compteAttendu === b) || (compteConstate === b && compteAttendu === a)
    if (correspond) return creerEcart(code, { compteConstate, compteAttendu })
  }
  return null
}

/**
 * Confronte la TVA portée dans l'écriture au calcul issu de la pièce.
 * Nomme la cause : taux, base, ou arrondi.
 */
export function controlerTVASurPiece(lignes: readonly LigneEcriture[], piece: Piece): Ecart[] {
  const totaux = calculerTotauxPiece(piece.detail)
  const attendue = totaux.totalTVA
  const lignesTVA = lignes.filter((ligne) => estCompteTVA(ligne.compteNumero))
  const constatee = somme(lignesTVA.map(montantDeLigne))

  if (attendue === 0 && constatee === 0) return []

  if (lignesTVA.length === 0) {
    return [
      creerEcart('TVA_OMISE', {
        montantAttendu: attendue,
        compteAttendu: compteTVAAttendu(piece),
      }),
    ]
  }

  const compteConstate = lignesTVA[0]!.compteNumero
  if (constatee === attendue) return []

  const baseTotale = somme(totaux.basesParTaux.map((b) => b.base))
  const tauxDominant = tauxLePlusRepresente(totaux.basesParTaux)

  if (Math.abs(constatee - attendue) <= 2) {
    return [
      creerEcart('TVA_ARRONDI_NON_CONFORME', {
        compteConstate,
        montantConstate: constatee,
        montantAttendu: attendue,
      }),
    ]
  }

  for (const taux of TAUX_TVA) {
    if (taux.taux === 0 || taux.taux === tauxDominant) continue
    if (tvaSurBase(baseTotale, taux.taux) === constatee) {
      return [
        creerEcart('TVA_TAUX_NON_CONFORME', {
          compteConstate,
          montantConstate: constatee,
          montantAttendu: attendue,
          tauxConstate: taux.taux,
          tauxAttendu: tauxDominant,
        }),
      ]
    }
  }

  const basesFausses: readonly (readonly [Centimes, string])[] = [
    [totaux.brutHT, 'La base est le net commercial : les réductions figurant sur la facture en sont déduites.'],
    [totaux.netCommercial, 'L’escompte accordé sur la facture diminue la base imposable.'],
    [totaux.netFinancier, 'Le port facturé entre dans la base imposable au taux du bien transporté.'],
    [totaux.totalTTC, 'La TVA se calcule sur le montant hors taxes, jamais sur le montant toutes taxes.'],
  ]
  for (const [base, precision] of basesFausses) {
    if (base !== baseTotale && tvaSurBase(base, tauxDominant) === constatee) {
      return [
        creerEcart('TVA_BASE_ERRONEE', {
          compteConstate,
          montantConstate: base,
          montantAttendu: baseTotale,
          precision,
        }),
      ]
    }
  }

  return [
    creerEcart('MT_MONTANT_ERRONE', {
      compteConstate,
      montantConstate: constatee,
      montantAttendu: attendue,
      precision: `La TVA de la pièce s’élève à ${(attendue / 100).toFixed(2)} €.`,
    }),
  ]
}

function tauxLePlusRepresente(bases: readonly { taux: PointsDeBase; base: Centimes }[]): PointsDeBase {
  let meilleur: PointsDeBase = 2000
  let maximum = -1
  for (const { taux, base } of bases) {
    if (base > maximum) {
      maximum = base
      meilleur = taux
    }
  }
  return meilleur
}

/** Compte de TVA que la pièce appelle. */
export function compteTVAAttendu(piece: Piece): string {
  if (piece.type === 'facture-vente' || piece.type === 'avoir-vente') return COMPTES_TVA.collectee
  const porteUneImmobilisation = piece.ecritureAttendue.some((ligne) =>
    /^2(?!8|9)/.test(ligne.compteNumero),
  )
  return porteUneImmobilisation
    ? COMPTES_TVA.deductibleImmobilisations
    : COMPTES_TVA.deductibleBiensServices
}
