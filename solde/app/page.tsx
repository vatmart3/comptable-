import { formatAmount, formatEuros } from '@/lib/accounting/money'
import { totals } from '@/lib/accounting/entry'
import { fromInclusive, TAUX } from '@/lib/accounting/vat'
import { PCG } from '@/prisma/data/pcg'

/**
 * Phase 0 — Le spécimen.
 *
 * Cet écran n'est pas une page d'accueil : c'est la direction artistique
 * rendue vérifiable. Palette, échelle typographique, chiffres tabulaires,
 * rayons, filets. Il sera remplacé par « Le Souffle » en Phase 1.
 */

const PALETTE = [
  { nom: 'papier', valeur: '#F7F5F1', role: 'fond principal', classe: 'bg-papier' },
  { nom: 'papier-creux', valeur: '#EFEDE7', role: 'surfaces enfoncées', classe: 'bg-papier-creux' },
  { nom: 'encre', valeur: '#16150F', role: 'texte principal', classe: 'bg-encre' },
  { nom: 'encre-douce', valeur: '#6E6A5F', role: 'texte secondaire', classe: 'bg-encre-douce' },
  { nom: 'trait', valeur: '#E2DFD6', role: 'filets 1px', classe: 'bg-trait' },
  { nom: 'accent', valeur: '#0071E3', role: 'action, focus, crédit', classe: 'bg-accent' },
  { nom: 'graphite', valeur: '#3A3A38', role: 'débit', classe: 'bg-graphite' },
  { nom: 'terre', valeur: '#C4553B', role: 'alerte, déséquilibre', classe: 'bg-terre' },
  { nom: 'vert-sourd', valeur: '#4A6B54', role: 'validé, équilibré, lettré', classe: 'bg-vert-sourd' },
] as const

// « payé 240 € gasoil Total CB hier » — l'écriture que La Ligne produira.
const GASOIL = fromInclusive(24_000, TAUX.NORMAL)
const ECRITURE = [
  { compte: '606100', libelle: 'Carburant — Total', debit: GASOIL.ht, credit: 0 },
  { compte: '445660', libelle: 'TVA déductible 20 %', debit: GASOIL.tva, credit: 0 },
  { compte: '512000', libelle: 'Banque — carte bancaire', debit: 0, credit: GASOIL.ttc },
]

