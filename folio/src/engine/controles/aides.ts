import { classeDe, existeAuPlan, resoudreCompte } from '../referentiel/plan-comptable'
import type { LigneEcriture } from '../types/ecriture'
import type { Centimes } from '../core/montant'

/** Un numéro est recevable s'il commence par trois chiffres et se rattache au plan. */
export function estCompteValideAuPlan(numero: string): boolean {
  if (!/^\d{3}/.test(numero)) return false
  return existeAuPlan(numero)
}

export function estCompteTVA(numero: string): boolean {
  return numero.startsWith('445')
}

export function estCompteTVADeductible(numero: string): boolean {
  return numero.startsWith('4456')
}

export function estCompteTresorerie(numero: string): boolean {
  return classeDe(numero) === 5
}

export function estCompteTiers(numero: string): boolean {
  return classeDe(numero) === 4
}

/** Comptes recevant un montant toutes taxes comprises : tiers et trésorerie. */
export function recoitDuTTC(numero: string): boolean {
  return estCompteTiers(numero) || estCompteTresorerie(numero)
}

export function estImmobilisation(numero: string): boolean {
  return classeDe(numero) === 2 && !numero.startsWith('28') && !numero.startsWith('29')
}

export function estCharge(numero: string): boolean {
  return classeDe(numero) === 6
}

export function estProduit(numero: string): boolean {
  return classeDe(numero) === 7
}

export function estCompteDeGestion(numero: string): boolean {
  return estCharge(numero) || estProduit(numero)
}

export function estCompteDeBilan(numero: string): boolean {
  const classe = classeDe(numero)
  return classe !== null && classe <= 5
}

export function libelleDuCompte(numero: string): string {
  return resoudreCompte(numero)?.libelle ?? numero
}

export type Sens = 'debit' | 'credit'

export function sensDeLigne(ligne: Pick<LigneEcriture, 'debit' | 'credit'>): Sens {
  return ligne.debit !== 0 ? 'debit' : 'credit'
}

export function montantDeLigne(ligne: Pick<LigneEcriture, 'debit' | 'credit'>): Centimes {
  return ligne.debit !== 0 ? ligne.debit : ligne.credit
}

export interface Mouvement {
  compte: string
  sens: Sens
  montant: Centimes
  /** Index de la ligne d'origine dans l'écriture saisie. */
  ligne: number
}

/**
 * Réduit une écriture à ses mouvements, en agrégeant les lignes qui portent
 * le même compte dans le même sens. Deux saisies équivalentes ne doivent pas
 * produire de diagnostic différent.
 */
export function mouvements(lignes: readonly LigneEcriture[]): Mouvement[] {
  const parCle = new Map<string, Mouvement>()
  lignes.forEach((ligne, index) => {
    for (const sens of ['debit', 'credit'] as const) {
      const montant = ligne[sens]
      if (montant === 0) continue
      const cle = `${ligne.compteNumero}|${sens}`
      const existant = parCle.get(cle)
      if (existant) existant.montant += montant
      else parCle.set(cle, { compte: ligne.compteNumero, sens, montant, ligne: index })
    }
  })
  return [...parCle.values()]
}
