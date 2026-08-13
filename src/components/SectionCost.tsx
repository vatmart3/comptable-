import { cost } from '../config/site'
import { euro } from '../lib/format'
import { useLedger, useLedgerEntry } from '../lib/ledger'
import { Amount } from './Amount'
import { Section } from './Section'

/* §01 — Aversion à la perte.
   On ne vend rien ici. On chiffre ce qui sort déjà. Trois lignes d'écriture,
   pas trois cartes : libellé à gauche, montant à droite, filet entre les deux.
   Chaque ligne franchie s'inscrit au débit du grand livre. */

function CostLine({
  id,
  label,
  body,
  foot,
  amount,
}: {
  id: string
  label: string
  body: string
  foot: string
  amount: number
}) {
  const ref = useLedgerEntry<HTMLDivElement>(id)

  return (
    <div ref={ref} className="rule-t grid grid-cols-1 gap-x-8 py-8 md:grid-cols-[1fr_auto]">
      <div>
        <h3 className="display-md">{label}</h3>
        <p className="prose-line mt-3 text-ink/80">{body}</p>
        <p className="eyebrow mt-4 text-ink/65">{foot}</p>
      </div>

      <div
        className="mt-5 flex items-start md:mt-0 md:justify-end"
        data-cursor={`${euro(amount)} — au débit`}
      >
        <Amount value={amount} side="debit" className="display-lg" />
      </div>
    </div>
  )
}

export function SectionCost() {
  const { profile } = useLedger()

  return (
    <Section
      id="cout"
      folio={cost.folio}
      title={cost.title}
      intro={cost.intro}
      aside={
        <p className="eyebrow max-w-[34ch] text-ink/65 md:text-right">
          Profil de référence
          <span className="mt-1 block normal-case tracking-normal">{cost.reference}</span>
        </p>
      }
    >
      <div>
        {cost.items.map((item) => (
          <CostLine
            key={item.id}
            id={item.id}
            label={item.label}
            body={item.body(profile)}
            foot={item.foot(profile)}
            amount={
              item.id === 'cost-time'
                ? profile.costTime
                : item.id === 'cost-deductions'
                  ? profile.costDeductions
                  : profile.costPenalties
            }
          />
        ))}

        {/* Le total. Filet plus fort : c'est un sous-total de compte. */}
        <div className="grid grid-cols-1 gap-x-8 border-t border-ink py-6 md:grid-cols-[1fr_auto]">
          <p className="display-md max-w-[24ch]">{cost.totalLabel}</p>
          <div
            className="mt-3 flex items-baseline md:mt-0 md:justify-end"
            data-cursor={`${euro(profile.costTotal)} — total au débit`}
          >
            <Amount value={profile.costTotal} side="debit" className="display-lg" />
          </div>
        </div>

        <p className="prose-line mt-8 text-ink/70">{cost.outro}</p>
      </div>
    </Section>
  )
}
