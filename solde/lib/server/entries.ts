/**
 * Service des écritures : le seul chemin par lequel une écriture entre au
 * journal.
 *
 * Trois choses s'y jouent, et toutes les trois doivent être atomiques :
 *   1. le contrôle d'équilibre et de période ;
 *   2. l'attribution du numéro, séquence continue par (journal, exercice) ;
 *   3. le chaînage cryptographique, séquence continue par société.
 *
 * 2 et 3 sont des compteurs partagés : deux validations simultanées
 * attribueraient le même numéro et le même maillon. D'où le verrou consultatif
 * PostgreSQL pris en tête de transaction, sur la société. Il est libéré par le
 * COMMIT ou le ROLLBACK, jamais laissé pendant.
 */

import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { chain, GENESIS_HASH, type ChainableEntry } from '@/lib/accounting/chain'
import {
  checkEntry,
  EntryValidationError,
  lineSchema,
  reverse,
  type EntryLine,
  type EntryProblem,
} from '@/lib/accounting/entry'
import { nextNumber } from '@/lib/accounting/sequence'
import { exigerDroit, type Contexte } from './context'
import type { Cents } from '@/lib/accounting/money'

export class EcritureIntrouvable extends Error {
  constructor(id: string) {
    super(`Écriture ${id} introuvable.`)
    this.name = 'EcritureIntrouvable'
  }
}

export class EcritureVerrouillee extends Error {
  constructor() {
    super('Une écriture validée est immuable : corrigez-la par contre-passation.')
    this.name = 'EcritureVerrouillee'
  }
}

export class CompteInconnu extends Error {
  readonly numeros: readonly string[]
  constructor(numeros: readonly string[]) {
    super(`Compte${numeros.length > 1 ? 's' : ''} absent${numeros.length > 1 ? 's' : ''} du plan comptable : ${numeros.join(', ')}.`)
    this.name = 'CompteInconnu'
    this.numeros = numeros
  }
}

export class JournalInconnu extends Error {
  constructor(code: string) {
    super(`Journal ${code} inconnu.`)
    this.name = 'JournalInconnu'
  }
}

export interface EcritureInput {
  readonly journalCode: string
  readonly date: Date
  readonly libelle: string
  readonly pieceRef?: string | null
  readonly origine?: string
  readonly lines: readonly {
    readonly accountNumero: string
    readonly debit: Cents
    readonly credit: Cents
    readonly libelle: string
    readonly partnerCode?: string | null
    readonly echeance?: Date | null
  }[]
}

function normaliser(input: EcritureInput): EntryLine[] {
  return input.lines.map((ligne, index) =>
    lineSchema.parse({
      accountNumero: ligne.accountNumero,
      debit: ligne.debit,
      credit: ligne.credit,
      libelle: ligne.libelle,
      position: index,
      partnerCode: ligne.partnerCode ?? null,
      echeance: ligne.echeance ?? null,
    }),
  )
}

/**
 * Crée un brouillon. Un brouillon n'est PAS numéroté : il n'a pas encore
 * d'existence légale, et lui donner un numéro qu'une suppression rendrait
 * orphelin creuserait un trou dans la séquence.
 *
 * L'équilibre n'est pas exigé ici — c'est tout l'intérêt du brouillon : on
 * peut poser une écriture en cours de réflexion. Il l'est à la validation.
 */
export async function creerBrouillon(
  contexte: Contexte,
  input: EcritureInput,
): Promise<{ id: string; problemes: EntryProblem[] }> {
  exigerDroit(contexte, 'entry.draft')
  const lines = normaliser(input)

  const journal = await db.journal.findUnique({
    where: { companyId_code: { companyId: contexte.companyId, code: input.journalCode } },
  })
  if (!journal) throw new JournalInconnu(input.journalCode)

  const comptes = await resoudreComptes(contexte.companyId, lines)
  const partenaires = await resoudrePartenaires(contexte.companyId, input)

  const entry = await db.entry.create({
    data: {
      companyId: contexte.companyId,
      fiscalYearId: contexte.fiscalYearId,
      journalId: journal.id,
      numero: null,
      date: input.date,
      libelle: input.libelle,
      pieceRef: input.pieceRef ?? null,
      statut: 'brouillon',
      origine: input.origine ?? 'saisie',
      createdById: contexte.acteur.userId,
      lines: {
        create: lines.map((ligne, index) => ({
          companyId: contexte.companyId,
          accountId: comptes.get(ligne.accountNumero) ?? '',
          debit: ligne.debit,
          credit: ligne.credit,
          libelle: ligne.libelle,
          position: index,
          echeance: ligne.echeance,
          partnerId: partenaires.get(input.lines[index]?.partnerCode ?? '') ?? null,
        })),
      },
    },
  })

  await tracer(contexte, 'create', 'Entry', entry.id, null, { libelle: input.libelle })

  return {
    id: entry.id,
    problemes: checkEntry({ lines, date: input.date }, contexte.exercice),
  }
}

