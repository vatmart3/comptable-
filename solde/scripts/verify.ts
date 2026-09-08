/**
 * `npm run solde:verify` — contrôle d'intégrité du registre.
 *
 * Recalcule la chaîne cryptographique de chaque société, vérifie la continuité
 * des séquences de numérotation par journal et par exercice, et contrôle que
 * la balance générale est carrée. C'est la commande qu'on lance avant un
 * contrôle fiscal, et celle qui doit être verte tous les matins.
 */

import { PrismaClient } from '@prisma/client'
import { describeBreak, verifyChain, type ChainedEntry } from '../lib/accounting/chain'
import { auditSequence, describeSequenceProblem } from '../lib/accounting/sequence'
import { formatAmount } from '../lib/accounting/money'

const db = new PrismaClient()

async function main(): Promise<void> {
  const companies = await db.company.findMany({ orderBy: { nom: 'asc' } })
  let echecs = 0

  for (const company of companies) {
    console.log(`\n${company.nom} — SIREN ${company.siren}`)

    const entries = await db.entry.findMany({
      where: { companyId: company.id, statut: 'validee' },
      orderBy: { chainIndex: 'asc' },
      include: {
        journal: true,
        lines: { include: { account: true }, orderBy: { position: 'asc' } },
      },
    })

    if (entries.length === 0) {
      console.log('  registre vide — rien à vérifier')
      continue
    }

    const chainees: ChainedEntry[] = entries.map((entry) => ({
      journalCode: entry.journal.code,
      numero: entry.numero,
      date: entry.date,
      libelle: entry.libelle,
      pieceRef: entry.pieceRef,
      lines: entry.lines.map((line) => ({
        accountNumero: line.account.numero,
        debit: line.debit,
        credit: line.credit,
        libelle: line.libelle,
      })),
      chainIndex: entry.chainIndex ?? 0,
      hash: entry.hash ?? '',
      hashPrecedent: entry.hashPrecedent ?? '',
    }))

    const verdict = verifyChain(chainees)
    if (verdict.ok) {
      console.log(`  chaîne : ${verdict.verifiees} écritures vérifiées, intactes`)
    } else {
      echecs += 1
      console.log(`  chaîne : ${verdict.ruptures.length} rupture(s)`)
      for (const rupture of verdict.ruptures) console.log(`    ✗ ${describeBreak(rupture)}`)
    }

    // Séquences, journal par journal et exercice par exercice.
    const sequences = new Map<string, { journalCode: string; fiscalYearId: string; numeros: number[] }>()
    for (const entry of entries) {
      const key = `${entry.journal.code}|${entry.fiscalYearId}`
      const bucket = sequences.get(key) ?? {
        journalCode: entry.journal.code,
        fiscalYearId: entry.fiscalYearId,
        numeros: [],
      }
      bucket.numeros.push(entry.numero)
      sequences.set(key, bucket)
    }
    let problemesSequence = 0
    for (const bucket of sequences.values()) {
      for (const probleme of auditSequence(bucket)) {
        problemesSequence += 1
        console.log(`    ✗ ${describeSequenceProblem(probleme)}`)
      }
    }
    if (problemesSequence === 0) {
      console.log(`  séquences : ${sequences.size} journal(aux), aucune discontinuité`)
    } else {
      echecs += 1
    }

    // Balance générale.
    let debit = 0
    let credit = 0
    for (const entry of entries) {
      for (const line of entry.lines) {
        debit += line.debit
        credit += line.credit
      }
    }
    if (debit === credit) {
      console.log(`  balance : carrée à ${formatAmount(debit)}`)
    } else {
      echecs += 1
      console.log(`    ✗ balance déséquilibrée : ${formatAmount(debit)} / ${formatAmount(credit)}`)
    }
  }

  console.log(echecs === 0 ? '\n✓ Registre intègre.' : `\n✗ ${echecs} contrôle(s) en échec.`)
  process.exitCode = echecs === 0 ? 0 : 1
}

main()
  .catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => {
    void db.$disconnect()
  })
