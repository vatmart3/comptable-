import type { PointsDeBase } from '../core/montant'

export interface TauxTVA {
  code: 'normal' | 'intermediaire' | 'reduit' | 'particulier' | 'exonere'
  taux: PointsDeBase
  libelle: string
  /** Exemples de biens et services relevant du taux, pour l'explication d'écart. */
  exemples: readonly string[]
}

export const TAUX_TVA: readonly TauxTVA[] = [
  {
    code: 'normal',
    taux: 2000,
    libelle: 'Taux normal, 20 %',
    exemples: ['marchandises courantes', 'prestations de services', 'matériel'],
  },
  {
    code: 'intermediaire',
    taux: 1000,
    libelle: 'Taux intermédiaire, 10 %',
    exemples: ['restauration', 'transport de voyageurs', 'travaux de rénovation'],
  },
  {
    code: 'reduit',
    taux: 550,
    libelle: 'Taux réduit, 5,5 %',
    exemples: ['produits alimentaires', 'livres', 'abonnements gaz et électricité'],
  },
  {
    code: 'particulier',
    taux: 210,
    libelle: 'Taux particulier, 2,1 %',
    exemples: ['médicaments remboursables', 'presse'],
  },
  { code: 'exonere', taux: 0, libelle: 'Hors champ ou exonéré', exemples: ['timbres', 'consignations'] },
]

const TAUX_ADMIS = new Set<PointsDeBase>(TAUX_TVA.map((t) => t.taux))

export function estTauxAdmis(taux: PointsDeBase): boolean {
  return TAUX_ADMIS.has(taux)
}

export function libelleTaux(taux: PointsDeBase): string {
  return TAUX_TVA.find((t) => t.taux === taux)?.libelle ?? `Taux inconnu (${taux / 100} %)`
}

/** Rend un taux en points de base sous forme lisible : 550 → « 5,5 % ». */
export function formatTaux(taux: PointsDeBase): string {
  const pourcent = taux / 100
  return `${pourcent.toString().replace('.', ',')} %`
}

/** Comptes de TVA du plan, utilisés par les contrôles et la déclaration. */
export const COMPTES_TVA = {
  collectee: '44571',
  deductibleBiensServices: '44566',
  deductibleImmobilisations: '44562',
  aDecaisser: '44551',
  creditAReporter: '44567',
  remboursementDemande: '44583',
  surFacturesNonParvenues: '44586',
  surFacturesAEtablir: '44587',
} as const
