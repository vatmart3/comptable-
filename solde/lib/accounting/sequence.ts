/**
 * Numérotation des écritures.
 *
 * Exigence légale : séquence chronologique continue par journal et par
 * exercice, sans trou. Un trou n'est pas un détail esthétique — c'est la trace
 * d'une écriture supprimée, donc une présomption de fraude. Le radar de
 * clôture le remonte en anomalie bloquante.
 */

export interface SequenceState {
  readonly journalCode: string
  readonly fiscalYearId: string
  readonly numeros: readonly number[]
}

export function nextNumber(numeros: readonly number[]): number {
  let max = 0
  for (const numero of numeros) {
    if (numero > max) max = numero
  }
  return max + 1
}

/** Renvoie les numéros manquants entre 1 et le plus grand numéro attribué. */
export function findGaps(numeros: readonly number[]): number[] {
  if (numeros.length === 0) return []
  const present = new Set(numeros)
  let max = 0
  for (const numero of numeros) {
    if (numero > max) max = numero
  }
  const gaps: number[] = []
  for (let candidate = 1; candidate <= max; candidate += 1) {
    if (!present.has(candidate)) gaps.push(candidate)
  }
  return gaps
}

export function findDuplicates(numeros: readonly number[]): number[] {
  const seen = new Set<number>()
  const duplicates = new Set<number>()
  for (const numero of numeros) {
    if (seen.has(numero)) duplicates.add(numero)
    seen.add(numero)
  }
  return [...duplicates].sort((a, b) => a - b)
}

export type SequenceProblem =
  | { readonly kind: 'trou'; readonly journalCode: string; readonly numeros: readonly number[] }
  | { readonly kind: 'doublon'; readonly journalCode: string; readonly numeros: readonly number[] }
  | { readonly kind: 'depart_invalide'; readonly journalCode: string; readonly premier: number }

/** Contrôle complet d'un journal sur un exercice. */
export function auditSequence(state: SequenceState): SequenceProblem[] {
  const problems: SequenceProblem[] = []
  if (state.numeros.length === 0) return problems

  const sorted = [...state.numeros].sort((a, b) => a - b)
  const first = sorted[0] ?? 1
  if (first !== 1) {
    problems.push({ kind: 'depart_invalide', journalCode: state.journalCode, premier: first })
  }
  const gaps = findGaps(state.numeros)
  if (gaps.length > 0) {
    problems.push({ kind: 'trou', journalCode: state.journalCode, numeros: gaps })
  }
  const duplicates = findDuplicates(state.numeros)
  if (duplicates.length > 0) {
    problems.push({ kind: 'doublon', journalCode: state.journalCode, numeros: duplicates })
  }
  return problems
}

export function describeSequenceProblem(problem: SequenceProblem): string {
  switch (problem.kind) {
    case 'trou':
      return `Journal ${problem.journalCode} : numéro${problem.numeros.length > 1 ? 's' : ''} ${problem.numeros.join(', ')} manquant${problem.numeros.length > 1 ? 's' : ''}.`
    case 'doublon':
      return `Journal ${problem.journalCode} : numéro${problem.numeros.length > 1 ? 's' : ''} ${problem.numeros.join(', ')} attribué${problem.numeros.length > 1 ? 's' : ''} deux fois.`
    case 'depart_invalide':
      return `Journal ${problem.journalCode} : la séquence commence à ${problem.premier} au lieu de 1.`
  }
}

/**
 * Numéro de pièce lisible : « VE-2025-0042 ». Le numéro interne reste l'entier ;
 * cette forme n'existe que pour l'affichage et les PDF.
 */
export function formatEntryNumber(journalCode: string, annee: number, numero: number): string {
  return `${journalCode}-${annee}-${String(numero).padStart(4, '0')}`
}
