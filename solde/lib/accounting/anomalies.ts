/**
 * Radar d'anomalies : contrôles purs sur un jeu d'écritures.
 *
 * Chaque anomalie porte un AXE (la nature, qui donne l'angle sur le radar) et
 * une GRAVITÉ de 1 à 3 (qui donne la distance au centre). Le radar est vide
 * quand cette fonction ne renvoie rien — c'est la condition de clôture.
 */

import { inferTaux, isTauxValide } from './vat'
import { auditSequence, type SequenceProblem } from './sequence'
import type { Cents } from './money'
import type { ClosingCheckAxis } from './closing'

export interface AuditEntry {
  readonly id: string
  readonly journalCode: string
  readonly numero: number
  readonly fiscalYearId: string
  readonly date: Date
  readonly libelle: string
  readonly pieceRef: string | null
  readonly statut: 'brouillon' | 'validee'
  readonly lines: readonly {
    readonly accountNumero: string
    readonly debit: Cents
    readonly credit: Cents
    readonly partnerCode?: string | null
  }[]
}

export interface Anomaly {
  readonly code: string
  readonly axe: ClosingCheckAxis
  readonly gravite: 1 | 2 | 3
  readonly message: string
  readonly entryIds: readonly string[]
  readonly montant?: Cents
}

const JOUR_MS = 86_400_000

function totalDebit(entry: AuditEntry): Cents {
  let total = 0
  for (const line of entry.lines) total += line.debit
  return total
}

/** Clé de doublon : même date, même montant, même journal, même libellé normalisé. */
function duplicateKey(entry: AuditEntry): string {
  const libelle = entry.libelle.toLowerCase().replace(/\s+/g, ' ').trim()
  return `${entry.journalCode}|${entry.date.toISOString().slice(0, 10)}|${totalDebit(entry)}|${libelle}`
}

export interface AnomalyOptions {
  /** Historique des montants par fournisseur, pour détecter l'aberration. */
  readonly historiqueParTiers?: ReadonlyMap<string, readonly Cents[]>
  /** Couples (tiers, compte) déjà validés par l'humain. */
  readonly habitudes?: ReadonlyMap<string, ReadonlySet<string>>
}

