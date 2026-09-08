/**
 * Tests d'intégration du service d'écritures — sur une vraie base.
 *
 * Ce que les tests unitaires du moteur ne peuvent pas prouver : que la
 * numérotation et le chaînage tiennent quand plusieurs validations se
 * bousculent, et qu'une écriture validée résiste réellement à la suppression.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { JOURNAUX, PCG } from '@/prisma/data/pcg'
import { accountClass, accountNature, isLettrable, naturalSide } from '@/lib/accounting/account'
import { verifyChain, GENESIS_HASH, type ChainedEntry } from '@/lib/accounting/chain'
import { findGaps } from '@/lib/accounting/sequence'
import {
  contrepasser,
  creerBrouillon,
  EcritureVerrouillee,
  listerEcritures,
  supprimerBrouillon,
  validerEcriture,
} from '@/lib/server/entries'
import { EntryValidationError } from '@/lib/accounting/entry'
import type { Contexte } from '@/lib/server/context'

const db = new PrismaClient()
const SIRET_TEST = '99999999900017'

let contexte: Contexte

const disponible = await db
  .$queryRaw`SELECT 1`
  .then(() => true)
  .catch(() => false)

describe.skipIf(!disponible)('service des écritures', () => {
  beforeAll(async () => {
    await db.company.deleteMany({ where: { siret: SIRET_TEST } })

    const company = await db.company.create({
      data: {
        nom: 'Société de test',
        siret: SIRET_TEST,
        siren: SIRET_TEST.slice(0, 9),
        categorieRevenu: 'BIC',
        regimeImposition: 'reel_normal',
        regimeTva: 'reel_normal',
      },
    })
    const exercice = await db.fiscalYear.create({
      data: {
        companyId: company.id,
        libelle: 'Exercice 2025',
        dateDebut: new Date(Date.UTC(2025, 0, 1)),
        dateFin: new Date(Date.UTC(2025, 11, 31)),
        statut: 'ouvert',
      },
    })
    await db.account.createMany({
      data: PCG.map((compte) => ({
        companyId: company.id,
        numero: compte.numero,
        libelle: compte.libelle,
        classe: accountClass(compte.numero),
        nature: accountNature(compte.numero),
        sensNaturel: naturalSide(compte.numero),
        lettrable: isLettrable(compte.numero),
        tauxTvaAttendu: compte.tauxTva ?? null,
      })),
    })
    await db.journal.createMany({
      data: JOURNAUX.map((journal) => ({
        companyId: company.id,
        code: journal.code,
        libelle: journal.libelle,
        type: journal.type,
      })),
    })
    const user = await db.user.upsert({
      where: { email: 'test@solde.local' },
      update: {},
      create: { email: 'test@solde.local', name: 'Testeur', emailVerified: true },
    })
    await db.membership.create({
      data: { userId: user.id, companyId: company.id, role: 'expert' },
    })

    contexte = {
      companyId: company.id,
      companyNom: company.nom,
      siren: company.siren,
      fiscalYearId: exercice.id,
      exercice: { dateDebut: exercice.dateDebut, dateFin: exercice.dateFin, statut: 'ouvert' },
      acteur: { userId: user.id, nom: user.name, email: user.email, role: 'expert' },
    }
  })

  afterAll(async () => {
    await db.company.deleteMany({ where: { siret: SIRET_TEST } })
    await db.$disconnect()
  })

  function achat(montantHt: number, jour: number) {
    const tva = Math.round(montantHt * 0.2)
    return {
      journalCode: 'AC',
      date: new Date(Date.UTC(2025, 2, jour)),
      libelle: `Achat ${jour}`,
      lines: [
        { accountNumero: '606100', debit: montantHt, credit: 0, libelle: 'Carburant' },
        { accountNumero: '445660', debit: tva, credit: 0, libelle: 'TVA' },
        { accountNumero: '401000', debit: 0, credit: montantHt + tva, libelle: 'Fournisseur' },
      ],
    }
  }

  it('crée un brouillon sans numéro — un brouillon n’a pas d’existence légale', async () => {
    const { id } = await creerBrouillon(contexte, achat(20_000, 3))
    const entry = await db.entry.findUniqueOrThrow({ where: { id } })
    expect(entry.numero).toBeNull()
    expect(entry.statut).toBe('brouillon')
    expect(entry.hash).toBeNull()
  })

  it('accepte un brouillon déséquilibré mais le signale', async () => {
    const { problemes } = await creerBrouillon(contexte, {
      journalCode: 'OD',
      date: new Date(Date.UTC(2025, 2, 4)),
      libelle: 'Bancal',
      lines: [
        { accountNumero: '606100', debit: 10_000, credit: 0, libelle: 'x' },
        { accountNumero: '401000', debit: 0, credit: 9_000, libelle: 'y' },
      ],
    })
    expect(problemes.map((p) => p.code)).toContain('desequilibre')
  })

  it('refuse de valider une écriture déséquilibrée', async () => {
    const { id } = await creerBrouillon(contexte, {
      journalCode: 'OD',
      date: new Date(Date.UTC(2025, 2, 5)),
      libelle: 'Bancal 2',
      lines: [
        { accountNumero: '606100', debit: 10_000, credit: 0, libelle: 'x' },
        { accountNumero: '401000', debit: 0, credit: 9_000, libelle: 'y' },
      ],
    })
    await expect(validerEcriture(contexte, id)).rejects.toBeInstanceOf(EntryValidationError)
    const entry = await db.entry.findUniqueOrThrow({ where: { id } })
    expect(entry.statut).toBe('brouillon')
  })

  it('refuse une date hors exercice', async () => {
    const { id } = await creerBrouillon(contexte, achat(10_000, 6))
    await db.entry.update({ where: { id }, data: { date: new Date(Date.UTC(2026, 0, 5)) } })
    await expect(validerEcriture(contexte, id)).rejects.toBeInstanceOf(EntryValidationError)
  })

  it('numérote à la validation, en séquence continue par journal', async () => {
    const a = await creerBrouillon(contexte, achat(10_000, 7))
    const b = await creerBrouillon(contexte, achat(20_000, 8))
    const validA = await validerEcriture(contexte, a.id)
    const validB = await validerEcriture(contexte, b.id)
    expect(validB.numero).toBe(validA.numero + 1)
  })

  it('tient des séquences indépendantes par journal', async () => {
    const vente = await creerBrouillon(contexte, {
      journalCode: 'VE',
      date: new Date(Date.UTC(2025, 2, 9)),
      libelle: 'Vente',
      lines: [
        { accountNumero: '411000', debit: 12_000, credit: 0, libelle: 'Client' },
        { accountNumero: '706000', debit: 0, credit: 10_000, libelle: 'Presta' },
        { accountNumero: '445711', debit: 0, credit: 2_000, libelle: 'TVA' },
      ],
    })
    const validee = await validerEcriture(contexte, vente.id)
    expect(validee.numero).toBe(1) // premier du journal VE
  })

  it('chaîne chaque écriture validée à la précédente', async () => {
    const entries = await db.entry.findMany({
      where: { companyId: contexte.companyId, statut: 'validee' },
      orderBy: { chainIndex: 'asc' },
      include: { journal: true, lines: { include: { account: true }, orderBy: { position: 'asc' } } },
    })
    expect(entries.length).toBeGreaterThan(2)

    const chainees: ChainedEntry[] = entries.map((entry) => ({
      journalCode: entry.journal.code,
      numero: entry.numero ?? 0,
      date: entry.date,
      libelle: entry.libelle,
      pieceRef: entry.pieceRef,
      lines: entry.lines.map((ligne) => ({
        accountNumero: ligne.account.numero,
        debit: ligne.debit,
        credit: ligne.credit,
        libelle: ligne.libelle,
      })),
      chainIndex: entry.chainIndex ?? 0,
      hash: entry.hash ?? '',
      hashPrecedent: entry.hashPrecedent ?? '',
    }))

    const verdict = verifyChain(chainees)
    expect(verdict.ruptures).toEqual([])
    expect(verdict.ok).toBe(true)
    expect(chainees[0]?.hashPrecedent).toBe(GENESIS_HASH)
  })

  it('détecte l’altération d’une écriture validée en base', async () => {
    const cible = await db.entry.findFirstOrThrow({
      where: { companyId: contexte.companyId, statut: 'validee' },
      orderBy: { chainIndex: 'asc' },
      include: { lines: true },
    })
    const ligne = cible.lines[0]
    expect(ligne).toBeDefined()

    // On simule une main malveillante avec un accès direct à la base.
    await db.line.update({ where: { id: ligne!.id }, data: { debit: ligne!.debit + 1 } })

    const entries = await db.entry.findMany({
      where: { companyId: contexte.companyId, statut: 'validee' },
      orderBy: { chainIndex: 'asc' },
      include: { journal: true, lines: { include: { account: true }, orderBy: { position: 'asc' } } },
    })
    const verdict = verifyChain(
      entries.map((entry) => ({
        journalCode: entry.journal.code,
        numero: entry.numero ?? 0,
        date: entry.date,
        libelle: entry.libelle,
        pieceRef: entry.pieceRef,
        lines: entry.lines.map((l) => ({
          accountNumero: l.account.numero,
          debit: l.debit,
          credit: l.credit,
          libelle: l.libelle,
        })),
        chainIndex: entry.chainIndex ?? 0,
        hash: entry.hash ?? '',
        hashPrecedent: entry.hashPrecedent ?? '',
      })),
    )
    expect(verdict.ok).toBe(false)
    expect(verdict.ruptures.some((r) => r.kind === 'hash_altere')).toBe(true)

    // On remet en état pour la suite de la suite.
    await db.line.update({ where: { id: ligne!.id }, data: { debit: ligne!.debit } })
  })

  it('refuse de valider deux fois', async () => {
    const validee = await db.entry.findFirstOrThrow({
      where: { companyId: contexte.companyId, statut: 'validee' },
    })
    await expect(validerEcriture(contexte, validee.id)).rejects.toBeInstanceOf(EcritureVerrouillee)
  })

  it('refuse de supprimer une écriture validée', async () => {
    const validee = await db.entry.findFirstOrThrow({
      where: { companyId: contexte.companyId, statut: 'validee' },
    })
    await expect(supprimerBrouillon(contexte, validee.id)).rejects.toBeInstanceOf(EcritureVerrouillee)
  })

  it('supprime un brouillon sans creuser de trou dans la séquence', async () => {
    const brouillon = await creerBrouillon(contexte, achat(30_000, 10))
    await supprimerBrouillon(contexte, brouillon.id)

    const suivant = await creerBrouillon(contexte, achat(40_000, 11))
    const validee = await validerEcriture(contexte, suivant.id)

    const numeros = await db.entry.findMany({
      where: { companyId: contexte.companyId, statut: 'validee', journal: { code: 'AC' } },
      select: { numero: true },
    })
    expect(findGaps(numeros.map((item) => item.numero ?? 0))).toEqual([])
    expect(validee.numero).toBe(numeros.length)
  })

  it('corrige par contre-passation, jamais par modification', async () => {
    const origine = await creerBrouillon(contexte, achat(50_000, 12))
    const validee = await validerEcriture(contexte, origine.id)

    const extourne = await contrepasser(contexte, origine.id, {
      date: new Date(Date.UTC(2025, 2, 13)),
      motif: 'mauvais compte',
    })
    expect(extourne.numero).toBe(validee.numero + 1)

    const entry = await db.entry.findUniqueOrThrow({
      where: { id: extourne.id },
      include: { lines: { include: { account: true }, orderBy: { position: 'asc' } } },
    })
    expect(entry.contrepasseId).toBe(origine.id)
    expect(entry.libelle).toContain('Extourne')
    expect(entry.libelle).toContain('mauvais compte')

    // Les sens sont inversés, et le couple s'annule exactement.
    const charge = entry.lines.find((l) => l.account.numero === '606100')
    expect(charge?.credit).toBe(50_000)
    expect(charge?.debit).toBe(0)

    const soldeCharge = await db.line.aggregate({
      where: { companyId: contexte.companyId, account: { numero: '606100' }, entry: { statut: 'validee' } },
      _sum: { debit: true, credit: true },
    })
    expect(soldeCharge._sum.debit).toBeGreaterThan(0)
  })

  it('sérialise les validations concurrentes — aucun numéro en double', async () => {
    const brouillons = await Promise.all(
      [20, 21, 22, 23, 24, 25].map((jour) => creerBrouillon(contexte, achat(1_000 * jour, jour))),
    )
    const resultats = await Promise.all(
      brouillons.map((brouillon) => validerEcriture(contexte, brouillon.id)),
    )

    const numeros = resultats.map((resultat) => resultat.numero)
    expect(new Set(numeros).size).toBe(numeros.length)

    const maillons = resultats.map((resultat) => resultat.chainIndex)
    expect(new Set(maillons).size).toBe(maillons.length)

    const toutes = await db.entry.findMany({
      where: { companyId: contexte.companyId, statut: 'validee', journal: { code: 'AC' } },
      select: { numero: true },
    })
    expect(findGaps(toutes.map((item) => item.numero ?? 0))).toEqual([])
  })

  it('trace la validation dans la piste d’audit', async () => {
    const traces = await db.auditLog.findMany({
      where: { companyId: contexte.companyId, action: 'validate' },
    })
    expect(traces.length).toBeGreaterThan(0)
    expect(traces[0]?.userId).toBe(contexte.acteur.userId)
    expect(traces[0]?.apres).toContain('hash')
  })

  it('liste les écritures de l’exercice', async () => {
    const liste = await listerEcritures(contexte, { statut: 'validee', limite: 5 })
    expect(liste.length).toBeGreaterThan(0)
    expect(liste[0]?.numero).not.toBeNull()
    expect(liste[0]?.total).toBeGreaterThan(0)
  })
})
