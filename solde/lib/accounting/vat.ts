/**
 * TVA : taux, calcul, ventilation, déclaration CA3.
 *
 * La CA3 est construite à partir des comptes 445 (§ règle métier : c'est le
 * grand livre qui fait foi, jamais un cumul parallèle). Les bases hors taxe
 * sont reconstituées depuis la taxe collectée puis confrontées au chiffre
 * d'affaires comptabilisé en classe 7 : l'écart entre les deux est le
 * contrôle de cohérence, pas une erreur d'arrondi tolérée en silence.
 */

import { applyRate, baseFromInclusive, roundHalfUp, type Cents, type RateMilliPct } from './money'

/** Taux en vigueur en France métropolitaine, en millièmes de pourcent. */
export const TAUX = {
  NORMAL: 20_000,
  INTERMEDIAIRE: 10_000,
  REDUIT: 5_500,
  PARTICULIER: 2_100,
  EXONERE: 0,
} as const satisfies Record<string, RateMilliPct>

export const TAUX_VALIDES: readonly RateMilliPct[] = [
  TAUX.NORMAL,
  TAUX.INTERMEDIAIRE,
  TAUX.REDUIT,
  TAUX.PARTICULIER,
  TAUX.EXONERE,
]

export function isTauxValide(taux: number): boolean {
  return TAUX_VALIDES.includes(taux)
}

export function formatTaux(taux: RateMilliPct): string {
  const pct = taux / 1000
  return `${Number.isInteger(pct) ? pct : pct.toFixed(1).replace('.', ',')} %`
}

/**
 * Comptes de TVA du plan seedé. La ventilation par taux passe par des
 * sous-comptes dédiés : c'est ce qui rend la CA3 calculable sans deviner.
 */
export const COMPTES_TVA = {
  collectee: {
    [TAUX.NORMAL]: '445711',
    [TAUX.INTERMEDIAIRE]: '445712',
    [TAUX.REDUIT]: '445713',
    [TAUX.PARTICULIER]: '445714',
  },
  /** Autoliquidation sur acquisitions intracommunautaires. */
  collecteeIntracom: '445720',
  deductibleImmobilisations: '445620',
  deductibleBiensServices: '445660',
  deductibleIntracom: '445662',
  aDecaisser: '445510',
  creditAReporter: '445670',
} as const

export interface VatComputation {
  readonly ht: Cents
  readonly tva: Cents
  readonly ttc: Cents
  readonly taux: RateMilliPct
}

/** Depuis une base HT. */
export function fromExclusive(ht: Cents, taux: RateMilliPct): VatComputation {
  const tva = applyRate(ht, taux)
  return { ht, tva, ttc: ht + tva, taux }
}

/** Depuis un TTC — le cas réel de la saisie : « 240 € de gasoil » est un TTC. */
export function fromInclusive(ttc: Cents, taux: RateMilliPct): VatComputation {
  const ht = baseFromInclusive(ttc, taux)
  return { ht, tva: ttc - ht, ttc, taux }
}

/** Reconstitue la base hors taxe à partir de la seule taxe. */
export function baseFromTax(tva: Cents, taux: RateMilliPct): Cents {
  if (taux === 0) return 0
  return roundHalfUp((tva * 100_000) / taux)
}

/**
 * Devine le taux appliqué à partir d'un couple (HT, TVA). Sert au contrôle des
 * factures importées : si aucun taux légal ne colle à un centime près, la
 * facture est incohérente et le radar la remonte.
 */
export function inferTaux(ht: Cents, tva: Cents): RateMilliPct | null {
  for (const taux of TAUX_VALIDES) {
    if (applyRate(ht, taux) === tva) return taux
  }
  return null
}

// ── Déclaration CA3 ─────────────────────────────────────────────────────────

export interface VatLine {
  readonly accountNumero: string
  readonly debit: Cents
  readonly credit: Cents
}

/** Solde net d'un compte : positif = solde débiteur, négatif = solde créditeur. */
function netDebit(lines: readonly VatLine[], predicate: (numero: string) => boolean): Cents {
  let total = 0
  for (const line of lines) {
    if (predicate(line.accountNumero)) total += line.debit - line.credit
  }
  return total
}

