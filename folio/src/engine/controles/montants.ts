import { ttcDepuisHT, type Centimes } from '../core/montant'
import { TAUX_TVA } from '../referentiel/tva'
import { estCompteTVA, recoitDuTTC } from './aides'
import { creerEcart, type Ecart } from './catalogue'
import type { CodeEcart } from './codes'

/** Tolérance d'arrondi : au-delà de deux centimes, ce n'est plus un arrondi. */
export const TOLERANCE_ARRONDI: Centimes = 2

/**
 * Comptes dont l'absence ou la présence désigne un traitement particulier
 * de pied de facture. Sert à nommer une ligne manquante ou superflue.
 */
const COMPTES_PARTICULIERS: readonly (readonly [RegExp, CodeEcart])[] = [
  [/^(665|765)/, 'MT_ESCOMPTE'],
  [/^(6241|6242|624|7085|708)/, 'MT_PORT'],
  [/^(6097|609|7097|709)/, 'MT_REMISE'],
  [/^(4096|4196)/, 'MT_EMBALLAGES_CONSIGNES'],
  [/^445/, 'TVA_OMISE'],
]

export function codeParticulier(compte: string): CodeEcart | null {
  for (const [motif, code] of COMPTES_PARTICULIERS) {
    if (motif.test(compte)) return code
  }
  return null
}

/**
 * Confusion sur un compte de pied de facture : port, escompte, réduction,
 * consignation. Renvoie null si aucun des deux comptes n'en relève.
 */
export function classerComptePiedDeFacture(
  compteConstate: string,
  compteAttendu: string,
): Ecart | null {
  const code = codeParticulier(compteAttendu)
  if (code === null || code === 'TVA_OMISE') return null
  return creerEcart(code, { compteConstate, compteAttendu })
}

/** Le compte et le sens sont justes, le montant ne l'est pas. */
export function classerEcartDeMontant(
  compte: string,
  montantConstate: Centimes,
  montantAttendu: Centimes,
): Ecart {
  const details = { compteConstate: compte, montantConstate, montantAttendu }

  for (const { taux } of TAUX_TVA) {
    if (taux === 0) continue
    if (!recoitDuTTC(compte) && montantConstate === ttcDepuisHT(montantAttendu, taux)) {
      return creerEcart('MT_CONFUSION_HT_TTC', details)
    }
    if (recoitDuTTC(compte) && ttcDepuisHT(montantConstate, taux) === montantAttendu) {
      return creerEcart('MT_CONFUSION_HT_TTC', details)
    }
  }

  if (Math.abs(montantConstate - montantAttendu) <= TOLERANCE_ARRONDI) {
    return creerEcart(estCompteTVA(compte) ? 'TVA_ARRONDI_NON_CONFORME' : 'MT_ECART_ARRONDI', {
      ...details,
      montantConstate: estCompteTVA(compte)
        ? montantConstate
        : montantConstate - montantAttendu,
    })
  }

  return creerEcart('MT_MONTANT_ERRONE', details)
}

/** Une ligne attendue n'a pas été saisie. */
export function classerLigneManquante(compte: string, montant: Centimes): Ecart {
  const code = codeParticulier(compte)
  if (code !== null) {
    return creerEcart(code, { compteAttendu: compte, montantAttendu: montant })
  }
  return creerEcart('MT_MONTANT_ERRONE', {
    compteConstate: compte,
    montantConstate: 0,
    montantAttendu: montant,
    precision: 'Cette ligne manque à l’écriture.',
  })
}

/** Une ligne saisie ne figure pas dans l'écriture attendue. */
export function classerLigneSuperflue(compte: string, montant: Centimes): Ecart {
  const code = codeParticulier(compte)
  if (code !== null && code !== 'TVA_OMISE') {
    return creerEcart(code, { compteConstate: compte, compteAttendu: compte, montantConstate: montant })
  }
  return creerEcart('MT_MONTANT_ERRONE', {
    compteConstate: compte,
    montantConstate: montant,
    montantAttendu: 0,
    precision: 'Cette ligne ne figure pas dans l’écriture attendue.',
  })
}