export default function Specimen() {
  const { debit, credit, ecart } = totals(ECRITURE)
  const equilibree = ecart === 0

  return (
    <main className="mx-auto max-w-[76ch] px-6 py-24 sm:px-10">
      <header className="mb-24">
        <p className="surtitre">Phase 0 — spécimen</p>
        <h1 className="mt-6 text-[clamp(56px,11vw,96px)] leading-[0.92] font-medium tracking-[-0.03em]">
          SOLDE
        </h1>
        <p className="mt-6 max-w-[42ch] text-[19px] leading-[1.5] text-encre-douce">
          La comptabilité qui se tient droite. Moteur comptable, registre chaîné,
          plan comptable général. Cette page montre le système visuel avant que
          les écrans ne l’habitent.
        </p>
      </header>

      <Section titre="Palette">
        <ul className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
          {PALETTE.map((teinte) => (
            <li key={teinte.nom} className="flex items-center gap-4">
              <span
                aria-hidden
                className={`${teinte.classe} size-9 shrink-0 rounded-[10px] border border-trait`}
              />
              <span className="min-w-0">
                <span className="block text-[15px] leading-tight">{teinte.role}</span>
                <span className="chiffre block text-[12px] leading-tight text-encre-douce">
                  {teinte.valeur}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <Section titre="Chiffres">
        <p className="mb-6 max-w-[52ch] text-[15px] leading-[1.6] text-encre-douce">
          Tous les montants sont en chiffres tabulaires. Les colonnes s’alignent
          au pixel, quelle que soit la valeur — c’est ce qui rend une balance
          lisible d’un coup d’œil.
        </p>
        <div className="carte">
          <table className="w-full">
            <caption className="surtitre mb-5 text-left">
              Achat de carburant — 240,00 € TTC
            </caption>
            <thead>
              <tr className="border-b border-trait">
                <th scope="col" className="surtitre pb-3 text-left font-normal">Compte</th>
                <th scope="col" className="surtitre pb-3 text-left font-normal">Libellé</th>
                <th scope="col" className="surtitre pb-3 text-right font-normal">Débit</th>
                <th scope="col" className="surtitre pb-3 text-right font-normal">Crédit</th>
              </tr>
            </thead>
            <tbody>
              {ECRITURE.map((ligne) => (
                <tr key={ligne.compte} className="border-b border-trait/60 last:border-0">
                  <td className="chiffre py-3 text-[14px]">{ligne.compte}</td>
                  <td className="py-3 pr-4 text-[14px]">{ligne.libelle}</td>
                  <td className="chiffre py-3 text-right text-[14px] text-graphite">
                    {ligne.debit === 0 ? '—' : formatAmount(ligne.debit)}
                  </td>
                  <td className="chiffre py-3 text-right text-[14px] text-accent">
                    {ligne.credit === 0 ? '—' : formatAmount(ligne.credit)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-encre/15">
                <td colSpan={2} className="pt-4 text-[13px] text-encre-douce">
                  {equilibree ? 'Équilibrée' : 'Déséquilibrée'}
                </td>
                <td className="chiffre pt-4 text-right text-[14px] font-medium">
                  {formatAmount(debit)}
                </td>
                <td className="chiffre pt-4 text-right text-[14px] font-medium">
                  {formatAmount(credit)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="mt-8 flex flex-wrap items-baseline gap-x-8 gap-y-4">
          <p className="chiffre text-[clamp(44px,9vw,72px)] leading-none font-medium tracking-[-0.02em]">
            {formatEuros(ecart)}
          </p>
          <p
            className="text-[15px]"
            style={{ color: equilibree ? 'var(--c-vert-sourd)' : 'var(--c-terre)' }}
          >
            {equilibree
              ? 'écart nul — la balance se stabilise, la validation s’ouvre'
              : 'la balance penche, la validation reste fermée'}
          </p>
        </div>
      </Section>

      <Section titre="Formes">
        <div className="flex flex-wrap gap-4">
          <Forme rayon="28px" nom="carte" />
          <Forme rayon="16px" nom="champ" />
          <Forme rayon="999px" nom="pill" />
        </div>
        <p className="mt-6 max-w-[52ch] text-[15px] leading-[1.6] text-encre-douce">
          Aucune ombre portée : une surface se détache par un filet d’un pixel ou
          par un fond légèrement décalé. La grille est sur 4 px, le padding
          intérieur d’une carte ne descend jamais sous 24 px.
        </p>
      </Section>

      <Section titre="Plan comptable">
        <p className="max-w-[52ch] text-[15px] leading-[1.6] text-encre-douce">
          <span className="chiffre text-encre">{PCG.length}</span> comptes du Plan
          Comptable Général sont préchargés, des classes 1 à 8, avec leur sens
          naturel, leur caractère lettrable et, pour les comptes concernés, le
          taux de TVA attendu.
        </p>
      </Section>

      <footer className="mt-24 border-t border-trait pt-8">
        <p className="surtitre">Prochaine phase</p>
        <p className="mt-4 max-w-[52ch] text-[15px] leading-[1.6] text-encre-douce">
          Phase 1 — La Ligne et La Balance : saisie en langage naturel, chips
          éditables au clavier, balance 3D qui penche en temps réel.
        </p>
      </footer>
    </main>
  )
}

function Section({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <section className="mb-20">
      <h2 className="surtitre mb-6">{titre}</h2>
      {children}
    </section>
  )
}

function Forme({ rayon, nom }: { rayon: string; nom: string }) {
  return (
    <div className="flex flex-col gap-2">
      <div
        aria-hidden
        className="size-24 border border-trait bg-papier-creux"
        style={{ borderRadius: rayon }}
      />
      <p className="chiffre text-[12px] text-encre-douce">
        {nom} · {rayon}
      </p>
    </div>
  )
}
