import { desequilibre, type Ecriture, type LigneEcriture } from '../types/ecriture'
import type { CodeJournal } from '../types/journal'
import { dansExercice, estDateValide } from '../core/dates'
import { estCompteValideAuPlan } from './aides'
import { creerEcart, type Ecart } from './catalogue'
import type { ContexteControle } from './contexte'

/** Écriture en cours de saisie : ni identifiant ni validation encore. */
export type EcritureCandidate = Pick<Ecriture, 'journalCode' | 'date' | 'numeroPiece' | 'lignes'> &
  Partial<Pick<Ecriture, 'id' | 'libelle'>>

const PIVOTS: Record<CodeJournal, readonly string[]> = {
  AN: [],
  AC: ['401', '403', '404', '405', '408'],
  VE: ['411', '413', '416', '418', '419'],
  BQ: ['512', '514'],
  CA: ['530'],
  OD: [],
}

const porte = (lignes: readonly LigneEcriture[], racines: readonly string[]): boolean =>
  lignes.some((ligne) => racines.some((racine) => ligne.compteNumero.startsWith(racine)))

/**
 * Journal que la nature de l'opération appelle.
 * Renvoie null quand l'opération ne relève d'aucun journal spécialisé : elle
 * se passe alors aux opérations diverses.
 */
export function journalNaturel(lignes: readonly LigneEcriture[]): CodeJournal | null {
  if (porte(lignes, PIVOTS.BQ)) return 'BQ'
  if (porte(lignes, PIVOTS.CA)) return 'CA'
  if (porte(lignes, ['401', '403', '404', '405'])) return 'AC'
  if (porte(lignes, ['411', '413', '416', '419'])) return 'VE'
  return null
}

export function controlerStructure(
  ecriture: EcritureCandidate,
  contexte: ContexteControle,
): Ecart[] {
  const ecarts: Ecart[] = []

  if (ecriture.lignes.length === 0) {
    ecarts.push(creerEcart('STRUCT_ECRITURE_VIDE'))
  }

  ecriture.lignes.forEach((ligne, index) => {
    if (ligne.debit < 0 || ligne.credit < 0) {
      ecarts.push(
        creerEcart('STRUCT_MONTANT_NEGATIF', {
          ligne: index,
          compteConstate: ligne.compteNumero,
          montantConstate: Math.min(ligne.debit, ligne.credit),
        }),
      )
    } else if (ligne.debit !== 0 && ligne.credit !== 0) {
      ecarts.push(
        creerEcart('STRUCT_LIGNE_DEBIT_ET_CREDIT', {
          ligne: index,
          compteConstate: ligne.compteNumero,
        }),
      )
    } else if (ligne.debit === 0 && ligne.credit === 0) {
      ecarts.push(
        creerEcart('STRUCT_LIGNE_SANS_MONTANT', {
          ligne: index,
          compteConstate: ligne.compteNumero,
        }),
      )
    }

    if (!estCompteValideAuPlan(ligne.compteNumero)) {
      ecarts.push(
        creerEcart('STRUCT_COMPTE_INEXISTANT', {
          ligne: index,
          compteConstate: ligne.compteNumero,
        }),
      )
    }
  })

  const ecart = desequilibre(ecriture)
  if (ecart !== 0 && ecriture.lignes.length > 0) {
    ecarts.push(creerEcart('STRUCT_DESEQUILIBRE', { montantConstate: Math.abs(ecart) }))
  }

  if (!estDateValide(ecriture.date)) {
    ecarts.push(creerEcart('STRUCT_DATE_INVALIDE', { date: ecriture.date }))
  } else if (!dansExercice(ecriture.date, contexte.exercice)) {
    ecarts.push(
      creerEcart('STRUCT_DATE_HORS_EXERCICE', {
        date: ecriture.date,
        exerciceDebut: contexte.exercice.debut,
        exerciceFin: contexte.exercice.fin,
      }),
    )
  }

  if (ecriture.numeroPiece.trim() === '') {
    if (contexte.numeroPieceObligatoire !== false) {
      ecarts.push(creerEcart('STRUCT_PIECE_MANQUANTE'))
    }
  } else {
    const doublon = (contexte.ecrituresExistantes ?? []).find(
      (existante) =>
        existante.id !== ecriture.id &&
        existante.journalCode === ecriture.journalCode &&
        existante.numeroPiece.trim() === ecriture.numeroPiece.trim(),
    )
    if (doublon) {
      ecarts.push(
        creerEcart('STRUCT_PIECE_DOUBLON', {
          numeroPiece: ecriture.numeroPiece,
          journalConstate: ecriture.journalCode,
          date: doublon.date,
        }),
      )
    }
  }

  ecarts.push(...controlerJournal(ecriture, contexte))
  return ecarts
}

export function controlerJournal(
  ecriture: EcritureCandidate,
  contexte: ContexteControle,
): Ecart[] {
  if (ecriture.lignes.length === 0) return []

  if (ecriture.journalCode === 'AN') {
    if (estDateValide(ecriture.date) && ecriture.date !== contexte.exercice.debut) {
      return [
        creerEcart('STRUCT_JOURNAL_INCOHERENT', {
          journalConstate: 'AN',
          journalAttendu: 'OD',
          date: ecriture.date,
          precision:
            'Le journal des à-nouveaux ne reçoit que la reprise des soldes, au premier jour de l’exercice.',
        }),
      ]
    }
    return []
  }

  const naturel = journalNaturel(ecriture.lignes)
  if (naturel !== null && naturel !== ecriture.journalCode) {
    return [
      creerEcart('STRUCT_JOURNAL_INCOHERENT', {
        journalConstate: ecriture.journalCode,
        journalAttendu: naturel,
      }),
    ]
  }

  const pivots = PIVOTS[ecriture.journalCode]
  if (naturel === null && pivots.length > 0 && !porte(ecriture.lignes, pivots)) {
    return [
      creerEcart('STRUCT_JOURNAL_INCOHERENT', {
        journalConstate: ecriture.journalCode,
        journalAttendu: 'OD',
        precision:
          'Aucun compte propre à ce journal n’apparaît dans l’écriture ; elle relève des opérations diverses.',
      }),
    ]
  }

  return []
}
