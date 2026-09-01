import type { CodeJournal, Journal } from '../types/journal'

/**
 * Journaux du dossier. Les comptes pivots servent au contrôle de cohérence :
 * une facture d'achat passée au journal des ventes est une erreur de structure,
 * pas une erreur de montant.
 */
export const JOURNAUX: readonly Journal[] = [
  {
    code: 'AN',
    libelle: 'À-nouveaux',
    nature: 'a-nouveaux',
    comptesPivots: [],
  },
  {
    code: 'AC',
    libelle: 'Achats',
    nature: 'achats',
    comptesPivots: ['401', '403', '404', '405', '408'],
  },
  {
    code: 'VE',
    libelle: 'Ventes',
    nature: 'ventes',
    comptesPivots: ['411', '413', '416', '418', '419'],
  },
  {
    code: 'BQ',
    libelle: 'Banque',
    nature: 'tresorerie',
    compteContrepartie: '512',
    comptesPivots: ['512', '514'],
  },
  {
    code: 'CA',
    libelle: 'Caisse',
    nature: 'tresorerie',
    compteContrepartie: '530',
    comptesPivots: ['530'],
  },
  {
    code: 'OD',
    libelle: 'Opérations diverses',
    nature: 'operations-diverses',
    comptesPivots: [],
  },
]

const PAR_CODE = new Map<CodeJournal, Journal>(JOURNAUX.map((j) => [j.code, j]))

export function trouverJournal(code: string): Journal | undefined {
  return PAR_CODE.get(code as CodeJournal)
}

export function estCodeJournal(code: string): code is CodeJournal {
  return PAR_CODE.has(code as CodeJournal)
}