/**
 * Valide un brouillon : contrôles, numérotation, chaînage. Tout ou rien.
 */
export async function validerEcriture(contexte: Contexte, entryId: string): Promise<{
  id: string
  numero: number
  chainIndex: number
  hash: string
}> {
  exigerDroit(contexte, 'entry.validate')

  return db.$transaction(async (tx) => {
    // Sérialise les validations de CETTE société. Les autres sociétés
    // continuent en parallèle : le verrou porte sur la clé, pas sur la table.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${contexte.companyId}))`

    const entry = await tx.entry.findUnique({
      where: { id: entryId },
      include: { lines: { include: { account: true }, orderBy: { position: 'asc' } }, journal: true },
    })
    if (!entry || entry.companyId !== contexte.companyId) throw new EcritureIntrouvable(entryId)
    if (entry.statut === 'validee') throw new EcritureVerrouillee()

    const lines: EntryLine[] = entry.lines.map((ligne, index) =>
      lineSchema.parse({
        accountNumero: ligne.account.numero,
        debit: ligne.debit,
        credit: ligne.credit,
        libelle: ligne.libelle,
        position: index,
      }),
    )

    const problemes = checkEntry({ lines, date: entry.date }, contexte.exercice)
    if (problemes.length > 0) throw new EntryValidationError(problemes)

    // Numéro : séquence continue par journal ET par exercice.
    const numeros = await tx.entry.findMany({
      where: {
        companyId: contexte.companyId,
        journalId: entry.journalId,
        fiscalYearId: entry.fiscalYearId,
        statut: 'validee',
      },
      select: { numero: true },
    })
    const numero = nextNumber(numeros.map((item) => item.numero ?? 0))

    // Maillon : séquence continue par société, dans l'ordre de validation.
    const dernier = await tx.entry.findFirst({
      where: { companyId: contexte.companyId, statut: 'validee' },
      orderBy: { chainIndex: 'desc' },
      select: { chainIndex: true, hash: true },
    })

    const chainable: ChainableEntry = {
      journalCode: entry.journal.code,
      numero,
      date: entry.date,
      libelle: entry.libelle,
      pieceRef: entry.pieceRef,
      lines: lines.map((ligne) => ({
        accountNumero: ligne.accountNumero,
        debit: ligne.debit,
        credit: ligne.credit,
        libelle: ligne.libelle,
      })),
    }
    const [chainee] = chain([chainable], {
      hash: dernier?.hash ?? GENESIS_HASH,
      index: dernier?.chainIndex ?? 0,
    })
    if (!chainee) throw new Error('Chaînage impossible.')

    await tx.entry.update({
      where: { id: entryId },
      data: {
        numero,
        statut: 'validee',
        chainIndex: chainee.chainIndex,
        hash: chainee.hash,
        hashPrecedent: chainee.hashPrecedent,
        validatedAt: new Date(),
        validatedById: contexte.acteur.userId,
      },
    })

    await tx.auditLog.create({
      data: {
        companyId: contexte.companyId,
        userId: contexte.acteur.userId,
        action: 'validate',
        cible: 'Entry',
        cibleId: entryId,
        apres: JSON.stringify({
          numero,
          chainIndex: chainee.chainIndex,
          hash: chainee.hash,
        }),
      },
    })

    return { id: entryId, numero, chainIndex: chainee.chainIndex, hash: chainee.hash }
  })
}

/** Supprime un brouillon. Une écriture validée n'est jamais supprimable. */
export async function supprimerBrouillon(contexte: Contexte, entryId: string): Promise<void> {
  exigerDroit(contexte, 'entry.draft')
  const entry = await db.entry.findUnique({ where: { id: entryId } })
  if (!entry || entry.companyId !== contexte.companyId) throw new EcritureIntrouvable(entryId)
  if (entry.statut === 'validee') throw new EcritureVerrouillee()

  await db.entry.delete({ where: { id: entryId } })
  await tracer(contexte, 'delete', 'Entry', entryId, { libelle: entry.libelle }, null)
}

/**
 * Contre-passation : la seule correction possible d'une écriture validée.
 * L'extourne est créée en brouillon puis validée dans la foulée, de sorte
 * qu'elle entre dans la chaîne comme n'importe quelle autre écriture.
 */
