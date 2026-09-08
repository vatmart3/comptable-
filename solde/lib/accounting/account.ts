/**
 * Plan Comptable Général : classification et règles portées par le numéro de compte.
 *
 * En comptabilité française le numéro n'est pas un identifiant, c'est une
 * grammaire : le premier chiffre donne la classe, donc la nature (bilan ou
 * gestion), donc le sens naturel du solde, donc la place dans les états.
 * Tout ce fichier découle de cette grammaire — rien n'y est arbitraire.
 */

export type AccountClass = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8

/** Nature au sens des états financiers. */
export type AccountNature = 'bilan' | 'gestion' | 'special'

/** Sens dans lequel le compte est censé se solder. */
export type AccountSide = 'debit' | 'credit' | 'mixte'

export interface AccountShape {
  readonly numero: string
  readonly classe: AccountClass
  readonly nature: AccountNature
  readonly sensNaturel: AccountSide
  readonly lettrable: boolean
}

const NUMERO_PATTERN = /^[1-8]\d{1,19}$/

export function isValidAccountNumber(numero: string): boolean {
  return NUMERO_PATTERN.test(numero)
}

export class AccountError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AccountError'
  }
}

export function accountClass(numero: string): AccountClass {
  if (!isValidAccountNumber(numero)) {
    throw new AccountError(`Numéro de compte invalide : « ${numero} »`)
  }
  return Number(numero[0]) as AccountClass
}

/**
 * Classes 1 à 5 : comptes de bilan, ils survivent à la clôture (à-nouveaux).
 * Classes 6 et 7 : comptes de gestion, ils sont soldés dans le résultat.
 * Classe 8 : comptes spéciaux (engagements hors bilan).
 */
export function accountNature(numero: string): AccountNature {
  const classe = accountClass(numero)
  if (classe <= 5) return 'bilan'
  if (classe <= 7) return 'gestion'
  return 'special'
}

export function isBalanceSheet(numero: string): boolean {
  return accountNature(numero) === 'bilan'
}

export function isIncomeStatement(numero: string): boolean {
  return accountNature(numero) === 'gestion'
}

/**
 * Sens naturel du solde. « mixte » signale les comptes qui vivent
 * légitimement des deux côtés (banque, comptes de tiers, 471 d'attente).
 */
export function naturalSide(numero: string): AccountSide {
  const classe = accountClass(numero)
  switch (classe) {
    case 1:
      return 'credit' // capitaux propres, emprunts
    case 2:
      return numero.startsWith('28') || numero.startsWith('29') ? 'credit' : 'debit'
    case 3:
      return numero.startsWith('39') ? 'credit' : 'debit'
    case 4:
      // 40x fournisseurs (crédit), 41x clients (débit), 44x selon le sous-compte.
      if (numero.startsWith('40')) return 'credit'
      if (numero.startsWith('41')) return 'debit'
      if (numero.startsWith('49')) return 'credit'
      return 'mixte'
    case 5:
      return 'mixte' // un compte bancaire peut être à découvert
    case 6:
      return 'debit'
    case 7:
      return 'credit'
    default:
      return 'mixte'
  }
}

/**
 * Comptes lettrables : ceux dont on suit l'apurement pièce à pièce.
 * Tiers (40, 41), débiteurs/créditeurs divers (46), comptes d'attente (47).
 * Le 471 est lettrable parce qu'un compte d'attente non soldé doit se voir.
 */
export function isLettrable(numero: string): boolean {
  return (
    numero.startsWith('40') ||
    numero.startsWith('41') ||
    numero.startsWith('42') ||
    numero.startsWith('43') ||
    numero.startsWith('46') ||
    numero.startsWith('47')
  )
}

/** Compte collectif : reçoit des comptes auxiliaires (401000, 411000). */
export function isCollective(numero: string): boolean {
  return numero === '401000' || numero === '411000' || numero === '401' || numero === '411'
}

/** Compte de trésorerie au sens large (banque, caisse, virements internes). */
export function isTreasury(numero: string): boolean {
  return numero.startsWith('51') || numero.startsWith('53') || numero.startsWith('58')
}

export function isVatAccount(numero: string): boolean {
  return numero.startsWith('445')
}

/** Compte d'immobilisation amortissable (hors terrains 211 et immos financières 26/27). */
export function isDepreciableAsset(numero: string): boolean {
  const classe = accountClass(numero)
  if (classe !== 2) return false
  if (numero.startsWith('211')) return false // les terrains ne s'amortissent pas
  if (numero.startsWith('26') || numero.startsWith('27')) return false
  if (numero.startsWith('28') || numero.startsWith('29')) return false
  return true
}

/**
 * Compte d'amortissement associé à un compte d'immobilisation :
 * 215400 → 281540. La règle PCG est d'insérer « 8 » en deuxième position.
 */
export function depreciationAccountFor(numeroImmo: string): string {
  if (accountClass(numeroImmo) !== 2) {
    throw new AccountError(`${numeroImmo} n'est pas un compte d'immobilisation`)
  }
  const body = numeroImmo.slice(1)
  return `28${body}`.slice(0, Math.max(6, numeroImmo.length))
}

export function describe(numero: string): AccountShape {
  return {
    numero,
    classe: accountClass(numero),
    nature: accountNature(numero),
    sensNaturel: naturalSide(numero),
    lettrable: isLettrable(numero),
  }
}

/**
 * Compare deux numéros de compte dans l'ordre du plan comptable.
 * « 411000 » vient avant « 4110001 » ; l'ordre est lexicographique sur les
 * chiffres, pas numérique, sinon 512 se retrouverait après 51200.
 */
export function compareAccountNumbers(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/** Un compte auxiliaire hérite du collectif : 411DUPONT est rattaché à 411000. */
export function collectiveOf(numeroAuxiliaire: string): string {
  const prefix = numeroAuxiliaire.slice(0, 3)
  return `${prefix}000`
}
