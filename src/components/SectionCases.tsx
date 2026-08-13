import { cases, demo } from '../config/site'
import { euro } from '../lib/format'
import { useLedger, useLedgerEntry } from '../lib/ledger'
import { Amount } from './Amount'
import { Section } from './Section'

/* §05 — Preuve sociale contextualisée.
   Pas de carrousel, pas de guillemets, pas d'avatar rond : un restaurateur de
   six salariés se reconnaît dans un restaurateur de six salariés, jamais dans
   « nos clients sont satisfaits ». Chaque dossier est présenté dans l'ordre
   d'une écriture : situation d'entrée, intervention, résultat. */

const STEPS = ['Situation d’entrée', 'Intervention', 'Résultat'] as const

export function SectionCases() {
  const { profile } = useLedger()
  const ref = useLedgerEntry<HTMLDivElement>('credit-deductions')

  return (
    <Section id="dossiers" folio={cases.folio} title={cases.title} intro={cases.intro}>
      <div ref={ref}>
        {cases.items.map((c) => (
          <article key={c.sector + c.town} className="border-t border-ink py-8">
            {/* L'en-tête identifie le confrère de secteur, pas le cabinet. */}
            <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h3 className="display-md">{c.sector}</h3>
              <span aria-hidden className="text-ink/30">
                ·
              </span>
              <span className="num text-[0.8125rem] text-ink/70">{c.town}</span>
              <span aria-hidden className="text-ink/30">
                ·
              </span>
              <span className="num text-[0.8125rem] text-ink/70">{c.size}</span>
            </header>

            <div className="mt-6 grid grid-cols-1 gap-x-10 gap-y-6 lg:grid-cols-[1fr_auto]">
              <dl>
                {[c.entry, c.action, c.result].map((text, i) => (
                  <div
                    key={STEPS[i]}
                    className="grid grid-cols-1 gap-x-6 border-b border-rule py-3 sm:grid-cols-[10rem_1fr]"
                  >
                    <dt className="eyebrow text-ink/65">{STEPS[i]}</dt>
                    <dd className="prose-line text-[0.9375rem] text-ink/85">{text}</dd>
                  </div>
                ))}
                <p className="eyebrow mt-3 text-ink/65">{c.since}</p>
              </dl>

              <div
                className="flex flex-row items-baseline justify-between gap-4 border-t border-ink pt-4 lg:w-56 lg:flex-col lg:items-end lg:justify-start lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0"
                data-cursor={`${c.metric.label} — ${euro(c.metric.value)}`}
              >
                <span className="label lg:text-right">{c.metric.label}</span>
                <Amount value={c.metric.value} side="credit" className="display-lg lg:mt-2" />
              </div>
            </div>
          </article>
        ))}

        {/* L'écriture de la section. */}
        <div
          className="flex flex-col gap-2 border-t border-ink pt-5 sm:flex-row sm:items-baseline sm:justify-between"
          data-cursor={`${euro(profile.creditDeductions)} — au crédit`}
        >
          <p className="display-md max-w-[30ch]">Déductions récupérées sur votre exercice</p>
          <Amount value={profile.creditDeductions} side="credit" className="display-md" />
        </div>

        {demo && <p className="eyebrow mt-8 text-ink/65">{cases.disclaimer}</p>}
      </div>
    </Section>
  )
}