export async function contrepasser(
  contexte: Contexte,
  entryId: string,
  options: { date?: Date; motif?: string } = {},
): Promise<{ id: string; numero: number }> {
  exigerDroit(contexte, 'entry.reverse')

  const entry = await db.entry.findUnique({
    where: { id: entryId },
    include: { lines: { include: { account: true }, orderBy: { position: 'asc' } }, journal: true },
  })
  if (!entry || entry.companyId !== contexte.companyId) throw new EcritureIntrouvable(entryId)
  if (entry.statut !== 'validee') {
    throw new Error('Un brouillon se supprime, il ne se contre-passe pas.')
  }

  const lines: EntryLine[] = entry.lines.map((ligne, index) =>
    lineSchema.parse({
      accountNumero: ligne.account.numero,
      debit: ligne.debit,
      credit: ligne.credit,
      libelle: ligne.libelle,
      position: index,
    }),
  )

  const date = options.date ?? new Date()
  const extourne = reverse(
    { libelle: entry.libelle, pieceRef: entry.pieceRef, lines },
    { date, journalCode: entry.journal.code, ...(options.motif ? { motif: options.motif } : {}) },
  )

  const brouillon = await creerBrouillon(contexte, {
    journalCode: extourne.journalCode,
    date: extourne.date,
    libelle: extourne.libelle,
    pieceRef: extourne.pieceRef,
    origine: 'contrepassation',
    lines: extourne.lines,
  })
  const validee = await validerEcriture(contexte, brouillon.id)

  await db.entry.update({ where: { id: brouillon.id }, data: { contrepasseId: entryId } })

  return { id: brouillon.id, numero: validee.numero }
}

// ── Lectures ────────────────────────────────────────────────────────────────

export interface EcritureResume {
  readonly id: string
  readonly numero: number | null
  readonly journalCode: string
  readonly date: Date
  readonly libelle: string
  readonly statut: string
  readonly total: Cents
  readonly lignes: number
}

export async function listerEcritures(
  contexte: Contexte,
  options: { statut?: 'brouillon' | 'validee'; limite?: number } = {},
): Promise<EcritureResume[]> {
  const entries = await db.entry.findMany({
    where: {
      companyId: contexte.companyId,
      fiscalYearId: contexte.fiscalYearId,
      ...(options.statut ? { statut: options.statut } : {}),
    },
    include: { journal: true, lines: { select: { debit: true } } },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    take: options.limite ?? 30,
  })

  return entries.map((entry) => ({
    id: entry.id,
    numero: entry.numero,
    journalCode: entry.journal.code,
    date: entry.date,
    libelle: entry.libelle,
    statut: entry.statut,
    total: entry.lines.reduce((acc, ligne) => acc + ligne.debit, 0),
    lignes: entry.lines.length,
  }))
}

// ── Utilitaires ─────────────────────────────────────────────────────────────

async function resoudreComptes(
  companyId: string,
  lines: readonly EntryLine[],
): Promise<Map<string, string>> {
  const numeros = [...new Set(lines.map((ligne) => ligne.accountNumero))]
  const comptes = await db.account.findMany({
    where: { companyId, numero: { in: numeros } },
    select: { id: true, numero: true },
  })
  const map = new Map(comptes.map((compte) => [compte.numero, compte.id]))
  const manquants = numeros.filter((numero) => !map.has(numero))
  if (manquants.length > 0) throw new CompteInconnu(manquants)
  return map
}

async function resoudrePartenaires(
  companyId: string,
  input: EcritureInput,
): Promise<Map<string, string>> {
  const codes = [...new Set(input.lines.map((ligne) => ligne.partnerCode).filter((code): code is string => !!code))]
  if (codes.length === 0) return new Map()
  const partenaires = await db.partner.findMany({
    where: { companyId, code: { in: codes } },
    select: { id: true, code: true },
  })
  return new Map(partenaires.map((partenaire) => [partenaire.code, partenaire.id]))
}

async function tracer(
  contexte: Contexte,
  action: string,
  cible: string,
  cibleId: string,
  avant: Prisma.InputJsonValue | null,
  apres: Prisma.InputJsonValue | null,
): Promise<void> {
  await db.auditLog.create({
    data: {
      companyId: contexte.companyId,
      userId: contexte.acteur.userId,
      action,
      cible,
      cibleId,
      avant: avant ? JSON.stringify(avant) : null,
      apres: apres ? JSON.stringify(apres) : null,
    },
  })
}
