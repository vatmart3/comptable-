/**
 * Clôture : détermination du résultat et écriture d'à-nouveaux.
 *
 * À la clôture, les comptes de gestion (6 et 7) sont soldés : leur différence
 * devient le résultat de l'exercice, porté au compte 120000 (bénéfice) ou
 * 129000 (perte). Les comptes de bilan (1 à 5), eux, sont reconduits tels
 * quels sur l'exercice suivant : c'est l'écriture d'à-nouveaux, première
 * écriture du nouvel exercice, dans le journal AN.
 *
 * Deux propriétés à ne jamais perdre de vue, toutes deux testées :
 *   - l'écriture d'à-nouveaux est équilibrée par construction ;
 *   - le report ne contient AUCUN compte de classe 6 ou 7.
 */

import { accountNature } from './account'
import type { Cents } from './money'
import type { AccountBalance } from './statements'
import { resultatExercice } from './statements'

export const COMPTE_RESULTAT_BENEFICE = '120000'
export const COMPTE_RESULTAT_PERTE = '129000'
export const COMPTE_REPORT_A_NOUVEAU_BENEFICE = '110000'
export const COMPTE_REPORT_A_NOUVEAU_PERTE = '119000'

export interface CarryLine {
  readonly accountNumero: string
  readonly debit: Cents
  readonly credit: Cents
  readonly libelle: string
  /** Le lettrage des comptes de tiers survit au report : une facture non réglée
   *  au 31/12 reste la même créance au 1er janvier. */
  readonly lettre: string | null
}

export interface CarryForward {
  readonly lines: readonly CarryLine[]
  readonly resultat: Cents
  readonly compteResultat: string
  readonly equilibree: boolean
}

export interface CarryOptions {
  readonly libelle?: string
  /** Reporte le lettrage des comptes de tiers (défaut : oui). */
  readonly reporterLettrage?: boolean
  /** Soldes lettrés à ne pas reporter : les lignes soldées disparaissent. */
  readonly lettragesSoldes?: ReadonlySet<string>
}

/**
 * Construit l'écriture d'à-nouveaux à partir de la balance de clôture.
 * Les comptes soldés (solde nul) ne sont pas reportés : reporter un zéro
 * n'apporte rien et pollue le grand livre du nouvel exercice.
 */
export function carryForward(
  balance: readonly AccountBalance[],
  options: CarryOptions = {},
): CarryForward {
  const libelle = options.libelle ?? 'À-nouveaux'
  const lines: CarryLine[] = []

  for (const account of balance) {
    if (accountNature(account.numero) !== 'bilan') continue
    if (account.solde === 0) continue
    // Le résultat de l'exercice précédent est reconduit tel quel s'il n'a pas
    // encore été affecté ; il est repris ici comme n'importe quel compte de bilan.
    lines.push({
      accountNumero: account.numero,
      debit: account.solde > 0 ? account.solde : 0,
      credit: account.solde < 0 ? -account.solde : 0,
      libelle,
      lettre: null,
    })
  }

  const resultat = resultatExercice(balance)
  const compteResultat = resultat >= 0 ? COMPTE_RESULTAT_BENEFICE : COMPTE_RESULTAT_PERTE

  if (resultat !== 0) {
    lines.push({
      accountNumero: compteResultat,
      debit: resultat < 0 ? -resultat : 0,
      credit: resultat > 0 ? resultat : 0,
      libelle: resultat > 0 ? 'Résultat de l’exercice — bénéfice' : 'Résultat de l’exercice — perte',
      lettre: null,
    })
  }

  let debit = 0
  let credit = 0
  for (const line of lines) {
    debit += line.debit
    credit += line.credit
  }

  return { lines, resultat, compteResultat, equilibree: debit === credit }
}

/**
 * Affectation du résultat décidée en assemblée : solde le 120/129 vers le
 * report à nouveau, les réserves, ou les dividendes à payer.
 */
export interface AffectationInput {
  readonly resultat: Cents
  readonly versReservesLegales?: Cents
  readonly versAutresReserves?: Cents
  readonly versDividendes?: Cents
}

