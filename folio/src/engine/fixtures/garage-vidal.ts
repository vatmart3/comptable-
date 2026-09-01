/**
 * Dossier de référence des tests : le garage Vidal, exercice 2025.
 * Un exercice complet et minuscule, tenu de l'à-nouveau à la clôture, dont
 * tous les états sont vérifiables à la main.
 */
import { euros } from '../core/montant'
import type { Dossier } from '../types/dossier'
import type { Ecriture, LigneEcriture } from '../types/ecriture'
import type { CodeJournal } from '../types/journal'

export const DOSSIER: Dossier = {
  id: 'garage-vidal',
  raisonSociale: 'Garage Vidal',
  formeJuridique: 'SARL',
  siren: '812345678',
  regimeTVA: 'reel-normal',
  exerciceDebut: '2025-01-01',
  exerciceFin: '2025-12-31',
  planComptableId: 'pcg-bts',
  statut: 'ouvert',
}

export const EXERCICE = { debut: DOSSIER.exerciceDebut, fin: DOSSIER.exerciceFin }

export function ligne(
  compteNumero: string,
  libelle: string,
  debit: number,
  credit: number,
  extra: Partial<LigneEcriture> = {},
): LigneEcriture {
  return { compteNumero, libelle, debit: euros(debit), credit: euros(credit), ...extra }
}

export function ecriture(
  id: string,
  journalCode: CodeJournal,
  date: string,
  numeroPiece: string,
  libelle: string,
  lignes: LigneEcriture[],
): Ecriture {
  return {
    id,
    dossierId: DOSSIER.id,
    journalCode,
    date,
    numeroPiece,
    libelle,
    lignes,
    validee: true,
    dateValidation: '2026-01-15',
  }
}

export const ECRITURES: Ecriture[] = [
  ecriture('e1', 'AN', '2025-01-01', 'AN-2025', 'Reprise des soldes', [
    ligne('2183', 'Matériel de bureau', 3000, 0),
    ligne('512', 'Banque', 20000, 0),
    ligne('28183', 'Amortissements du matériel de bureau', 0, 1200),
    ligne('401', 'Fournisseur Roux', 0, 2400, { lettrage: 'A', dateLettrage: '2025-02-20' }),
    ligne('101', 'Capital', 0, 19400),
  ]),
  ecriture('e2', 'AC', '2025-02-05', 'FA-114', 'Facture Roux, pièces détachées', [
    ligne('607', 'Achats de marchandises', 1000, 0),
    ligne('44566', 'TVA déductible sur autres biens et services', 200, 0),
    ligne('401', 'Fournisseur Roux', 0, 1200),
  ]),
  ecriture('e3', 'VE', '2025-02-10', 'FV-201', 'Facture Mercier, révision', [
    ligne('411', 'Client Mercier', 2400, 0, { lettrage: 'A', dateLettrage: '2025-02-15', echeance: '2025-03-12' }),
    ligne('707', 'Ventes de marchandises', 0, 2000),
    ligne('44571', 'TVA collectée', 0, 400),
  ]),
  ecriture('e4', 'BQ', '2025-02-15', 'BQ-018', 'Virement Mercier', [
    ligne('512', 'Banque', 2400, 0),
    ligne('411', 'Client Mercier', 0, 2400, { lettrage: 'A', dateLettrage: '2025-02-15' }),
  ]),
  ecriture('e5', 'BQ', '2025-02-20', 'BQ-019', 'Règlement Roux', [
    ligne('401', 'Fournisseur Roux', 1200, 0),
    ligne('512', 'Banque', 0, 1200),
  ]),
  ecriture('e6', 'OD', '2025-02-28', 'TVA-02', 'Déclaration de TVA de février', [
    ligne('44571', 'TVA collectée', 400, 0),
    ligne('44566', 'TVA déductible sur autres biens et services', 0, 200),
    ligne('44551', 'TVA à décaisser', 0, 200),
  ]),
  ecriture('e7', 'OD', '2025-12-31', 'OD-12', 'Dotation aux amortissements', [
    ligne('6811', 'Dotations aux amortissements sur immobilisations', 600, 0),
    ligne('28183', 'Amortissements du matériel de bureau', 0, 600),
  ]),
]
