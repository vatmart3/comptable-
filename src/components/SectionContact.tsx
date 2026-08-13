import { useState } from 'react'
import { contact, demo, identity } from '../config/site'
import { useLedger } from '../lib/ledger'
import { Section } from './Section'

/* §08 — Réduction du risque perçu, rareté honnête, bouclage de la boucle.
 *
 * Trois champs. Les trois signaux de réduction du risque sont à côté du bouton,
 * en taille lisible — pas en note de bas de page.
 *
 * À l'envoi, le grand livre solde sa dernière écriture : la ligne en pointillés
 * se remplit, le solde bascule, le trait de clôture se trace. Le document était
 * inachevé depuis le début de la page ; il vient de se refermer.
 */

export function SectionContact() {
  const { settle, settled } = useLedger()
  const [sent, setSent] = useState(false)

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    /* Démonstration : rien ne part. Pour brancher un vrai envoi, c'est ici et
       nulle part ailleurs — le formulaire n'appelle aucun service tiers. */
    setSent(true)
    settle()
  }

  return (
    <Section id="rendez-vous" folio={contact.folio} title={contact.title} intro={contact.intro}>
      <div className="grid grid-cols-1 gap-x-12 gap-y-12 lg:grid-cols-[1fr_22rem]">
        <div>
          {sent ? (
            <div role="status" className="border-t border-ink pt-8">
              <p className="display-lg">{contact.success.title}</p>
              <p className="prose-line mt-4 text-ink/75">{contact.success.body}</p>
              {/* Le trait de clôture. */}
              <div
                aria-hidden
                className="rule-close mt-10 w-full origin-left"
                style={{ animation: 'close-rule 900ms var(--ease-ledger) both' }}
              />
              <p className="eyebrow mt-5 text-ink/65">
                Exercice clos. Le grand livre affiche le solde définitif.
              </p>
              {demo && <p className="eyebrow mt-3 text-ink/65">{contact.demoNotice}</p>}
            </div>
          ) : (
            <form onSubmit={onSubmit} className="border-t border-ink pt-8">
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <label htmlFor="rdv-nom" className="label block">
                    {contact.fields.name.label}
                  </label>
                  <input
                    id="rdv-nom"
                    name="nom"
                    type="text"
                    required
                    autoComplete="name"
                    placeholder={contact.fields.name.placeholder}
                    className="field mt-2"
                  />
                </div>

                <div>
                  <label htmlFor="rdv-activite" className="label block">
                    {contact.fields.activity.label}
                  </label>
                  <input
                    id="rdv-activite"
                    name="activite"
                    type="text"
                    required
                    placeholder={contact.fields.activity.placeholder}
                    className="field mt-2"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="rdv-contact" className="label block">
                    {contact.fields.contactLabel}
                  </label>
                  <input
                    id="rdv-contact"
                    name="contact"
                    type="text"
                    required
                    autoComplete="tel"
                    placeholder={contact.fields.contactPlaceholder}
                    className="field mt-2 sm:max-w-sm"
                  />
                </div>
              </div>

              <fieldset className="mt-8">
                <legend className="label">{contact.fields.slot.label}</legend>
                <div className="mt-3">
                  {contact.slots.map((s, i) => (
                    <label
                      key={s}
                      className="flex cursor-pointer items-center gap-3 border-b border-rule py-3 text-[0.9375rem] has-[:checked]:text-ink"
                    >
                      <input
                        type="radio"
                        name="creneau"
                        value={s}
                        defaultChecked={i === 0}
                        className="peer sr-only"
                      />
                      {/* Case dessinée : carrée, comme une case de formulaire
                          administratif. L'état coché n'est pas qu'une couleur,
                          c'est un remplissage — visible en niveaux de gris. */}
                      <span
                        aria-hidden
                        className="h-4 w-4 shrink-0 border border-ink peer-checked:bg-stamp peer-checked:shadow-[inset_0_0_0_3px_var(--color-paper-hi)] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-stamp"
                      />
                      <span>{s}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="mt-9 flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-10">
                <button type="submit" className="btn shrink-0">
                  {contact.submit}
                </button>

                {/* Les trois signaux. À côté du bouton, lisibles. */}
                <ul className="grid flex-1 grid-cols-1 gap-3">
                  {contact.reassurance.map((r) => (
                    <li key={r.label} className="border-b border-rule pb-2">
                      <span className="display-sm block">{r.label}</span>
                      <span className="text-[0.875rem] text-ink/65">{r.body}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <p className="prose-line mt-8 text-[0.875rem] text-ink/65">{contact.privacy}</p>
              {demo && <p className="eyebrow mt-3 text-ink/65">{contact.demoNotice}</p>}
            </form>
          )}
        </div>

        {/* Colonne de droite : joindre le cabinet autrement, et la capacité
            réelle — annoncée comme une règle, jamais comme un décompte. */}
        <aside className="lg:border-l lg:border-rule lg:pl-8">
          <h3 className="eyebrow text-ink/65">Autrement</h3>
          <dl className="mt-4">
            <div className="border-b border-rule py-3">
              <dt className="label">Téléphone</dt>
              <dd className="num mt-1">
                <a href={`tel:${identity.phoneHref}`} className="underline-offset-4 hover:underline">
                  {identity.phone}
                </a>
              </dd>
            </div>
            <div className="border-b border-rule py-3">
              <dt className="label">Adresse</dt>
              <dd className="mt-1 text-[0.9375rem]">
                {identity.address.street}
                <br />
                {identity.address.postalCode} {identity.address.city}
              </dd>
            </div>
            <div className="border-b border-rule py-3">
              <dt className="label">Horaires</dt>
              <dd className="mt-1 text-[0.9375rem]">{identity.hours}</dd>
            </div>
          </dl>

          <p className="prose-line mt-6 text-[0.875rem] text-ink/65">{contact.capacity}</p>

          {settled && (
            <p className="eyebrow mt-6 text-stamp">Écriture du 31/12 soldée.</p>
          )}
        </aside>
      </div>
    </Section>
  )
}