const startsWith = (prefix: string) => (numero: string) => numero.startsWith(prefix)

export const CA3_CASES = [
  '01', '02', '03', '04', '05', '06',
  '08', '09', '9B', '10',
  '16', '17',
  '19', '20', '22', '23',
  '25', '27', '28', '32',
] as const
export type Ca3Case = (typeof CA3_CASES)[number]

export type Ca3Cases = Record<Ca3Case, Cents>

export interface Ca3Input {
  /** Toutes les lignes validées de la période. */
  readonly lines: readonly VatLine[]
  /** Case 22 : crédit de TVA reporté de la déclaration précédente. */
  readonly creditReporte?: Cents
}

export interface Ca3Result {
  readonly cases: Ca3Cases
  /** Positif = TVA à décaisser (case 28). Négatif = crédit de TVA (case 27). */
  readonly tvaNette: Cents
  readonly controles: readonly VatControl[]
}

export interface VatControl {
  readonly code: 'coherence_ca' | 'taux_incoherent' | 'compte_attente'
  readonly gravite: 'info' | 'avertissement' | 'bloquant'
  readonly message: string
  readonly ecart?: Cents
}

/**
 * Construit la CA3 à partir du grand livre de la période.
 *
 * Sens des comptes : la TVA collectée est créditrice (on la doit), la TVA
 * déductible est débitrice (on la récupère). Les signes ci-dessous
 * ramènent tout en valeur positive « telle qu'elle se déclare ».
 */
export function buildCa3(input: Ca3Input): Ca3Result {
  const { lines } = input
  const creditReporte = input.creditReporte ?? 0

  const collectee = (compte: string): Cents => -netDebit(lines, (n) => n === compte)

  const tvaNormal = collectee(COMPTES_TVA.collectee[TAUX.NORMAL])
  const tvaIntermediaire = collectee(COMPTES_TVA.collectee[TAUX.INTERMEDIAIRE])
  const tvaReduit = collectee(COMPTES_TVA.collectee[TAUX.REDUIT])
  const tvaParticulier = collectee(COMPTES_TVA.collectee[TAUX.PARTICULIER])
  const tvaIntracom = collectee(COMPTES_TVA.collecteeIntracom)

  // Chiffre d'affaires comptabilisé : soldes créditeurs de la classe 7 (70x).
  const caComptabilise = -netDebit(lines, startsWith('70'))

  // Bases reconstituées depuis la taxe, taux par taux.
  const baseNormal = baseFromTax(tvaNormal, TAUX.NORMAL)
  const baseIntermediaire = baseFromTax(tvaIntermediaire, TAUX.INTERMEDIAIRE)
  const baseReduit = baseFromTax(tvaReduit, TAUX.REDUIT)
  const baseParticulier = baseFromTax(tvaParticulier, TAUX.PARTICULIER)
  const baseImposable = baseNormal + baseIntermediaire + baseReduit + baseParticulier
  const baseIntracom = baseFromTax(tvaIntracom, TAUX.NORMAL)

  const tvaBrute = tvaNormal + tvaIntermediaire + tvaReduit + tvaParticulier + tvaIntracom

  const deductibleImmo = netDebit(lines, (n) => n === COMPTES_TVA.deductibleImmobilisations)
  const deductibleAbs = netDebit(
    lines,
    (n) => n.startsWith('4456') && n !== COMPTES_TVA.deductibleImmobilisations,
  )
  const tvaDeductible = deductibleImmo + deductibleAbs + creditReporte

  const solde = tvaBrute - tvaDeductible

  const cases: Ca3Cases = {
    '01': baseImposable,
    '02': 0,
    '03': baseIntracom,
    '04': 0,
    '05': Math.max(0, caComptabilise - baseImposable),
    '06': 0,
    '08': tvaNormal,
    '09': tvaReduit,
    '9B': tvaIntermediaire,
    '10': tvaParticulier,
    '16': tvaBrute,
    '17': tvaIntracom,
    '19': deductibleImmo,
    '20': deductibleAbs,
    '22': creditReporte,
    '23': tvaDeductible,
    '25': solde < 0 ? -solde : 0,
    '27': solde < 0 ? -solde : 0,
    '28': solde > 0 ? solde : 0,
    '32': solde > 0 ? solde : 0,
  }

  return { cases, tvaNette: solde, controles: controlCa3({ cases, caComptabilise, lines }) }
}

