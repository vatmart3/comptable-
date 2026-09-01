/**
 * Codes d'écart du moteur.
 *
 * Le code est la clé du produit : il alimente le diagnostic, l'entraînement
 * ciblé et le tableau de progression. Il est typé, jamais libre. Une erreur
 * d'étudiant qui ne se range dans aucun code est un manque du moteur, pas un
 * message générique à afficher.
 */

export const CODES_STRUCTURE = [
  'STRUCT_DESEQUILIBRE',
  'STRUCT_ECRITURE_VIDE',
  'STRUCT_LIGNE_SANS_MONTANT',
  'STRUCT_LIGNE_DEBIT_ET_CREDIT',
  'STRUCT_MONTANT_NEGATIF',
  'STRUCT_COMPTE_INEXISTANT',
  'STRUCT_JOURNAL_INCOHERENT',
  'STRUCT_DATE_HORS_EXERCICE',
  'STRUCT_DATE_INVALIDE',
  'STRUCT_DATE_ERRONEE',
  'STRUCT_PIECE_MANQUANTE',
  'STRUCT_PIECE_DOUBLON',
] as const

export const CODES_SENS = [
  'SENS_INVERSE',
  'SENS_CONFUSION_BILAN_GESTION',
  'SENS_CONFUSION_401_404',
  'SENS_CONFUSION_411_462',
  'SENS_CONFUSION_CHARGE_IMMOBILISATION',
  'SENS_CLASSE_VOISINE',
] as const

export const CODES_TVA = [
  'TVA_CONFUSION_44566_44562',
  'TVA_CONFUSION_44571_44551',
  'TVA_TAUX_NON_CONFORME',
  'TVA_BASE_ERRONEE',
  'TVA_ARRONDI_NON_CONFORME',
  'TVA_OMISE',
] as const

export const CODES_MONTANTS = [
  'MT_CONFUSION_HT_TTC',
  'MT_ESCOMPTE',
  'MT_REMISE',
  'MT_PORT',
  'MT_EMBALLAGES_CONSIGNES',
  'MT_ECART_ARRONDI',
  'MT_MONTANT_ERRONE',
] as const

export const CODES_INVENTAIRE = [
  'INV_BASE_AMORTISSABLE',
  'INV_PRORATA_TEMPORIS',
  'INV_DEPRECIATION_SUR_BRUT',
  'INV_RATTACHEMENT_EXERCICE',
] as const

export const CODES_GLOBAL = [
  'GLOB_COMPTE_ATTENTE_NON_SOLDE',
  'GLOB_BALANCE_DESEQUILIBREE',
  'GLOB_TIERS_SOLDE_NON_LETTRE',
  'GLOB_RESULTAT_DISCORDANT',
] as const

export const CODES_ECART = [
  ...CODES_STRUCTURE,
  ...CODES_SENS,
  ...CODES_TVA,
  ...CODES_MONTANTS,
  ...CODES_INVENTAIRE,
  ...CODES_GLOBAL,
] as const

export type CodeEcart = (typeof CODES_ECART)[number]

export type FamilleEcart = 'structure' | 'sens' | 'tva' | 'montants' | 'inventaire' | 'global'

/**
 * bloquant : l'écriture ne peut pas être enregistrée en l'état.
 * majeur   : l'écriture s'enregistre mais fausse les états financiers.
 * mineur   : l'écriture est juste au fond, la forme est à reprendre.
 */
export type Gravite = 'bloquant' | 'majeur' | 'mineur'

export function familleDe(code: CodeEcart): FamilleEcart {
  const prefixe = code.split('_')[0]
  switch (prefixe) {
    case 'STRUCT':
      return 'structure'
    case 'SENS':
      return 'sens'
    case 'TVA':
      return 'tva'
    case 'MT':
      return 'montants'
    case 'INV':
      return 'inventaire'
    default:
      return 'global'
  }
}
