/**
 * La recherche de compte — le geste central de l'atelier.
 *
 * On tape « assurance incendie », on obtient 616000 ET la raison. Deux sources
 * se complètent : le lexique, riche mais restreint aux notions du programme,
 * et le plan comptable entier, exhaustif mais muet. Le lexique passe devant,
 * parce qu'un étudiant a besoin de l'explication avant le numéro.
 */

import { chercher as chercherLexique, normaliser, type EntreeLexique } from '../../lib/accounting/lexique'
import { PCG } from '../../prisma/data/pcg'
import type { RateMilliPct } from '../../lib/accounting/money'

export interface Suggestion {
  readonly compte: string
  readonly libelle: string
  readonly note: string | null
  readonly piege: string | null
  readonly tva: RateMilliPct | null
  readonly sens: 'debit' | 'credit' | null
  readonly score: number
}

const COMPTES_PCG = PCG.map((compte) => ({
  numero: compte.numero,
  libelle: compte.libelle,
  normalise: normaliser(compte.libelle),
  tva: compte.tauxTva ?? null,
}))

function depuisLexique(entree: EntreeLexique, score: number): Suggestion {
  return {
    compte: entree.compte,
    libelle: entree.libelle,
    note: entree.note,
    piege: entree.piege ?? null,
    tva: entree.tva,
    sens: entree.sens,
    score,
  }
}

/**
 * Renvoie les comptes correspondant à la requête, explication comprise quand
 * le lexique en connaît une.
 */
export function suggerer(requete: string, limite = 7): Suggestion[] {
  const q = normaliser(requete)
  if (q.length === 0) return []

  const resultats: Suggestion[] = chercherLexique(requete, limite).map((resultat) =>
    depuisLexique(resultat.entree, resultat.score),
  )
  const dejaVus = new Set(resultats.map((suggestion) => suggestion.compte))

  // Complément par le plan comptable, pour les comptes hors programme.
  for (const compte of COMPTES_PCG) {
    if (resultats.length >= limite) break
    if (dejaVus.has(compte.numero)) continue

    let score = 0
    if (/^\d+$/.test(q) && compte.numero.startsWith(q)) score = 900 - q.length
    else if (compte.normalise.startsWith(q)) score = 600
    else if (q.length >= 3 && compte.normalise.includes(q)) score = 480

    if (score > 0) {
      resultats.push({
        compte: compte.numero,
        libelle: compte.libelle,
        note: null,
        piege: null,
        tva: compte.tva,
        sens: null,
        score,
      })
      dejaVus.add(compte.numero)
    }
  }

  return resultats.sort((a, b) => b.score - a.score).slice(0, limite)
}

/** Le libellé d'un compte connu, pour réafficher une saisie enregistrée. */
export function libelleDe(numero: string): string {
  const pcg = COMPTES_PCG.find((compte) => compte.numero === numero)
  if (pcg) return pcg.libelle
  const lexique = chercherLexique(numero, 1)[0]
  return lexique?.entree.compte === numero ? lexique.entree.libelle : ''
}

/** Existe-t-il au plan comptable ? Sert à signaler un numéro inventé. */
export function existe(numero: string): boolean {
  return COMPTES_PCG.some((compte) => compte.numero === numero)
}