export function detectAnomalies(
  entries: readonly AuditEntry[],
  options: AnomalyOptions = {},
): Anomaly[] {
  const anomalies: Anomaly[] = []
  const validees = entries.filter((entry) => entry.statut === 'validee')

  // ── Doublons ──────────────────────────────────────────────────────────────
  const parCle = new Map<string, AuditEntry[]>()
  for (const entry of validees) {
    const key = duplicateKey(entry)
    const bucket = parCle.get(key) ?? []
    bucket.push(entry)
    parCle.set(key, bucket)
  }
  for (const bucket of parCle.values()) {
    if (bucket.length > 1) {
      anomalies.push({
        code: 'doublon',
        axe: 'cutoff',
        gravite: 3,
        message: `${bucket.length} écritures identiques : même journal, même date, même montant, même libellé.`,
        entryIds: bucket.map((entry) => entry.id),
        montant: totalDebit(bucket[0] as AuditEntry),
      })
    }
  }

  for (const entry of validees) {
    // ── TVA incohérente avec la base ────────────────────────────────────────
    const tvaLines = entry.lines.filter((line) => line.accountNumero.startsWith('4456') || line.accountNumero.startsWith('4457'))
    if (tvaLines.length === 1) {
      const tvaLine = tvaLines[0]
      if (tvaLine) {
        const tva = Math.abs(tvaLine.debit - tvaLine.credit)
        let base = 0
        for (const line of entry.lines) {
          const classe = line.accountNumero[0]
          if (classe === '6' || classe === '7' || classe === '2') {
            base += Math.abs(line.debit - line.credit)
          }
        }
        if (base > 0 && tva > 0) {
          const taux = inferTaux(base, tva)
          if (taux == null || !isTauxValide(taux)) {
            anomalies.push({
              code: 'tva_incoherente',
              axe: 'tva',
              gravite: 2,
              message: `TVA de ${tva / 100} € sur une base de ${base / 100} € : aucun taux légal ne correspond.`,
              entryIds: [entry.id],
              montant: tva,
            })
          }
        }
      }
    }

    // ── Écriture datée un week-end ──────────────────────────────────────────
    const jour = entry.date.getUTCDay()
    if ((jour === 0 || jour === 6) && entry.journalCode !== 'AN') {
      anomalies.push({
        code: 'date_week_end',
        axe: 'cutoff',
        gravite: 1,
        message: 'Écriture datée un samedi ou un dimanche.',
        entryIds: [entry.id],
      })
    }

    // ── Compte d'attente utilisé ────────────────────────────────────────────
    for (const line of entry.lines) {
      if (line.accountNumero.startsWith('471')) {
        anomalies.push({
          code: 'compte_attente',
          axe: 'cutoff',
          gravite: 3,
          message: 'Compte d’attente 471 mouvementé : l’imputation reste à faire.',
          entryIds: [entry.id],
          montant: Math.abs(line.debit - line.credit),
        })
      }
    }

    // ── Compte inhabituel pour ce tiers ─────────────────────────────────────
    if (options.habitudes) {
      for (const line of entry.lines) {
        const tiers = line.partnerCode
        if (!tiers) continue
        const classe = line.accountNumero[0]
        if (classe !== '6' && classe !== '2') continue
        const connus = options.habitudes.get(tiers)
        if (connus && connus.size > 0 && !connus.has(line.accountNumero)) {
          anomalies.push({
            code: 'compte_inhabituel',
            axe: 'tiers',
            gravite: 1,
            message: `Le compte ${line.accountNumero} n’a jamais été utilisé pour ce tiers.`,
            entryIds: [entry.id],
          })
        }
      }
    }

    // ── Montant aberrant au regard de l'historique du tiers ─────────────────
    if (options.historiqueParTiers) {
      const tiers = entry.lines.find((line) => line.partnerCode)?.partnerCode
      if (tiers) {
        const historique = options.historiqueParTiers.get(tiers)
        if (historique && historique.length >= 4) {
          const montant = totalDebit(entry)
          const moyenne = historique.reduce((acc, value) => acc + value, 0) / historique.length
          const variance =
            historique.reduce((acc, value) => acc + (value - moyenne) ** 2, 0) / historique.length
          const ecartType = Math.sqrt(variance)
          if (ecartType > 0 && Math.abs(montant - moyenne) > 3 * ecartType) {
            anomalies.push({
              code: 'montant_aberrant',
              axe: 'tiers',
              gravite: 2,
              message: `Montant très éloigné de l’historique de ce tiers (moyenne ${Math.round(moyenne) / 100} €).`,
              entryIds: [entry.id],
              montant,
            })
          }
        }
      }
    }
  }

  // ── Séquences ─────────────────────────────────────────────────────────────
  const parJournal = new Map<string, { journalCode: string; fiscalYearId: string; numeros: number[] }>()
  for (const entry of validees) {
    const key = `${entry.journalCode}|${entry.fiscalYearId}`
    const bucket = parJournal.get(key) ?? {
      journalCode: entry.journalCode,
      fiscalYearId: entry.fiscalYearId,
      numeros: [],
    }
    bucket.numeros.push(entry.numero)
    parJournal.set(key, bucket)
  }
  for (const bucket of parJournal.values()) {
    for (const problem of auditSequence(bucket)) {
      anomalies.push(sequenceToAnomaly(problem))
    }
  }

  return anomalies.sort((a, b) => b.gravite - a.gravite || a.code.localeCompare(b.code))
}

function sequenceToAnomaly(problem: SequenceProblem): Anomaly {
  switch (problem.kind) {
    case 'trou':
      return {
        code: 'sequence_trou',
        axe: 'registre',
        gravite: 3,
        message: `Journal ${problem.journalCode} : numéro${problem.numeros.length > 1 ? 's' : ''} ${problem.numeros.join(', ')} manquant${problem.numeros.length > 1 ? 's' : ''} dans la séquence.`,
        entryIds: [],
      }
    case 'doublon':
      return {
        code: 'sequence_doublon',
        axe: 'registre',
        gravite: 3,
        message: `Journal ${problem.journalCode} : numéro ${problem.numeros.join(', ')} attribué deux fois.`,
        entryIds: [],
      }
    case 'depart_invalide':
      return {
        code: 'sequence_depart',
        axe: 'registre',
        gravite: 2,
        message: `Journal ${problem.journalCode} : la séquence démarre à ${problem.premier}.`,
        entryIds: [],
      }
  }
}

/** Position sur le radar : l'angle dit la nature, le rayon dit la gravité. */
export const AXE_ANGLES: Record<ClosingCheckAxis, number> = {
  tva: 0,
  banque: 60,
  tiers: 120,
  immobilisations: 180,
  cutoff: 240,
  registre: 300,
}

export function radarPosition(anomaly: Anomaly): { angle: number; rayon: number } {
  return { angle: AXE_ANGLES[anomaly.axe], rayon: anomaly.gravite / 3 }
}
