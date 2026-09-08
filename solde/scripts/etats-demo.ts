/**
 * Contrôle de vraisemblance du seed de démonstration.
 * Ce n'est pas un test : c'est le coup d'œil qu'un comptable jette sur une
 * balance avant de la croire.
 */
import { PrismaClient } from '@prisma/client'
import {
  balanceIsSquare,
  balanceSheet,
  computeBalance,
  incomeStatement,
  sig,
} from '../lib/accounting/statements'
import { formatEuros } from '../lib/accounting/money'

const db = new PrismaClient()

async function main(): Promise<void> {
  const lines = await db.line.findMany({
    where: { entry: { statut: 'validee' } },
    include: { account: true, entry: true },
  })
  const balance = computeBalance(
    lines.map((ligne) => ({
      accountNumero: ligne.account.numero,
      accountLibelle: ligne.account.libelle,
      date: ligne.entry.date,
      journalCode: '',
      entryNumero: ligne.entry.numero ?? 0,
      entryId: ligne.entryId,
      libelle: ligne.libelle,
      debit: ligne.debit,
      credit: ligne.credit,
      lettre: ligne.lettre,
    })),
  )
  const cr = incomeStatement(balance)
  const indicateurs = sig(balance)
  const bilan = balanceSheet(balance)
  const solde = (numero: string): number => balance.find((a) => a.numero === numero)?.solde ?? 0

  console.log('balance carrée :', balanceIsSquare(balance))
  console.log(
    'chiffre d’affaires ',
    formatEuros(-balance.filter((a) => a.numero.startsWith('70')).reduce((t, a) => t + a.solde, 0)),
  )
  console.log('valeur ajoutée     ', formatEuros(indicateurs.valeurAjoutee))
  console.log('EBE                ', formatEuros(indicateurs.excedentBrutExploitation))
  console.log('résultat net       ', formatEuros(cr.resultatNet))
  console.log('CAF                ', formatEuros(indicateurs.capaciteAutofinancement))
  console.log('bilan — écart      ', formatEuros(bilan.ecart))
  console.log('banque             ', formatEuros(solde('512000')))
  console.log('clients            ', formatEuros(solde('411000')))
  console.log('fournisseurs       ', formatEuros(solde('401000')))
  console.log('TVA collectée      ', formatEuros(-solde('445711')))
  console.log('TVA déductible     ', formatEuros(solde('445660') + solde('445620')))
}

main()
  .catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => void db.$disconnect())
