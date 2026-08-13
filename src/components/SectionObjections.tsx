import { objections } from '../config/site'
import { useLedgerEntry } from '../lib/ledger'
import { Amount } from './Amount'
import { Section } from './Section'

/* §07 — Traitement anticipé de l'objection, et réduction de friction.
   Les questions sont écrites telles que le dirigeant les pense, pas telles que
   le cabinet aimerait les entendre. Rien n'est replié derrière un accordéon :
   une objection qu'on doit déplier reste une objection.
   L'écriture de la section vaut 0,00 € — et c'est précisément la réponse. */

export function SectionObjections() {
  const ref = useLedgerEntry<HTMLDivElement>('debit-reprise')

  return (
    <Section
      id="objections"
      folio={objections.folio}
      title={objections.title}
      intro={objections.intro}
    >
      <div ref={ref}>
        <dl>
          {objections.items.map((o) => (
            <div
              key={o.q}
              className="grid grid-cols-1 gap-x-10 gap-y-3 border-t border-ink py-7 lg:grid-cols-[minmax(0,24rem)_1fr]"
            >
              <dt className="display-md text-ink">« {o.q} »</dt>
              <dd className="prose-line text-ink/80">{o.a}</dd>
            </div>
          ))}
        </dl>

        {/* Le coût de la reprise, chiffré à zéro. Une objection qui a un montant
            cesse d'être une inquiétude. */}
        <div
          className="flex flex-col gap-2 border-t border-ink pt-5 sm:flex-row sm:items-baseline sm:justify-between"
          data-cursor="Reprise du dossier — 0 €"
        >
          <p className="display-md max-w-[32ch]">Coût de la reprise de votre dossier en cours d’année</p>
          <Amount value={0} side="debit" className="display-md" />
        </div>
        <p className="eyebrow mt-2 text-ink/65">
          Porté au débit du grand livre pour zéro euro. C’est une ligne, pas une promesse.
        </p>
      </div>
    </Section>
  )
}
