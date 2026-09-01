import type { DateComptable, Exercice } from '../core/dates'
import { dansExercice } from '../core/dates'
import { classeDe } from '../referentiel/plan-comptable'
import type { LigneEcriture } from '../types/ecriture'
import type { CodeJournal } from '../types/journal'
import type { Piece } from '../types/piece'
import { estCompteTVA, mouvements, type Mouvement } from './aides'
import { creerEcart, trierEcarts, type Ecart } from './catalogue'
import {
  classerComptePiedDeFacture,
  classerEcartDeMontant,
  classerLigneManquante,
  classerLigneSuperflue,
} from './montants'
import { classerConfusionDeCompte, classerSensInverse } from './sens'
import { classerConfusionComptesTVA, controlerTVASurPiece } from './tva'

export interface OptionsDiagnostic {
  piece?: Piece
  journalSaisi?: CodeJournal
  journalAttendu?: CodeJournal
  dateSaisie?: DateComptable
  dateAttendue?: DateComptable
  exercice?: Exercice
}

/**
 * Compare une écriture saisie à l'écriture attendue et nomme chaque écart.
 *
 * L'appariement se fait par passes de plus en plus tolérantes : d'abord les
 * lignes identiques, puis celles dont seul le montant diffère, puis celles
 * passées à l'envers, puis celles dont seul le compte diffère. Ce qui reste
 * est déclaré manquant ou superflu. Chaque ligne n'est appariée qu'une fois,
 * ce qui garantit un diagnostic stable d'une exécution à l'autre.
 */
export function diagnostiquer(
  saisie: readonly LigneEcriture[],
  attendue: readonly LigneEcriture[],
  options: OptionsDiagnostic = {},
): Ecart[] {
  const ecarts: Ecart[] = []
  const restantsSaisis = mouvements(saisie)
  const restantsAttendus = mouvements(attendue)

  apparier(restantsSaisis, restantsAttendus, (s, a) => s.compte === a.compte && s.sens === a.sens && s.montant === a.montant)

  const montantsDifferents = apparier(
    restantsSaisis,
    restantsAttendus,
    (s, a) => s.compte === a.compte && s.sens === a.sens,
  )
  for (const [s, a] of montantsDifferents) {
    ecarts.push({ ...classerEcartDeMontant(a.compte, s.montant, a.montant), ligne: s.ligne })
  }

  const sensInverses = apparier(
    restantsSaisis,
    restantsAttendus,
    (s, a) => s.compte === a.compte && s.montant === a.montant && s.sens !== a.sens,
  )
  for (const [s] of sensInverses) {
    ecarts.push({ ...classerSensInverse(s.compte, s.sens), ligne: s.ligne })
  }

  const comptesDifferents = apparier(
    restantsSaisis,
    restantsAttendus,
    (s, a) => s.sens === a.sens && s.montant === a.montant,
    (s, a) => (classeDe(s.compte) === classeDe(a.compte) ? 0 : 1),
  )
  for (const [s, a] of comptesDifferents) {
    const ecart =
      classerConfusionComptesTVA(s.compte, a.compte) ??
      classerComptePiedDeFacture(s.compte, a.compte) ??
      classerConfusionDeCompte(s.compte, a.compte)
    ecarts.push({ ...ecart, ligne: s.ligne, montantConstate: s.montant })
  }

  for (const attendu of restantsAttendus) {
    ecarts.push(classerLigneManquante(attendu.compte, attendu.montant))
  }
  for (const saisi of restantsSaisis) {
    ecarts.push({ ...classerLigneSuperflue(saisi.compte, saisi.montant), ligne: saisi.ligne })
  }

  ecarts.push(...controlerEnTete(options))

  return trierEcarts(affiner(ecarts, saisie, options))
}

/** L'écriture saisie est-elle strictement conforme à l'attendu ? */
export function estConforme(
  saisie: readonly LigneEcriture[],
  attendue: readonly LigneEcriture[],
  options: OptionsDiagnostic = {},
): boolean {
  return diagnostiquer(saisie, attendue, options).length === 0
}

function controlerEnTete(options: OptionsDiagnostic): Ecart[] {
  const ecarts: Ecart[] = []

  if (options.journalSaisi && options.journalAttendu && options.journalSaisi !== options.journalAttendu) {
    ecarts.push(
      creerEcart('STRUCT_JOURNAL_INCOHERENT', {
        journalConstate: options.journalSaisi,
        journalAttendu: options.journalAttendu,
      }),
    )
  }

  if (options.dateSaisie && options.dateAttendue && options.dateSaisie !== options.dateAttendue) {
    const exercice = options.exercice
    const horsExercice = exercice !== undefined && !dansExercice(options.dateSaisie, exercice)
    if (horsExercice) {
      ecarts.push(
        creerEcart('STRUCT_DATE_HORS_EXERCICE', {
          date: options.dateSaisie,
          exerciceDebut: exercice.debut,
          exerciceFin: exercice.fin,
        }),
      )
    } else {
      ecarts.push(
        creerEcart('STRUCT_DATE_ERRONEE', {
          date: options.dateSaisie,
          dateAttendue: options.dateAttendue,
        }),
      )
    }
  }

  return ecarts
}

/**
 * Remplace un écart de montant sur un compte de TVA par le diagnostic précis
 * que la pièce permet : taux, base, ou arrondi.
 */
function affiner(
  ecarts: readonly Ecart[],
  saisie: readonly LigneEcriture[],
  options: OptionsDiagnostic,
): Ecart[] {
  if (!options.piece) return [...ecarts]
  const precis = controlerTVASurPiece(saisie, options.piece)
  if (precis.length === 0) return [...ecarts]

  const aRemplacer = new Set(['MT_MONTANT_ERRONE', 'MT_ECART_ARRONDI', 'TVA_ARRONDI_NON_CONFORME'])
  const conserves = ecarts.filter(
    (e) =>
      !(
        aRemplacer.has(e.code) &&
        (estCompteTVA(e.compteConstate ?? '') || estCompteTVA(e.compteAttendu ?? ''))
      ),
  )
  const dejaPresents = new Set(conserves.map((e) => e.code))
  return [...conserves, ...precis.filter((e) => !dejaPresents.has(e.code))]
}

/**
 * Apparie deux listes de mouvements selon un prédicat, en retirant les
 * mouvements appariés des listes. Le comparateur facultatif départage
 * plusieurs candidats.
 */
function apparier(
  saisis: Mouvement[],
  attendus: Mouvement[],
  correspond: (saisi: Mouvement, attendu: Mouvement) => boolean,
  preference?: (saisi: Mouvement, attendu: Mouvement) => number,
): [Mouvement, Mouvement][] {
  const paires: [Mouvement, Mouvement][] = []
  for (let i = 0; i < saisis.length; i += 1) {
    const saisi = saisis[i]!
    const candidats = attendus
      .map((attendu, index) => ({ attendu, index }))
      .filter(({ attendu }) => correspond(saisi, attendu))
    if (candidats.length === 0) continue
    if (preference) {
      candidats.sort((a, b) => preference(saisi, a.attendu) - preference(saisi, b.attendu))
    }
    const retenu = candidats[0]!
    paires.push([saisi, retenu.attendu])
    attendus.splice(retenu.index, 1)
    saisis.splice(i, 1)
    i -= 1
  }
  return paires
}
