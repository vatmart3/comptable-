export * from './codes'
export * from './catalogue'
export * from './contexte'
export * from './aides'
export * from './structure'
export * from './sens'
export * from './tva'
export * from './montants'
export * from './inventaire'
export * from './global'
export * from './diagnostic'

import { controlerStructure, type EcritureCandidate } from './structure'
import { controlerTVASurPiece } from './tva'
import { trierEcarts, type Ecart } from './catalogue'
import type { ContexteControle } from './contexte'

/**
 * Contrôle une écriture pour elle-même : structure, journal, date, pièce, et
 * cohérence de la TVA avec la pièce quand celle-ci est fournie.
 * La comparaison à l'écriture attendue relève de `diagnostiquer`.
 */
export function controlerEcriture(
  ecriture: EcritureCandidate,
  contexte: ContexteControle,
): Ecart[] {
  const ecarts = controlerStructure(ecriture, contexte)
  if (contexte.piece) {
    ecarts.push(...controlerTVASurPiece(ecriture.lignes, contexte.piece))
  }
  return trierEcarts(ecarts)
}
