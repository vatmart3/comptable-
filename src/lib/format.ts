const euroFmt = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
})

const numFmt = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })

/** 3 780 € — espace fine insécable, aucune décimale. */
export const euro = (n: number) => euroFmt.format(n)

/** Toujours signé : un solde se lit avec son sens. */
export const signedEuro = (n: number) => (n > 0 ? `+${euroFmt.format(n)}` : euroFmt.format(n))

export const number = (n: number) => numFmt.format(n)

/** Deux chiffres, comme un numéro de pièce comptable. */
export const folio = (n: number) => String(n).padStart(2, '0')
