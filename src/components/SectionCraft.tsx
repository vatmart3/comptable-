import { craft } from '../config/site'
import { euro } from '../lib/format'
import { useLedger, useLedgerEntry } from '../lib/ledger'
import { Amount } from './Amount'
import { Section } from './Section'

/* §02 — Réciprocité informationnelle, et effet Von Restorff.
   C'est la seule section sur fond encre du site : elle rompt la lecture parce
   que c'est ici qu'on donne quelque chose avant de demander quoi que ce soit.
   Deux colonnes opposées — le contraste est l'argument, pas la décoration. */

export function SectionCraft() {
  const { profile } = useLedger()
  const ref = useLedgerEntry<HTMLDivElement>('credit-arbitrage')

  return (
    <Section id="metier" folio={craft.folio} title={craft.title} surface="ink" intro={craft.lead}>
      <div ref={ref} className="grid grid-cols-1 gap-x-12 gap-y-12 lg:grid-cols-[minmax(0,22rem)_1fr]">
        {/* Ce qu'on croit acheter : posé, éteint, sans commentaire. */}
        <div>
          <h3 className="eyebrow text-paper/55">{craft.believedTitle}</h3>
          <ul className="mt-5">
            {craft.believed.map((b) => (
              <li
                key={b}
                className="border-b border-rule-ink py-3 text-paper/55 [text-decoration:line-through] [text-decoration-color:color-mix(in_oklab,var(--color-paper)_35%,transparent)]"
              >
                {b}
              </li>
            ))}
          </ul>
          <p className="eyebrow mt-6 text-paper/55">
            Facturé au même prix partout. C’est un produit, pas un service.
          </p>
        </div>

        {/* Ce qu'on achète : détaillé, chiffré à la fin. */}
        <div>
          <h3 className="eyebrow text-paper">{craft.realTitle}</h3>
          <dl className="mt-5">
            {craft.real.map((r) => (
              <div key={r.label} className="border-b border-rule-ink py-6">
                <dt className="display-md">{r.label}</dt>
                <dd className="prose-line mt-2 text-paper/70">{r.body}</dd>
              </div>
            ))}
          </dl>

          {/* L'écriture au crédit : le premier chiffre positif du site. */}
          <div
            className="mt-8 flex flex-col gap-3 border-b border-paper pb-6 sm:flex-row sm:items-baseline sm:justify-between"
            data-cursor={`${euro(profile.creditArbitrage)} — au crédit`}
          >
            <p className="display-md max-w-[26ch]">
              Arbitrage de rémunération, porté au crédit de votre exercice
            </p>
            <Amount value={profile.creditArbitrage} side="credit" className="display-lg" />
          </div>
          <p className="eyebrow mt-3 text-paper/55">
            Estimation sur le profil de référence. Zéro en micro-entreprise : l’abattement est
            forfaitaire, il n’y a rien à arbitrer.
          </p>

          <p className="prose-line mt-10 text-paper/70">{craft.outro}</p>
        </div>
      </div>
    </Section>
  )
}
