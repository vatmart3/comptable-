/**
 * Arithmétique monétaire.
 *
 * Règle unique et non négociable : à l'intérieur du moteur, un montant est
 * TOUJOURS un entier de centimes. Aucun flottant ne traverse une écriture.
 * `0.1 + 0.2 !== 0.3` : en comptabilité ce n'est pas une curiosité de
 * développeur, c'est un écart de balance.
 */

/** Montant en centimes. Toujours entier, signe autorisé. */
export type Cents = number

/** Taux en millièmes de pourcent : 20 % s'écrit 20_000. Exact, donc sans dérive. */
export type RateMilliPct = number

export const RATE_SCALE = 100_000 as const

export class MoneyError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MoneyError'
  }
}

export function isCents(value: unknown): value is Cents {
  return typeof value === 'number' && Number.isSafeInteger(value)
}

export function assertCents(value: number, label = 'montant'): Cents {
  if (!Number.isSafeInteger(value)) {
    throw new MoneyError(`${label} doit être un entier de centimes, reçu ${value}`)
  }
  return value
}

/**
 * Arrondi commercial : au plus proche, la moitié s'éloignant de zéro.
 * C'est la règle d'arrondi retenue par l'administration fiscale pour la TVA,
 * et elle diffère de `Math.round` sur les négatifs (`Math.round(-0.5) === -0`).
 */
export function roundHalfUp(value: number): number {
  return value < 0 ? -Math.round(-value) : Math.round(value)
}

/** Convertit des euros (nombre ou chaîne) en centimes. */
export function toCents(euros: number): Cents {
  return roundHalfUp(euros * 100)
}

export function toEuros(cents: Cents): number {
  return cents / 100
}

const AMOUNT_CLEAN = /[\s  €]/g

/**
 * Lit un montant saisi par un humain : « 1 234,56 », « 1234.56 », « 1.234,56 »,
 * « 240 », « -12,5 », « 1 234,56 € ». Renvoie null si ce n'est pas un montant.
 */
export function parseAmount(input: string): Cents | null {
  const raw = input.replace(AMOUNT_CLEAN, '')
  if (raw.length === 0) return null

  const lastComma = raw.lastIndexOf(',')
  const lastDot = raw.lastIndexOf('.')
  let normalized: string

  if (lastComma >= 0 && lastDot >= 0) {
    // Le séparateur décimal est le dernier des deux ; l'autre groupe les milliers.
    const decimalSep = lastComma > lastDot ? ',' : '.'
    const thousandSep = decimalSep === ',' ? '.' : ','
    normalized = raw.split(thousandSep).join('').replace(decimalSep, '.')
  } else if (lastComma >= 0) {
    // « 1,234 » est ambigu : 3 décimales n'existent pas en euros, c'est un millier.
    const decimals = raw.length - lastComma - 1
    normalized = decimals === 3 && raw.indexOf(',') !== lastComma
      ? raw.split(',').join('')
      : raw.replace(',', '.')
  } else {
    normalized = raw
  }

  if (!/^-?\d*(\.\d*)?$/.test(normalized) || normalized === '' || normalized === '-') return null
  const value = Number(normalized)
  if (!Number.isFinite(value)) return null
  return toCents(value)
}

const FR_AMOUNT = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** « 1 234,56 ». Pas de symbole : les colonnes de montants s'alignent au chiffre. */
export function formatAmount(cents: Cents): string {
  return FR_AMOUNT.format(toEuros(cents))
}

/** « 1 234,56 € », pour le texte courant et les PDF. */
export function formatEuros(cents: Cents): string {
  return `${FR_AMOUNT.format(toEuros(cents))} €`
}

/** Format FEC / export : point décimal remplacé par la virgule, sans séparateur de milliers. */
export function formatPlain(cents: Cents): string {
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(cents)
  const units = Math.floor(abs / 100)
  const decimals = abs % 100
  return `${sign}${units},${String(decimals).padStart(2, '0')}`
}

export function sumCents(values: readonly Cents[]): Cents {
  let total = 0
  for (const value of values) total += value
  return assertCents(total, 'somme')
}

/** Applique un taux exact (20 % → 20_000) à une base, avec arrondi commercial. */
export function applyRate(base: Cents, rate: RateMilliPct): Cents {
  return roundHalfUp((base * rate) / RATE_SCALE)
}

/** Retrouve la base hors taxe à partir d'un TTC et d'un taux. */
export function baseFromInclusive(inclusive: Cents, rate: RateMilliPct): Cents {
  return roundHalfUp((inclusive * RATE_SCALE) / (RATE_SCALE + rate))
}

/**
 * Répartit un montant en `parts` proportions sans perdre un centime.
 * Les centimes restants sont attribués aux plus grosses parts (plus grand reste),
 * ce qui garantit `sum(result) === total`. Utilisé pour la ventilation
 * analytique et les remises réparties sur des lignes de facture.
 */
export function allocate(total: Cents, weights: readonly number[]): Cents[] {
  const totalWeight = weights.reduce((acc, w) => acc + w, 0)
  if (totalWeight === 0) {
    const parts = weights.map(() => 0)
    if (parts.length > 0) parts[0] = total
    return parts
  }
  const exact = weights.map((w) => (total * w) / totalWeight)
  const floored = exact.map((value) => Math.trunc(value))
  let remainder = total - floored.reduce((acc, value) => acc + value, 0)
  const order = exact
    .map((value, index) => ({ index, frac: value - Math.trunc(value) }))
    .sort((a, b) => b.frac - a.frac)
  const step = remainder < 0 ? -1 : 1
  let cursor = 0
  while (remainder !== 0 && order.length > 0) {
    const target = order[cursor % order.length]
    if (target !== undefined) {
      const slot = floored[target.index]
      if (slot !== undefined) floored[target.index] = slot + step
      remainder -= step
    }
    cursor += 1
  }
  return floored
}
