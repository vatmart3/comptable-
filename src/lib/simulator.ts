/**
 * Modèle de calcul unique du site.
 *
 * Ce fichier produit DEUX choses avec exactement la même fonction :
 *   1. les montants par défaut affichés dans la page (profil de référence, §01) ;
 *   2. le résultat personnalisé du simulateur (§03).
 *
 * Conséquence voulue : aucun chiffre n'est écrit en dur dans les sections. Le site
 * ne peut pas se contredire d'une section à l'autre.
 *
 * Toutes les hypothèses sont explicites et exposées à l'écran (voir `assumptions`).
 * Aucune valeur n'est présentée comme une statistique : ce sont des estimations,
 * annoncées comme telles.
 */

export type Statut = 'micro' | 'ei' | 'eurl' | 'sarl' | 'sas'
export type CaBand = 'ca0' | 'ca1' | 'ca2' | 'ca3' | 'ca4'
export type SalariesBand = 's0' | 's1' | 's2' | 's3'
export type Keeper = 'moi' | 'salarie' | 'cabinet' | 'personne'
export type HoursBand = 'h0' | 'h1' | 'h2' | 'h3' | 'h4'

export interface SimInput {
  statut: Statut
  ca: CaBand
  salaries: SalariesBand
  keeper: Keeper
  hours: HoursBand
}

/** Une formule d'honoraires, telle que définie dans `src/config/site.ts`. */
export interface PlanRef {
  id: string
  name: string
  monthly: number
}

/* ------------------------------------------------------------------ */
/* Barèmes                                                             */
/* ------------------------------------------------------------------ */

/** Chiffre d'affaires retenu au milieu de chaque tranche. */
const CA_VALUE: Record<CaBand, number> = {
  ca0: 35_000,
  ca1: 95_000,
  ca2: 270_000,
  ca3: 650_000,
  ca4: 1_400_000,
}

/**
 * Valeur d'une heure de dirigeant, par tranche de chiffre d'affaires.
 * Hypothèse volontairement basse : c'est un coût d'opportunité, pas un taux de facturation.
 */
const HOURLY_VALUE: Record<CaBand, number> = {
  ca0: 30,
  ca1: 38,
  ca2: 45,
  ca3: 62,
  ca4: 85,
}

const SALARIES_VALUE: Record<SalariesBand, number> = { s0: 0, s1: 1.5, s2: 5, s3: 14 }

/** Heures de gestion par mois, retenues au milieu de chaque tranche. */
const HOURS_VALUE: Record<HoursBand, number> = { h0: 1, h1: 3, h2: 7, h3: 14, h4: 25 }

/**
 * Part du chiffre d'affaires qui échappe à la déduction, selon qui tient les comptes.
 * Frais de véhicule sous-évalués, TVA non récupérée sur des notes, amortissements
 * non pratiqués, cotisations facultatives non déduites.
 */
const MISSED_DEDUCTION_RATE: Record<Keeper, number> = {
  personne: 0.010,
  moi: 0.007,
  salarie: 0.0045,
  cabinet: 0.0025,
}

/** Exposition annuelle aux majorations et intérêts de retard, avant pondération. */
const PENALTY_BASE: Record<Statut, number> = {
  micro: 120,
  ei: 260,
  eurl: 420,
  sarl: 560,
  sas: 620,
}

const PENALTY_KEEPER_FACTOR: Record<Keeper, number> = {
  personne: 1.6,
  moi: 1.15,
  salarie: 0.9,
  cabinet: 0.35,
}

/**
 * Potentiel d'arbitrage : rémunération du dirigeant (salaire / dividendes),
 * choix d'amortissement, calage des options fiscales.
 * La micro-entreprise est à zéro, et ce n'est pas une pudeur commerciale :
 * l'abattement y est forfaitaire, il n'y a rien à arbitrer.
 */
const ARBITRAGE_RATE: Record<Statut, number> = {
  micro: 0,
  ei: 0.008,
  eurl: 0.016,
  sarl: 0.018,
  sas: 0.019,
}
const ARBITRAGE_CAP = 9_000

/** Part du temps de gestion réellement reprise par le cabinet. Le reste vous reste. */
const TIME_RECOVERY = 0.85

/* ------------------------------------------------------------------ */
/* Sortie                                                              */
/* ------------------------------------------------------------------ */

export type Verdict = 'gain' | 'serre' | 'inutile'

