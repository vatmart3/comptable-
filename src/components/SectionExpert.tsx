import { expert } from '../config/site'
import { euro } from '../lib/format'
import { useLedger, useLedgerEntry } from '../lib/ledger'
import { Amount } from './Amount'
import { Section } from './Section'

/* §04 — Autorité vérifiable, et unité.
   L'autorité ne vient pas d'un adjectif : elle vient d'un numéro d'inscription
   au tableau de l'Ordre, qui se vérifie en ligne. L'unité vient des communes
   nommées une par une — on est d'ici, ou on ne l'est pas. */

/**
 * La fiche d'inscription au tableau.
 *
 * Fond encre, trame de similigravure obtenue en CSS — un point tous les 7 px,
 * dégradé par un masque. Aucun fichier image : la texture ne pèse rien et reste
 * nette à n'importe quelle densité d'écran.
 */
function IdentityPlate() {
  return (
    <div className="relative aspect-[4/5] w-full overflow-hidden bg-ink text-paper">
      {/* Trame */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage: 'radial-gradient(circle, var(--color-paper) 0.9px, transparent 1px)',
          backgroundSize: '7px 7px',
          maskImage: 'linear-gradient(215deg, transparent 34%, black 100%)',
          WebkitMaskImage: 'linear-gradient(215deg, transparent 34%, black 100%)',
        }}
      />

      <div className="relative flex h-full flex-col justify-between p-6 sm:p-8">
        <div>
          <p className="eyebrow text-paper/60">Tableau de l’Ordre</p>
          <p className="eyebrow mt-1 text-paper/60">Conseil régional d’Occitanie</p>
        </div>

        {/* Le nom seul : la fonction est déjà donnée par le titre de la colonne
            de droite, la répéter ici ferait doublon à l'écran. */}
        <p className="display-lg">{expert.person.name}</p>

        <dl className="space-y-0">
          {[
            ['Inscription', expert.person.number.replace('n° ', '')],
            ['Depuis', expert.person.since.replace(/\D+/, '')],
            ['Diplôme', 'DEC'],
          ].map(([k, v]) => (
            <div
              key={k}
              className="flex items-baseline justify-between gap-4 border-t border-rule-ink py-2"
            >
              <dt className="eyebrow text-paper/55">{k}</dt>
              <dd className="num text-[0.8125rem]">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}

export function SectionExpert() {
  const { profile } = useLedger()
  const ref = useLedgerEntry<HTMLDivElement>('credit-penalties')

  return (
    <Section id="cabinet" folio={expert.folio} title={expert.title}>
      <div ref={ref} className="grid grid-cols-1 gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,24rem)_1fr]">
        {/* Plein cadre, format 4/5, traité en niveaux d'encre. Pas de vignette
            ronde, pas d'ombre portée : une pièce d'identification.

            Avec une vraie photographie (`expert.person.portrait`), c'est elle
            qui occupe le cadre. Sans photographie — le cas ici — le cadre porte
            la fiche d'inscription au tableau, composée dans la typographie du
            site. Dans les deux cas, même cadre, mêmes repères d'impression. */}
        <figure className="lg:sticky lg:top-20 lg:self-start">
          <div
            className="relative border border-ink"
            data-surface={expert.person.portrait ? undefined : 'ink'}
          >
            {expert.person.portrait ? (
              <img
                src={expert.person.portrait}
                alt={expert.person.portraitAlt}
                width={720}
                height={900}
                loading="lazy"
                decoding="async"
                className="aspect-[4/5] w-full bg-paper-hi object-cover [filter:grayscale(1)_contrast(1.08)]"
              />
            ) : (
              <IdentityPlate />
            )}
            {/* Repères d'impression : deux marques d'angle, comme sur une
                épreuve. C'est le seul ornement du site. */}
            <span aria-hidden className="absolute left-0 top-0 h-4 w-4 border-l border-t border-ink" />
            <span aria-hidden className="absolute bottom-0 right-0 h-4 w-4 border-b border-r border-ink" />
          </div>
          <figcaption className="mt-3 flex items-baseline justify-between gap-3">
            <span className="eyebrow">{expert.person.name}</span>
            <span className="folio text-ink/65">{expert.person.number}</span>
          </figcaption>
        </figure>

        <div>
          <h3 className="display-lg">{expert.person.name}</h3>
          <p className="lede mt-2 text-ink/75">{expert.person.role}</p>

          <dl className="mt-8">
            <div className="flex flex-col gap-1 border-t border-ink py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
              <dt className="max-w-[46ch] text-[0.9375rem] text-ink/80">
                {expert.person.registration}
              </dt>
              <dd className="num shrink-0 text-[0.9375rem]">{expert.person.number}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-6 border-b border-rule py-3">
              <dt className="text-[0.9375rem] text-ink/80">Année d’inscription</dt>
              <dd className="num text-[0.9375rem]">{expert.person.since.replace(/\D+/, '')}</dd>
            </div>
            <div className="flex flex-col gap-1 border-b border-rule py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
              <dt className="text-[0.9375rem] text-ink/80">
                {expert.partner.name} — {expert.partner.role}
              </dt>
              <dd className="num shrink-0 text-[0.9375rem]">{expert.partner.number}</dd>
            </div>
          </dl>

          <p className="prose-line mt-6 text-ink/75">{expert.statement}</p>
          <p className="eyebrow mt-3 text-ink/65">{expert.verifyLabel}</p>

          <div className="mt-12 grid grid-cols-1 gap-10 sm:grid-cols-2">
            <div>
              <h4 className="eyebrow text-ink/65">{expert.fieldsTitle}</h4>
              <ul className="mt-4">
                {expert.fields.map((f) => (
                  <li key={f} className="border-b border-rule py-2 text-[0.9375rem]">
                    {f}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="eyebrow text-ink/65">{expert.areaTitle}</h4>
              <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1">
                {expert.towns.map((t) => (
                  <li key={t} className="num text-[0.8125rem] text-ink/80">
                    {t}
                  </li>
                ))}
              </ul>
              <p className="prose-line mt-4 text-[0.875rem] text-ink/65">{expert.areaNote}</p>
            </div>
          </div>

          {/* L'écriture de la section : la régularité déclarative a une valeur,
              et elle se chiffre. */}
          <div
            className="mt-12 flex flex-col gap-2 border-t border-ink pt-5 sm:flex-row sm:items-baseline sm:justify-between"
            data-cursor={`${euro(profile.creditPenalties)} — au crédit`}
          >
            <p className="display-md max-w-[28ch]">
              Majorations et intérêts de retard, portés au crédit
            </p>
            <Amount value={profile.creditPenalties} side="credit" className="display-md" />
          </div>
          <p className="eyebrow mt-2 text-ink/65">
            Un calendrier déclaratif tenu par le cabinet, pas par vous.
          </p>
        </div>
      </div>
    </Section>
  )
}
