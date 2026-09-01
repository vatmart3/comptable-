import {
  appliquerTaux,
  arrondi,
  repartir,
  somme,
  tvaSurBase,
  type Centimes,
  type PointsDeBase,
} from '../core/montant'
import type { DetailPiece, LigneArticle } from '../types/piece'

export interface BaseParTaux {
  taux: PointsDeBase
  base: Centimes
  tva: Centimes
}

export interface TotauxPiece {
  /** Somme des lignes avant toute réduction. */
  brutHT: Centimes
  /** Net commercial : brut diminué des réductions commerciales. C'est lui qui entre en 607 ou en 707. */
  netCommercial: Centimes
  reductionsCommerciales: Centimes
  escompte: Centimes
  /** Net financier : net commercial diminué de l'escompte. Base de la TVA. */
  netFinancier: Centimes
  port: Centimes
  consignation: Centimes
  acompte: Centimes
  basesParTaux: BaseParTaux[]
  totalTVA: Centimes
  /** Total hors taxes figurant au pied de la pièce : net financier plus port. */
  totalHT: Centimes
  totalTTC: Centimes
  netAPayer: Centimes
}

export function montantBrutLigne(ligne: LigneArticle): Centimes {
  return arrondi(ligne.quantite * ligne.prixUnitaireHT)
}

export function montantNetLigne(ligne: LigneArticle): Centimes {
  const brut = montantBrutLigne(ligne)
  return brut - appliquerTaux(brut, ligne.remise ?? 0)
}

/**
 * Calcule le pied d'une facture.
 *
 * Les réductions de pied et l'escompte sont ventilés au prorata des bases par
 * taux, sans perdre de centime. La TVA est arrondie une seule fois par taux.
 */
export function calculerTotauxPiece(detail: DetailPiece): TotauxPiece {
  const brutHT = somme(detail.lignes.map(montantBrutLigne))
  const netsDeLigne = detail.lignes.map(montantNetLigne)
  const netApresRemisesDeLigne = somme(netsDeLigne)

  const reductions = detail.reductionsCommerciales ?? 0
  const escompte = detail.escompte ?? 0
  const port = detail.port ?? 0
  const consignation = detail.consignation ?? 0
  const acompte = detail.acompte ?? 0

  const netCommercial = netApresRemisesDeLigne - reductions
  const netFinancier = netCommercial - escompte

  // Bases avant réductions de pied, regroupées par taux.
  const tauxOrdonnes: PointsDeBase[] = []
  const basesBrutes = new Map<PointsDeBase, Centimes>()
  detail.lignes.forEach((ligne, index) => {
    if (!basesBrutes.has(ligne.tauxTVA)) tauxOrdonnes.push(ligne.tauxTVA)
    basesBrutes.set(ligne.tauxTVA, (basesBrutes.get(ligne.tauxTVA) ?? 0) + netsDeLigne[index]!)
  })

  const poids = tauxOrdonnes.map((taux) => basesBrutes.get(taux) ?? 0)
  const partReductions = repartir(reductions, poids)
  const partEscompte = repartir(escompte, poids)

  const bases = new Map<PointsDeBase, Centimes>()
  tauxOrdonnes.forEach((taux, index) => {
    bases.set(taux, (basesBrutes.get(taux) ?? 0) - partReductions[index]! - partEscompte[index]!)
  })

  if (port !== 0) {
    const tauxPort = detail.tauxTVAPort ?? tauxOrdonnes[0] ?? 2000
    if (!bases.has(tauxPort)) tauxOrdonnes.push(tauxPort)
    bases.set(tauxPort, (bases.get(tauxPort) ?? 0) + port)
  }

  const basesParTaux: BaseParTaux[] = tauxOrdonnes.map((taux) => {
    const base = bases.get(taux) ?? 0
    return { taux, base, tva: tvaSurBase(base, taux) }
  })

  const totalTVA = somme(basesParTaux.map((b) => b.tva))
  const totalHT = netFinancier + port
  const totalTTC = totalHT + totalTVA + consignation

  return {
    brutHT,
    netCommercial,
    reductionsCommerciales: reductions,
    escompte,
    netFinancier,
    port,
    consignation,
    acompte,
    basesParTaux,
    totalTVA,
    totalHT,
    totalTTC,
    netAPayer: totalTTC - acompte,
  }
}
