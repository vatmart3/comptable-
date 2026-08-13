import { useEffect, useMemo, useRef, useState } from 'react'
import { demo, plans, sim } from '../config/site'
import { computeProfile, type SimInput } from '../lib/simulator'
import { euro, folio as pad, number } from '../lib/format'
import { useLedger, useLedgerEntry } from '../lib/ledger'
import { Amount } from './Amount'
import { Odometer } from './Odometer'
import { Section } from './Section'

/* §03 — Engagement et cohérence, effet IKEA, réciprocité, personnalisation.
 *
 * Cinq questions posées comme un questionnaire d'ouverture de dossier. Pas de
 * barre de progression : les réponses déjà données s'écrivent au-dessus, et le
 * dossier se remplit sous les yeux du visiteur. La première question est
 * volontairement triviale — c'est le premier micro-engagement.
 *
 * Aucune coordonnée n'est demandée avant le résultat. Le refus de donner son
 * e-mail après coup ne retire rien : le résultat reste affiché.
 */

type Answers = Partial<Record<keyof SimInput, string>>

const LETTERS = ['A', 'B', 'C', 'D', 'E']

export function SectionSim() {
  const { adopt, post, personalized } = useLedger()
  const ref = useLedgerEntry<HTMLDivElement>('credit-time')

  const [step, setStep] = useState(-1) // -1 : dossier fermé
  const [answers, setAnswers] = useState<Answers>({})
  const [capture, setCapture] = useState<'idle' | 'sent' | 'declined'>('idle')
  const [email, setEmail] = useState('')
  const headingRef = useRef<HTMLParagraphElement>(null)

  const done = step >= sim.questions.length
  const complete = sim.questions.every((q) => answers[q.id])

  const profile = useMemo(
    () => (complete ? computeProfile(answers as unknown as SimInput, plans) : null),
    [complete, answers],
  )

  /* Le résultat n'est pas seulement affiché : il devient la référence du grand
     livre. À partir d'ici, le rail parle de lui, plus de nous. */
  useEffect(() => {
    if (done && profile) {
      adopt(profile)
      post('credit-time')
    }
  }, [done, profile, adopt, post])

  /* Le focus suit la progression, sinon la navigation au clavier reste bloquée
     sur le bouton qu'on vient de quitter. */
  useEffect(() => {
    if (step >= 0) headingRef.current?.focus()
  }, [step])

  const choose = (key: keyof SimInput, value: string) => {
    setAnswers((a) => ({ ...a, [key]: value }))
    setStep((s) => s + 1)
  }

  const reset = () => {
    setAnswers({})
    setStep(0)
    setCapture('idle')
    setEmail('')
  }

  const q = step >= 0 && !done ? sim.questions[step] : null

  return (
    <Section id="simulation" folio={sim.folio} title={sim.title} intro={sim.intro}>
      <div ref={ref} className="border border-ink bg-paper-hi">
        {/* En-tête du dossier */}
        <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-ink px-5 py-3 sm:px-8">
          <span className="eyebrow">
            {done ? sim.result.eyebrow : 'Ouverture de dossier'}
          </span>
          <span className="folio text-ink/65">
            {done
              ? `${pad(sim.questions.length)} / ${pad(sim.questions.length)}`
              : `${pad(Math.max(step, 0) + 1)} ${sim.of} ${pad(sim.questions.length)}`}
          </span>
        </div>

        {/* Réponses déjà écrites : le dossier se remplit. */}
        {step >= 0 && (
          <dl className="px-5 sm:px-8">
            {sim.questions.map((question) => {
              const value = answers[question.id]
              if (!value) return null
              const label = question.options.find((o) => o.value === value)?.label
              return (
                <div
                  key={question.id}
                  className="flex items-baseline justify-between gap-4 border-b border-rule py-2"
                >
                  <dt className="eyebrow text-ink/65">{question.short}</dt>
                  <dd className="num text-right text-[0.8125rem]">{label}</dd>
                </div>
              )
            })}
          </dl>
        )}

        <div className="px-5 py-8 sm:px-8 sm:py-10">
          {/* ── Dossier fermé ──────────────────────────────────────────── */}
          {step === -1 && (
            <div className="flex flex-col items-start gap-6">
              <p className="prose-line text-ink/75">
                Cinq questions, environ quarante secondes. Le résultat s’affiche sans que vous ayez
                à laisser quoi que ce soit.
              </p>
              <button type="button" className="btn" onClick={() => setStep(0)}>
                {sim.start}
              </button>
            </div>
          )}

          {/* ── Question courante ──────────────────────────────────────── */}
          {q && (
            <div key={q.id} style={{ animation: 'ledger-in 420ms var(--ease-ledger) both' }}>
              <p
                ref={headingRef}
                tabIndex={-1}
                className="display-md max-w-[24ch] outline-none"
                id={`q-${q.id}`}
              >
                {q.title}
              </p>
              <p className="eyebrow mt-3 text-ink/65">{q.hint}</p>

              <div role="group" aria-labelledby={`q-${q.id}`} className="mt-7">
                {q.options.map((o, i) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => choose(q.id, o.value)}
                    className="group flex w-full cursor-pointer items-baseline gap-4 border-b border-rule py-3.5 text-left transition-colors hover:bg-paper"
                  >
                    {/* Repère de lecture, pas un contenu : sans `aria-hidden`,
                        un lecteur d'écran annonce « D SARL ». */}
                    <span
                      aria-hidden
                      className="folio w-4 shrink-0 text-ink/40 group-hover:text-stamp"
                    >
                      {LETTERS[i]}
                    </span>
                    <span className="flex-1">{o.label}</span>
                    <span
                      aria-hidden
                      className="eyebrow text-ink/0 transition-colors group-hover:text-stamp"
                    >
                      inscrire
                    </span>
                  </button>
                ))}
              </div>

              {step > 0 && (
                <button
                  type="button"
                  onClick={() => setStep((s) => s - 1)}
                  className="eyebrow mt-6 cursor-pointer text-ink/65 underline-offset-4 hover:text-ink hover:underline"
                >
                  ← {sim.back}
                </button>
              )}
            </div>
          )}

          {/* ── Résultat ───────────────────────────────────────────────── */}
          {done && profile && (
            <div aria-live="polite">
              <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_20rem]">
                <div>
                  <h3 className="display-lg max-w-[18ch]">
                    {sim.result.verdicts[profile.verdict].title}
                  </h3>
                  <p className="prose-line mt-4 text-ink/75">
                    {sim.result.verdicts[profile.verdict].body}
                  </p>

                  {/* Le détail, en écritures. */}
                  <dl className="mt-9">
                    <div className="flex items-baseline justify-between gap-4 border-t border-ink py-3">
                      <dt className="display-sm">{sim.result.costLabel}</dt>
                      <dd>
                        <Amount value={profile.costTotal} side="debit" className="text-lg" />
                      </dd>
                    </div>

                    <p className="eyebrow py-3 text-ink/65">{sim.result.recoverableLabel}</p>
                    {profile.recoverable.map((r) => (
                      <div
                        key={r.label}
                        className="flex items-baseline justify-between gap-4 border-b border-rule py-2.5"
                        data-cursor={`${euro(r.amount)} — au crédit`}
                      >
                        <dt className="text-[0.9375rem] text-ink/80">{r.label}</dt>
                        <dd>
                          <Amount value={r.amount} side="credit" />
                        </dd>
                      </div>
                    ))}

                    <div className="flex items-baseline justify-between gap-4 border-b border-rule py-2.5">
                      <dt className="text-[0.9375rem] text-ink/80">
                        {sim.result.feesLabel} — {profile.plan.name}
                      </dt>
                      <dd>
                        <Amount value={profile.fees} side="debit" />
                      </dd>
                    </div>
                  </dl>
                </div>

                {/* Le solde, en gros, avec les heures juste dessous : sur ce
                    métier, les heures pèsent autant que l'euro. */}
                <div className="lg:border-l lg:border-rule lg:pl-8">
                  <p className="label">{sim.result.soldeLabel}</p>
                  <p
                    className={`display-lg mt-2 ${profile.solde < 0 ? 'text-debit' : ''}`}
                    data-cursor={`Solde annuel estimé — ${euro(profile.solde)}`}
                  >
                    <Odometer value={profile.solde} signed />
                  </p>

                  <p className="label mt-8">{sim.result.hoursLabel}</p>
                  <p className="display-lg mt-2 num">{number(profile.hoursReturned)} h</p>

                  <p className="eyebrow mt-8 text-ink/65">{sim.result.ledgerNote}</p>

                  <a href="#rendez-vous" className="btn mt-6 w-full justify-center">
                    Prendre rendez-vous
                  </a>
                  <button
                    type="button"
                    onClick={reset}
                    className="eyebrow mt-4 w-full cursor-pointer text-center text-ink/65 underline-offset-4 hover:text-ink hover:underline"
                  >
                    {sim.restart}
                  </button>
                </div>
              </div>

              {/* Hypothèses : ouvertes d'un clic, jamais cachées. */}
              <details className="mt-10 border-t border-rule pt-4">
                <summary className="eyebrow cursor-pointer text-ink/65 hover:text-ink">
                  {sim.result.assumptionsLabel}
                </summary>
                <ul className="mt-4 space-y-2">
                  {profile.assumptions.map((a) => (
                    <li key={a} className="prose-line text-[0.875rem] text-ink/65">
                      — {a}
                    </li>
                  ))}
                </ul>
              </details>

              {/* Capture, après le résultat, jamais avant. Et refusable. */}
              <div className="mt-8 border-t border-ink pt-6">
                {capture === 'idle' && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault()
                      setCapture('sent')
                    }}
                    className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto] md:items-end"
                  >
                    <div>
                      <p className="display-sm">{sim.capture.title}</p>
                      <p className="prose-line mt-2 text-[0.9375rem] text-ink/70">
                        {sim.capture.body}
                      </p>
                      <label htmlFor="sim-email" className="label mt-5 block">
                        {sim.capture.label}
                      </label>
                      <input
                        id="sim-email"
                        type="email"
                        required
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="field mt-2 max-w-md"
                        placeholder="vous@votre-entreprise.fr"
                      />
                    </div>
                    <div className="flex flex-col gap-3">
                      <button type="submit" className="btn justify-center">
                        {sim.capture.submit}
                      </button>
                      <button
                        type="button"
                        onClick={() => setCapture('declined')}
                        className="eyebrow cursor-pointer text-ink/65 underline-offset-4 hover:text-ink hover:underline"
                      >
                        {sim.capture.decline}
                      </button>
                    </div>
                  </form>
                )}

                {capture === 'sent' && (
                  <p className="display-sm" role="status">
                    {sim.capture.done}
                    {demo && (
                      <span className="eyebrow mt-2 block text-ink/65">
                        Démonstration : aucun e-mail n’est envoyé, aucune adresse n’est conservée.
                      </span>
                    )}
                  </p>
                )}

                {capture === 'declined' && (
                  <p className="prose-line text-ink/70" role="status">
                    {sim.capture.declined}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {personalized && (
        <p className="eyebrow mt-4 text-ink/65">
          Les montants du §01 et du grand livre ont été remplacés par les vôtres.
        </p>
      )}
    </Section>
  )
}
