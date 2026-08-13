import { plans, pricing, pricingFootnotes } from '../config/site'
import { euro } from '../lib/format'
import { useLedger, useLedgerEntry } from '../lib/ledger'
import { Amount } from './Amount'
import { Section } from './Section'

/* §06 — Ancrage, effet de leurre, fluence.
 *
 * La formule la plus complète ouvre la liste : elle fixe le haut de l'échelle.
 * Conformité ferme la liste et dit franchement ce qu'elle ne contient pas —
 * c'est ce qui rend Pilotage évident, pour 70 € d'écart. Prix mensuels lisibles
 * d'un coup d'œil, sans astérisque et sans « à partir de » : un prix qu'on lit
 * sans effort est perçu comme honnête, et il l'est.
 */

export function SectionPricing() {
  const { profile } = useLedger()
  const ref = useLedgerEntry<HTMLDivElement>('debit-fees')

  return (
    <Section id="honoraires" folio={pricing.folio} title={pricing.title} intro={pricing.intro}>
      <div ref={ref}>
        {plans.map((p) => (
          <div
            key={p.id}
            className={`border-t border-ink ${p.highlight ? 'bg-paper-hi' : ''}`}
          >
            <div
              className={`grid grid-cols-1 gap-x-10 gap-y-6 py-8 lg:grid-cols-[1fr_17rem] ${
                p.highlight ? 'border-l-2 border-l-stamp pl-5 lg:pl-8' : ''
              }`}
            >
              <div>
                {p.highlight && <p className="eyebrow text-stamp">{pricing.recommended}</p>}
                <h3 className={`display-lg ${p.highlight ? 'mt-2' : ''}`}>{p.name}</h3>
                <p className="lede mt-2 text-ink/75">{p.tagline}</p>
                <p className="eyebrow mt-3 text-ink/65">{p.audience}</p>

                <ul className="mt-6">
                  {p.includes.map((inc) => (
                    <li
                      key={inc}
                      className="flex gap-3 border-b border-rule py-2.5 text-[0.9375rem]"
                    >
                      <span aria-hidden className="mt-2.5 h-px w-3 shrink-0 bg-ink/40" />
                      <span>{inc}</span>
                    </li>
                  ))}
                  {p.excludes?.map((ex) => (
                    <li
                      key={ex}
                      className="flex gap-3 border-b border-rule py-2.5 text-[0.9375rem] text-ink/65"
                    >
                      <span aria-hidden className="mt-2.5 h-px w-3 shrink-0 bg-ink/25" />
                      <span>{ex}</span>
                    </li>
                  ))}
                </ul>

                {p.note && <p className="prose-line mt-5 text-[0.9375rem] text-ink/70">{p.note}</p>}
              </div>

              {/* Le prix, dans la colonne des montants, comme tous les chiffres
                  du site. */}
              <div className="lg:pl-8 lg:text-right" data-cursor={`${euro(p.monthly)} par mois`}>
                {/* `display-xl` débordait de la colonne des montants : le signe
                    euro se faisait couper. Le prix reste le plus gros chiffre de
                    la page, mais dans sa colonne. */}
                <p className="display-lg leading-none">
                  <span className="num">{euro(p.monthly)}</span>
                </p>
                <p className="eyebrow mt-2 text-ink/65">par mois, hors taxes</p>
                <p className="num mt-3 text-[0.8125rem] text-ink/65">
                  soit {euro(p.monthly * 12)} par an
                </p>
                <a
                  href="#rendez-vous"
                  className={`btn mt-6 w-full justify-center whitespace-nowrap px-4 ${p.highlight ? '' : 'lg:w-auto'}`}
                >
                  {pricing.cta}
                </a>
              </div>
            </div>
          </div>
        ))}

        {/* L'écriture : les honoraires passent au débit. On ne les met pas à
            côté du calcul, on les met dedans. */}
        <div
          className="flex flex-col gap-2 border-t border-ink pt-5 sm:flex-row sm:items-baseline sm:justify-between"
          data-cursor={`${euro(profile.fees)} — au débit`}
        >
          <p className="display-md max-w-[34ch]">
            Honoraires — {profile.plan.name}, portés au débit de votre exercice
          </p>
          <Amount value={profile.fees} side="debit" className="display-md" />
        </div>
        <p className="eyebrow mt-2 text-ink/65">
          Le solde du grand livre est calculé honoraires déduits. C’est la seule façon de le lire.
        </p>

        <ul className="mt-10 space-y-1.5">
          {pricingFootnotes.map((f) => (
            <li key={f} className="text-[0.875rem] text-ink/65">
              {f}
            </li>
          ))}
        </ul>
      </div>
    </Section>
  )
}