export function affectationResultat(input: AffectationInput): CarryLine[] {
  const { resultat } = input
  const libelle = 'Affectation du résultat'
  const lines: CarryLine[] = []

  if (resultat === 0) return lines

  if (resultat > 0) {
    lines.push({
      accountNumero: COMPTE_RESULTAT_BENEFICE,
      debit: resultat,
      credit: 0,
      libelle,
      lettre: null,
    })
    const legales = input.versReservesLegales ?? 0
    const autres = input.versAutresReserves ?? 0
    const dividendes = input.versDividendes ?? 0
    if (legales > 0) lines.push({ accountNumero: '106100', debit: 0, credit: legales, libelle, lettre: null })
    if (autres > 0) lines.push({ accountNumero: '106800', debit: 0, credit: autres, libelle, lettre: null })
    if (dividendes > 0) lines.push({ accountNumero: '457000', debit: 0, credit: dividendes, libelle, lettre: null })
    const reste = resultat - legales - autres - dividendes
    if (reste !== 0) {
      lines.push({
        accountNumero: reste > 0 ? COMPTE_REPORT_A_NOUVEAU_BENEFICE : COMPTE_REPORT_A_NOUVEAU_PERTE,
        debit: reste < 0 ? -reste : 0,
        credit: reste > 0 ? reste : 0,
        libelle,
        lettre: null,
      })
    }
  } else {
    lines.push({
      accountNumero: COMPTE_RESULTAT_PERTE,
      debit: 0,
      credit: -resultat,
      libelle,
      lettre: null,
    })
    lines.push({
      accountNumero: COMPTE_REPORT_A_NOUVEAU_PERTE,
      debit: -resultat,
      credit: 0,
      libelle,
      lettre: null,
    })
  }

  return lines
}

// ── Contrôles de clôture (alimentent Le Radar) ──────────────────────────────

export type ClosingCheckAxis = 'tva' | 'banque' | 'tiers' | 'immobilisations' | 'cutoff' | 'registre'

export interface ClosingCheck {
  readonly code: string
  readonly axe: ClosingCheckAxis
  readonly gravite: 1 | 2 | 3
  readonly message: string
  readonly montant?: Cents
  readonly cibleId?: string
}

/**
 * Contrôles calculables depuis la seule balance. Les contrôles qui demandent
 * le détail des écritures (doublons, dates, séquence) vivent dans
 * `lib/accounting/anomalies.ts`.
 */
export function closingChecks(balance: readonly AccountBalance[]): ClosingCheck[] {
  const checks: ClosingCheck[] = []
  const soldeDe = (prefix: string): Cents => {
    let total = 0
    for (const account of balance) {
      if (account.numero.startsWith(prefix)) total += account.solde
    }
    return total
  }

  const attente = soldeDe('471')
  if (attente !== 0) {
    checks.push({
      code: 'compte_attente_non_solde',
      axe: 'cutoff',
      gravite: 3,
      message: 'Le compte d’attente 471 n’est pas soldé.',
      montant: attente,
    })
  }

  const virementsInternes = soldeDe('580')
  if (virementsInternes !== 0) {
    checks.push({
      code: 'virements_internes',
      axe: 'banque',
      gravite: 3,
      message: 'Le compte de virements internes 580 n’est pas soldé.',
      montant: virementsInternes,
    })
  }

  const tvaADecaisser = soldeDe('4455')
  if (tvaADecaisser > 0) {
    checks.push({
      code: 'tva_debitrice',
      axe: 'tva',
      gravite: 2,
      message: 'Le compte de TVA à décaisser est débiteur : une déclaration a été payée deux fois, ou mal soldée.',
      montant: tvaADecaisser,
    })
  }

  for (const account of balance) {
    if (account.numero.startsWith('512') && account.solde < 0) {
      checks.push({
        code: 'banque_creditrice',
        axe: 'banque',
        gravite: 1,
        message: `Le compte ${account.numero} est créditeur : découvert, ou rapprochement incomplet.`,
        montant: account.solde,
      })
    }
    if (account.numero.startsWith('411') && account.solde < 0) {
      checks.push({
        code: 'client_crediteur',
        axe: 'tiers',
        gravite: 2,
        message: `Le compte client ${account.numero} est créditeur : avoir non lettré ou acompte mal imputé.`,
        montant: account.solde,
      })
    }
    if (account.numero.startsWith('401') && account.solde > 0) {
      checks.push({
        code: 'fournisseur_debiteur',
        axe: 'tiers',
        gravite: 2,
        message: `Le compte fournisseur ${account.numero} est débiteur : règlement en double ou avoir en attente.`,
        montant: account.solde,
      })
    }
  }

  return checks
}
