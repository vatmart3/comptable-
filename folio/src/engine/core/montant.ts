/**
 * Arithmétique monétaire du moteur FOLIO.
 *
 * Tous les montants circulent dans le moteur sous forme d'entiers de centimes.
 * Aucun calcul comptable n'est fait sur des flottants d'euros : c'est la seule
 * façon de tenir la promesse « exact au centime ». La conversion en euros
 * n'intervient qu'aux frontières (saisie, affichage, export).
 */

/** Montant en centimes. Toujours un entier, éventuellement négatif. */
export type Centimes = number

/** Taux exprimé en points de base : 20 % = 2000, 5,5 % = 550, 2,1 % = 210. */
export type PointsDeBase = number

export const ZERO: Centimes = 0

/**
 * Arrondi comptable : au centième le plus proche, le demi s'éloignant de zéro.
 * `Math.round` arrondit -0,5 vers zéro, ce qui fausse les avoirs.
 */
export function arrondi(valeur: number): number {
  return valeur < 0 ? -Math.round(-valeur) : Math.round(valeur)
}

/** Convertit un nombre d'euros en centimes. 12,34 → 1234. */
export function euros(montant: number): Centimes {
  return arrondi(montant * 100)
}

/** Convertit des centimes en nombre d'euros. Réservé à l'affichage et à l'export. */
export function enEuros(centimes: Centimes): number {
  return centimes / 100
}

export function estMontantValide(centimes: unknown): centimes is Centimes {
  return typeof centimes === 'number' && Number.isSafeInteger(centimes)
}

/**
 * Lit un montant saisi au clavier.
 * Accepte « 1 234,56 », « 1234.56 », « 1 234,56 € », « -12,3 », « 1.234,56 ».
 * Renvoie null si la chaîne n'est pas un montant.
 */
export function parseMontant(saisie: string): Centimes | null {
  const nettoye = saisie
    .replace(/[\s  €]/g, '')
    .replace(/\.(?=\d{3}(?:\D|$))/g, '')
    .replace(',', '.')
  if (nettoye === '' || nettoye === '-' || nettoye === '+') return null
  if (!/^[-+]?\d*(?:\.\d*)?$/.test(nettoye)) return null
  const valeur = Number(nettoye)
  if (!Number.isFinite(valeur)) return null
  const centimes = euros(valeur)
  return Number.isSafeInteger(centimes) ? centimes : null
}

/**
 * Rend un montant à la française : espace fine insécable pour les milliers,
 * virgule décimale, deux décimales toujours présentes.
 */
export function formatMontant(
  centimes: Centimes,
  options: { signe?: boolean; zeroVide?: boolean } = {},
): string {
  if (options.zeroVide && centimes === 0) return ''
  const negatif = centimes < 0
  const absolu = Math.abs(centimes)
  const partieEntiere = Math.trunc(absolu / 100).toString()
  const decimales = (absolu % 100).toString().padStart(2, '0')
  const groupee = partieEntiere.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  const prefixe = negatif ? '-' : options.signe ? '+' : ''
  return `${prefixe}${groupee},${decimales}`
}

export function somme(montants: readonly Centimes[]): Centimes {
  let total = 0
  for (const m of montants) total += m
  return total
}

/** Applique un taux en points de base. 100,00 € à 20 % → 20,00 €. */
export function appliquerTaux(base: Centimes, taux: PointsDeBase): Centimes {
  return arrondi((base * taux) / 10_000)
}

/** Montant de TVA correspondant à une base hors taxes. */
export function tvaSurBase(baseHT: Centimes, taux: PointsDeBase): Centimes {
  return appliquerTaux(baseHT, taux)
}

/** Base hors taxes correspondant à un montant toutes taxes comprises. */
export function baseDepuisTTC(montantTTC: Centimes, taux: PointsDeBase): Centimes {
  return arrondi((montantTTC * 10_000) / (10_000 + taux))
}

/** Toutes taxes comprises = base + TVA, la TVA étant arrondie une seule fois. */
export function ttcDepuisHT(baseHT: Centimes, taux: PointsDeBase): Centimes {
  return baseHT + tvaSurBase(baseHT, taux)
}

/** Écart absolu entre deux montants. */
export function ecart(a: Centimes, b: Centimes): Centimes {
  return Math.abs(a - b)
}

/**
 * Répartit un montant en parts proportionnelles à des poids, sans perdre
 * ni créer de centime : le reliquat d'arrondi va aux plus grosses parts.
 * Sert à ventiler une remise globale ou un port sur plusieurs lignes.
 */
export function repartir(montant: Centimes, poids: readonly number[]): Centimes[] {
  const totalPoids = poids.reduce((acc, p) => acc + p, 0)
  if (totalPoids === 0) return poids.map(() => 0)
  const parts = poids.map((p) => Math.trunc((montant * p) / totalPoids))
  let reste = montant - parts.reduce((acc, p) => acc + p, 0)
  const ordre = poids
    .map((p, index) => ({ p, index }))
    .sort((a, b) => b.p - a.p || a.index - b.index)
  let curseur = 0
  const pas = reste < 0 ? -1 : 1
  while (reste !== 0 && ordre.length > 0) {
    const cible = ordre[curseur % ordre.length]!
    parts[cible.index] = parts[cible.index]! + pas
    reste -= pas
    curseur += 1
  }
  return parts
}