function controlCa3(args: {
  cases: Ca3Cases
  caComptabilise: Cents
  lines: readonly VatLine[]
}): VatControl[] {
  const controles: VatControl[] = []
  const { cases, caComptabilise, lines } = args

  // Cohérence TVA collectée / chiffre d'affaires : la base reconstituée depuis
  // la taxe ne peut pas dépasser le CA comptabilisé. Au-delà de 1 € d'écart
  // inexpliqué, quelque chose ne va pas — TVA sur un compte de produit oublié,
  // ou produit enregistré hors taxe.
  const ecart = cases['01'] + cases['05'] - caComptabilise
  if (Math.abs(ecart) > 100) {
    controles.push({
      code: 'coherence_ca',
      gravite: Math.abs(ecart) > 10_000 ? 'bloquant' : 'avertissement',
      message:
        ecart > 0
          ? 'La base taxable dépasse le chiffre d’affaires comptabilisé : une TVA collectée est sans produit en face.'
          : 'Le chiffre d’affaires dépasse la base déclarée : des produits semblent enregistrés sans TVA.',
      ecart,
    })
  }

  const attente = netDebit(lines, startsWith('471'))
  if (attente !== 0) {
    controles.push({
      code: 'compte_attente',
      gravite: 'bloquant',
      message: 'Le compte d’attente 471 n’est pas soldé : la déclaration porterait sur une période incomplète.',
      ecart: attente,
    })
  }

  return controles
}

/**
 * Écriture de déclaration : on solde les comptes de TVA de la période et on
 * constate soit une dette (445510), soit un crédit reportable (445670).
 */
export interface Ca3EntryLine {
  readonly accountNumero: string
  readonly debit: Cents
  readonly credit: Cents
  readonly libelle: string
}

export function ca3Entry(result: Ca3Result, libelle: string): Ca3EntryLine[] {
  const { cases, tvaNette } = result
  const lines: Ca3EntryLine[] = []
  const push = (accountNumero: string, debit: Cents, credit: Cents): void => {
    if (debit === 0 && credit === 0) return
    lines.push({ accountNumero, debit, credit, libelle })
  }

  // On débite la TVA collectée (compte créditeur qu'on solde)…
  push(COMPTES_TVA.collectee[TAUX.NORMAL], cases['08'], 0)
  push(COMPTES_TVA.collectee[TAUX.REDUIT], cases['09'], 0)
  push(COMPTES_TVA.collectee[TAUX.INTERMEDIAIRE], cases['9B'], 0)
  push(COMPTES_TVA.collectee[TAUX.PARTICULIER], cases['10'], 0)
  push(COMPTES_TVA.collecteeIntracom, cases['17'], 0)

  // …on crédite la TVA déductible (compte débiteur qu'on solde)…
  push(COMPTES_TVA.deductibleImmobilisations, 0, cases['19'])
  push(COMPTES_TVA.deductibleBiensServices, 0, cases['20'])
  push(COMPTES_TVA.creditAReporter, 0, cases['22'])

  // …et on constate le solde.
  if (tvaNette > 0) {
    push(COMPTES_TVA.aDecaisser, 0, tvaNette)
  } else if (tvaNette < 0) {
    push(COMPTES_TVA.creditAReporter, -tvaNette, 0)
  }

  return lines
}

/**
 * Échéance de dépôt : la CA3 mensuelle se dépose le mois suivant.
 * La date exacte dépend du régime et du département (15 au 24) ; on retient
 * le 24 du mois suivant, borne haute commune à tous les redevables.
 */
export function ca3DueDate(periodeFin: Date): Date {
  return new Date(Date.UTC(periodeFin.getUTCFullYear(), periodeFin.getUTCMonth() + 1, 24))
}