export interface Profile {
  input: SimInput
  /** Chiffre d'affaires retenu pour le calcul. */
  ca: number
  hoursPerMonth: number
  hoursPerYear: number
  hourlyValue: number
  /** Débits — ce que la situation actuelle coûte, par an. */
  costTime: number
  costDeductions: number
  costPenalties: number
  costTotal: number
  /** Crédits — ce que le cabinet rend, par an. */
  creditTime: number
  creditDeductions: number
  creditPenalties: number
  creditArbitrage: number
  creditTotal: number
  /** Débit — les honoraires. Ils sont dans le calcul, pas à côté. */
  plan: PlanRef
  fees: number
  /** crédits − débits, honoraires compris. */
  solde: number
  hoursReturned: number
  verdict: Verdict
  recoverable: { label: string; amount: number }[]
  assumptions: string[]
}

const round10 = (n: number) => Math.round(n / 10) * 10

/** Choisit la formule adaptée au profil. Aucun surclassement automatique. */
function pickPlan(input: SimInput, plans: PlanRef[]): PlanRef {
  const ca = CA_VALUE[input.ca]
  const sal = SALARIES_VALUE[input.salaries]
  const [top, mid, low] = plans
  if (ca >= 650_000 || sal >= 10) return top
  if (input.statut === 'micro' || (ca <= 95_000 && sal === 0)) return low
  return mid
}

/**
 * Le modèle. Pur, sans effet de bord, testable à la main.
 * `plans` est passé en argument pour que ce fichier ne dépende d'aucun contenu :
 * changer de cabinet ne change pas le modèle.
 */
export function computeProfile(input: SimInput, plans: PlanRef[]): Profile {
  const ca = CA_VALUE[input.ca]
  const hourlyValue = HOURLY_VALUE[input.ca]
  const hoursPerMonth = HOURS_VALUE[input.hours]
  const hoursPerYear = hoursPerMonth * 12
  const salaries = SALARIES_VALUE[input.salaries]

  const costTime = round10(hoursPerYear * hourlyValue)

  // La micro-entreprise ne déduit aucun frais réel : l'abattement est forfaitaire.
  const costDeductions =
    input.statut === 'micro' ? 0 : round10(ca * MISSED_DEDUCTION_RATE[input.keeper])

  const costPenalties = round10(
    PENALTY_BASE[input.statut] * PENALTY_KEEPER_FACTOR[input.keeper] * (1 + salaries * 0.03),
  )

  const costTotal = costTime + costDeductions + costPenalties

  const creditTime = round10(costTime * TIME_RECOVERY)
  const creditDeductions = costDeductions
  const creditPenalties = costPenalties
  // Si un cabinet tient déjà les comptes, l'essentiel de l'arbitrage est probablement fait.
  const creditArbitrage = round10(
    Math.min(ca * ARBITRAGE_RATE[input.statut], ARBITRAGE_CAP) *
      (input.keeper === 'cabinet' ? 0.45 : 1),
  )
  const creditTotal = creditTime + creditDeductions + creditPenalties + creditArbitrage

  const plan = pickPlan(input, plans)
  const fees = plan.monthly * 12
  const solde = creditTotal - costTotal - fees
  const hoursReturned = Math.round(hoursPerYear * TIME_RECOVERY)

  const verdict: Verdict = solde <= 0 ? 'inutile' : solde < fees * 0.25 ? 'serre' : 'gain'

  const recoverable = [
    { label: 'Temps de gestion repris', amount: creditTime },
    { label: 'Déductions non réclamées', amount: creditDeductions },
    { label: 'Majorations et intérêts évités', amount: creditPenalties },
    { label: 'Arbitrage de rémunération et options fiscales', amount: creditArbitrage },
  ].filter((r) => r.amount > 0)

  const assumptions = [
    `Chiffre d'affaires retenu au milieu de votre tranche : ${ca.toLocaleString('fr-FR')} €.`,
    `Votre heure valorisée à ${hourlyValue} € — coût d'opportunité, pas un taux de facturation.`,
    `${Math.round(TIME_RECOVERY * 100)} % du temps de gestion repris. Le reste vous reste : nous ne signons pas à votre place.`,
    input.statut === 'micro'
      ? "Micro-entreprise : aucun frais réel déductible et aucun arbitrage possible, l'abattement est forfaitaire."
      : `Déductions non réclamées estimées à ${(MISSED_DEDUCTION_RATE[input.keeper] * 100).toFixed(2).replace('.', ',')} % du chiffre d'affaires.`,
    'Estimations. Ni moyennes de marché, ni promesses : des ordres de grandeur, à vérifier sur vos comptes.',
  ]

  return {
    input,
    ca,
    hoursPerMonth,
    hoursPerYear,
    hourlyValue,
    costTime,
    costDeductions,
    costPenalties,
    costTotal,
    creditTime,
    creditDeductions,
    creditPenalties,
    creditArbitrage,
    creditTotal,
    plan,
    fees,
    solde,
    hoursReturned,
    verdict,
    recoverable,
    assumptions,
  }
}
