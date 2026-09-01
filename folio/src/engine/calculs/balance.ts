import { somme, type Centimes } from '../core/montant'
import { comparerDates, joursReels, type DateComptable } from '../core/dates'
import { resoudreCompte } from '../referentiel/plan-comptable'
import type { Ecriture } from '../types/ecriture'
import { filtrerEcritures, type OptionsRestitution } from './grand-livre'

export interface LigneBalance {
  numero: string
  libelle: string
  totalDebit: Centimes
  totalCredit: Centimes
  soldeDebiteur: Centimes
  soldeCrediteur: Centimes
}

export interface Balance {
  lignes: LigneBalance[]
  totalDebit: Centimes
  totalCredit: Centimes
  totalSoldeDebiteur: Centimes
  totalSoldeCrediteur: Centimes
  equilibree: boolean
  /** Écart entre les totaux de mouvements. Zéro quand la balance est juste. */
  ecart: Centimes
}

export function balance(
  ecritures: readonly Ecriture[],
  options: OptionsRestitution = {},
): Balance {
  const cumuls = new Map<string, { debit: Centimes; credit: Centimes }>()
  for (const ecriture of filtrerEcritures(ecritures, options)) {
    for (const ligne of ecriture.lignes) {
      const cumul = cumuls.get(ligne.compteNumero) ?? { debit: 0, credit: 0 }
      cumul.debit += ligne.debit
      cumul.credit += ligne.credit
      cumuls.set(ligne.compteNumero, cumul)
    }
  }

  const lignes: LigneBalance[] = [...cumuls.entries()]
    .map(([numero, cumul]) => {
      const solde = cumul.debit - cumul.credit
      return {
        numero,
        libelle: resoudreCompte(numero)?.libelle ?? numero,
        totalDebit: cumul.debit,
        totalCredit: cumul.credit,
        soldeDebiteur: solde > 0 ? solde : 0,
        soldeCrediteur: solde < 0 ? -solde : 0,
      }
    })
    .sort((a, b) => a.numero.localeCompare(b.numero))

  const totalDebit = somme(lignes.map((l) => l.totalDebit))
  const totalCredit = somme(lignes.map((l) => l.totalCredit))

  return {
    lignes,
    totalDebit,
    totalCredit,
    totalSoldeDebiteur: somme(lignes.map((l) => l.soldeDebiteur)),
    totalSoldeCrediteur: somme(lignes.map((l) => l.soldeCrediteur)),
    equilibree: totalDebit === totalCredit,
    ecart: totalDebit - totalCredit,
  }
}

/** Solde d'un compte ou d'un ensemble de comptes partageant une racine. */
export function soldeDe(balanceCalculee: Balance, racine: string): Centimes {
  return somme(
    balanceCalculee.lignes
      .filter((ligne) => ligne.numero.startsWith(racine))
      .map((ligne) => ligne.soldeDebiteur - ligne.soldeCrediteur),
  )
}

export const TRANCHES_AGE = [
  { code: 'non-echu', libelle: 'Non échu', min: Number.NEGATIVE_INFINITY, max: 0 },
  { code: '1-30', libelle: 'Échu de 1 à 30 jours', min: 1, max: 30 },
  { code: '31-60', libelle: 'Échu de 31 à 60 jours', min: 31, max: 60 },
  { code: '61-90', libelle: 'Échu de 61 à 90 jours', min: 61, max: 90 },
  { code: '90+', libelle: 'Échu depuis plus de 90 jours', min: 91, max: Number.POSITIVE_INFINITY },
] as const

export type CodeTranche = (typeof TRANCHES_AGE)[number]['code']

export interface LigneBalanceAgee {
  compte: string
  auxiliaire?: string
  total: Centimes
  tranches: Record<CodeTranche, Centimes>
}

/**
 * Balance âgée des comptes de tiers : ce qui reste dû, ventilé par ancienneté.
 * Seules les lignes non lettrées y figurent, une facture réglée n'est plus due.
 */
export function balanceAgee(
  ecritures: readonly Ecriture[],
  dateReference: DateComptable,
  racines: readonly string[] = ['411', '401'],
  options: OptionsRestitution = {},
): LigneBalanceAgee[] {
  const parCompte = new Map<string, LigneBalanceAgee>()

  for (const ecriture of filtrerEcritures(ecritures, options)) {
    for (const ligne of ecriture.lignes) {
      if (!racines.some((racine) => ligne.compteNumero.startsWith(racine))) continue
      if (ligne.lettrage) continue

      const cle = ligne.auxiliaire
        ? `${ligne.compteNumero}|${ligne.auxiliaire}`
        : ligne.compteNumero
      let entree = parCompte.get(cle)
      if (!entree) {
        entree = {
          compte: ligne.compteNumero,
          ...(ligne.auxiliaire ? { auxiliaire: ligne.auxiliaire } : {}),
          total: 0,
          tranches: { 'non-echu': 0, '1-30': 0, '31-60': 0, '61-90': 0, '90+': 0 },
        }
        parCompte.set(cle, entree)
      }
      const montant = ligne.debit - ligne.credit
      const echeance = ligne.echeance ?? ecriture.date
      const retard =
        comparerDates(echeance, dateReference) >= 0 ? 0 : joursReels(echeance, dateReference)
      const tranche = TRANCHES_AGE.find((t) => retard >= t.min && retard <= t.max)!
      entree.total += montant
      entree.tranches[tranche.code] += montant
    }
  }

  return [...parCompte.values()]
    .filter((ligne) => ligne.total !== 0)
    .sort((a, b) => a.compte.localeCompare(b.compte) || (a.auxiliaire ?? '').localeCompare(b.auxiliaire ?? ''))
}
