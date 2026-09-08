import Link from 'next/link'
import { contexteCourant } from '@/lib/server/context'
import { listerEcritures } from '@/lib/server/entries'
import { db } from '@/lib/db'
import { can } from '@/lib/accounting/roles'
import { formatAmount } from '@/lib/accounting/money'
import { Saisie } from '@/components/saisie/Saisie'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Saisie — SOLDE' }

export default async function PageSaisie() {
  const contexte = await contexteCourant()

  const [comptes, tiers, journaux, recentes] = await Promise.all([
    db.account.findMany({
      where: { companyId: contexte.companyId, actif: true },
      select: { numero: true, libelle: true, tauxTvaAttendu: true },
      orderBy: { numero: 'asc' },
    }),
    db.partner.findMany({
      where: { companyId: contexte.companyId, actif: true },
      select: { code: true, nom: true, type: true },
      orderBy: { nom: 'asc' },
    }),
    db.journal.findMany({
      where: { companyId: contexte.companyId, actif: true },
      select: { code: true, libelle: true, type: true },
      orderBy: { code: 'asc' },
    }),
    listerEcritures(contexte, { limite: 8 }),
  ])

  return (
    <main>
      <Saisie
        comptes={comptes.map((compte) => ({
          numero: compte.numero,
          libelle: compte.libelle,
          tauxTvaAttendu: compte.tauxTvaAttendu,
        }))}
        tiers={tiers}
        journaux={journaux}
        exercice={{
          debut: contexte.exercice.dateDebut.toISOString().slice(0, 10),
          fin: contexte.exercice.dateFin.toISOString().slice(0, 10),
          libelle: `${contexte.companyNom} · ${contexte.exercice.dateDebut.getUTCFullYear()}`,
        }}
        peutValider={can(contexte.acteur.role, 'entry.validate')}
      />

      <section
        aria-label="Dernières écritures"
        className="mx-auto w-full max-w-[92ch] border-t border-trait px-6 py-12 sm:px-10"
      >
        <p className="surtitre mb-6">Dernières écritures</p>

        {recentes.length === 0 ? (
          <p className="max-w-[46ch] text-[15px] leading-[1.6] text-encre-douce">
            Le journal est vide. La première écriture que vous validerez ouvrira
            la chaîne — son maillon partira du hash de genèse.
          </p>
        ) : (
          <ul className="flex flex-col">
            {recentes.map((ecriture) => (
              <li
                key={ecriture.id}
                className="flex items-baseline justify-between gap-4 border-b border-trait/60 py-3 last:border-0"
              >
                <span className="flex min-w-0 items-baseline gap-4">
                  <span className="chiffre shrink-0 text-[13px] text-encre-douce">
                    {ecriture.numero == null
                      ? `${ecriture.journalCode} · brouillon`
                      : `${ecriture.journalCode}-${String(ecriture.numero).padStart(4, '0')}`}
                  </span>
                  <span className="truncate text-[14px]">{ecriture.libelle}</span>
                </span>
                <span className="flex shrink-0 items-baseline gap-5">
                  <span className="chiffre text-[13px] text-encre-douce">
                    {ecriture.date.toLocaleDateString('fr-FR', { timeZone: 'UTC' })}
                  </span>
                  <span className="chiffre text-[14px]">{formatAmount(ecriture.total)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-8 text-[13px] text-encre-douce">
          Le grand livre complet — Le Fil — arrive en Phase 2.{' '}
          <Link href="/" className="underline underline-offset-4">
            Voir le spécimen
          </Link>
        </p>
      </section>
    </main>
  )
}
