'use client'

/**
 * LA LIGNE — signature § 7.3.
 *
 * Une seule ligne de saisie, plein écran, centrée. On écrit en français,
 * l'analyse tourne à chaque frappe, en local (§ 2 : la saisie doit marcher sans
 * réseau), et le résultat s'affiche en puces éditables. Entrée valide.
 *
 * L'écriture n'est jamais éditée ligne à ligne : les puces éditent le
 * brouillon, et les lignes s'en déduisent. C'est ce qui garantit qu'une
 * écriture sortie d'ici est équilibrée par construction — la balance ne penche
 * que pendant la frappe, tant qu'il manque une information.
 */

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import {
  chercherComptes,
  construireEcriture,
  construireLignes,
  parseLigne,
  type Brouillon,
  type LigneCompte,
  type LigneContexte,
  type LigneTiers,
} from '@/lib/accounting/ligne'
import { formatAmount, parseAmount } from '@/lib/accounting/money'
import { TAUX } from '@/lib/accounting/vat'
import { Balance } from '@/components/balance/Balance'
import { Puce } from './Puce'
import { enregistrerEcriture, type EnregistrerResultat } from '@/app/saisie/actions'

export interface JournalOption {
  readonly code: string
  readonly libelle: string
  readonly type: string
}

export interface SaisieProps {
  readonly comptes: readonly LigneCompte[]
  readonly tiers: readonly LigneTiers[]
  readonly journaux: readonly JournalOption[]
  readonly exercice: { readonly debut: string; readonly fin: string; readonly libelle: string }
  readonly peutValider: boolean
}

const EXEMPLES = [
  'payé 240 € gasoil Total CB hier',
  'encaissé 1 800 € prestation Méridien virement',
  'facture de 96 € Orange abonnement',
  'payé 42,50 € restaurant CB vendredi',
] as const

type Statut = 'repos' | 'envoi' | 'succes' | 'erreur'

export function Saisie({ comptes, tiers, journaux, exercice, peutValider }: SaisieProps) {
  const champ = useRef<HTMLInputElement>(null)
  const [texte, setTexte] = useState('')
  const [historique, setHistorique] = useState<string[]>([])
  const [override, setOverride] = useState<Partial<Brouillon> | null>(null)
  const [puceOuverte, setPuceOuverte] = useState<string | null>(null)
  const [statut, setStatut] = useState<Statut>('repos')
  const [message, setMessage] = useState<string | null>(null)
  const [enCours, demarrer] = useTransition()

  const contexte = useMemo<LigneContexte>(
    () => ({ comptes, tiers, aujourdHui: new Date() }),
    [comptes, tiers],
  )

  const analyse = useMemo(() => parseLigne(texte, contexte), [texte, contexte])

  // Le brouillon effectif : ce qu'a lu la phrase, corrigé par les puces éditées.
  const brouillon = useMemo<Brouillon | null>(() => {
    if (!analyse.brouillon) return null
    return override ? { ...analyse.brouillon, ...override } : analyse.brouillon
  }, [analyse.brouillon, override])

  const lignes = useMemo(() => (brouillon ? construireLignes(brouillon) : []), [brouillon])

  const pesee = useMemo(() => {
    if (!brouillon) return analyse.pesee
    return {
      debit: lignes.reduce((acc, ligne) => acc + ligne.debit, 0),
      credit: lignes.reduce((acc, ligne) => acc + ligne.credit, 0),
    }
  }, [brouillon, lignes, analyse.pesee])

  const equilibree = pesee.debit === pesee.credit && pesee.debit > 0

  // Une date hors exercice serait refusée par le serveur ; autant le dire
  // avant que la touche Entrée ne soit pressée.
  const jourSaisi = brouillon?.date.toISOString().slice(0, 10) ?? null
  const horsExercice =
    jourSaisi != null && (jourSaisi < exercice.debut || jourSaisi > exercice.fin)

  const prete = brouillon != null && equilibree && peutValider && !horsExercice

  // La saisie change : les corrections de puces d'une phrase précédente ne
  // valent plus rien.
  const majTexte = useCallback((valeur: string) => {
    setHistorique((precedent) => [...precedent.slice(-49), valeur])
    setTexte(valeur)
    setOverride(null)
    setPuceOuverte(null)
    setStatut('repos')
    setMessage(null)
  }, [])

  const annuler = useCallback(() => {
    setHistorique((precedent) => {
      const copie = [...precedent]
      copie.pop()
      const dernier = copie[copie.length - 1] ?? ''
      setTexte(dernier)
      setOverride(null)
      return copie
    })
  }, [])

  const valider = useCallback(() => {
    if (!brouillon || !prete) return
    const ecriture = construireEcriture(brouillon)
    setStatut('envoi')
    setMessage(null)
    demarrer(async () => {
      const resultat: EnregistrerResultat = await enregistrerEcriture({
        journalCode: ecriture.journalCode,
        date: ecriture.date.toISOString().slice(0, 10),
        libelle: ecriture.libelle,
        pieceRef: null,
        lines: ecriture.lines.map((ligne) => ({
          accountNumero: ligne.accountNumero,
          debit: ligne.debit,
          credit: ligne.credit,
          libelle: ligne.libelle,
          partnerCode: brouillon.tiersCode,
        })),
        valider: true,
      })
      if (resultat.ok) {
        setStatut('succes')
        setMessage(resultat.message)
        setTexte('')
        setOverride(null)
        setHistorique([])
        champ.current?.focus()
      } else {
        setStatut('erreur')
        setMessage(resultat.erreur)
      }
    })
  }, [brouillon, prete])

  // Raccourcis globaux de l'écran.
  useEffect(() => {
    const surTouche = (evenement: KeyboardEvent): void => {
      if ((evenement.metaKey || evenement.ctrlKey) && evenement.key.toLowerCase() === 'z') {
        evenement.preventDefault()
        annuler()
      }
      if (evenement.key === 'Escape') {
        setPuceOuverte(null)
      }
    }
    window.addEventListener('keydown', surTouche)
    return () => window.removeEventListener('keydown', surTouche)
  }, [annuler])

  const modifier = (champs: Partial<Brouillon>): void => {
    setOverride((precedent) => ({ ...precedent, ...champs }))
    setPuceOuverte(null)
    champ.current?.focus()
  }

  return (
    <div className="mx-auto flex w-full max-w-[92ch] flex-col gap-12 px-6 pt-16 pb-24 sm:px-10">
      <div className="flex items-start justify-between gap-8">
        <div>
          <p className="surtitre">Saisie · {exercice.libelle}</p>
          <p className="mt-3 max-w-[38ch] text-[15px] leading-[1.55] text-encre-douce">
            Décrivez l’opération en français. L’analyse tourne dans votre
            navigateur : elle fonctionne sans réseau.
          </p>
        </div>
        <Balance debit={pesee.debit} credit={pesee.credit} vide={pesee.debit === 0 && pesee.credit === 0} />
      </div>

      {/* La ligne */}
      <div>
        <label htmlFor="ligne" className="sr-only">
          Décrivez l’opération
        </label>
        <input
          ref={champ}
          id="ligne"
          autoFocus
          autoComplete="off"
          spellCheck={false}
          value={texte}
          onChange={(evenement) => majTexte(evenement.target.value)}
          onKeyDown={(evenement) => {
            if (evenement.key === 'Enter' && prete) {
              evenement.preventDefault()
              valider()
            }
          }}
          placeholder="payé 240 € gasoil Total CB hier"
          className="champ-ligne w-full border-0 bg-transparent p-0 text-[clamp(22px,4.4vw,32px)] leading-[1.3] tracking-[-0.01em] outline-none placeholder:text-trait"
          style={{ caretColor: 'var(--c-accent)' }}
        />
        <div className="filet-ligne mt-4 w-full" />
      </div>

      {/* État vide : la ligne n'a pas encore servi */}
      {texte.length === 0 ? (
        <section aria-label="Exemples de saisie" className="flex flex-col gap-4">
          <p className="surtitre">Essayez</p>
          <ul className="flex flex-col gap-2">
            {EXEMPLES.map((exemple) => (
              <li key={exemple}>
                <button
                  type="button"
                  onClick={() => {
                    majTexte(exemple)
                    champ.current?.focus()
                  }}
                  className="rounded-champ px-3 py-2 text-left text-[15px] text-encre-douce transition-colors hover:bg-papier-creux hover:text-encre"
                >
                  {exemple}
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[13px] text-encre-douce">
            <kbd className="chiffre">⌘K</kbd> ouvre la palette de commandes ·{' '}
            <kbd className="chiffre">?</kbd> affiche les raccourcis
          </p>
        </section>
      ) : null}

      {/* Puces */}
      {analyse.chips.length > 0 ? (
        <section aria-label="Éléments reconnus" className="flex flex-col gap-5">
          <div className="flex flex-wrap gap-2">
            {analyse.chips.map((chip) => {
              const valeurAffichee = valeurPuce(chip.kind, chip.label, brouillon, comptes, journaux, tiers)
              return (
                <Puce
                  key={chip.kind}
                  kind={chip.kind}
                  label={valeurAffichee}
                  confiance={override && chip.kind in override ? 1000 : chip.confiance}
                  ouverte={puceOuverte === chip.kind}
                  onOuvrir={() => setPuceOuverte(puceOuverte === chip.kind ? null : chip.kind)}
                  enfants={
                    brouillon ? (
                      <EditeurPuce
                        kind={chip.kind}
                        brouillon={brouillon}
                        comptes={comptes}
                        journaux={journaux}
                        tiers={tiers}
                        exercice={exercice}
                        onModifier={modifier}
                      />
                    ) : null
                  }
                />
              )
            })}
          </div>
          <p className="text-[14px] leading-[1.5] text-encre-douce">{analyse.raison}</p>
          {horsExercice ? (
            <p className="text-[14px] leading-[1.5]" style={{ color: 'var(--c-terre)' }}>
              Cette date sort de l’exercice ({formatJour(exercice.debut)} –{' '}
              {formatJour(exercice.fin)}). Corrigez la puce Date, ou ouvrez
              l’exercice correspondant.
            </p>
          ) : null}
        </section>
      ) : null}

      {/* Écriture proposée */}
      {lignes.length > 0 ? (
        <section aria-label="Écriture proposée" className="carte overflow-x-auto">
          <table className="w-full min-w-[34rem]">
            <caption className="surtitre mb-5 text-left">
              {brouillon?.journalCode} · {brouillon?.date.toLocaleDateString('fr-FR', { timeZone: 'UTC' })}
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
              {lignes.map((ligne, index) => (
                <tr key={`${ligne.accountNumero}-${index}`} className="border-b border-trait/60 last:border-0">
                  <td className="chiffre py-3 pr-4 text-[14px]">{ligne.accountNumero}</td>
                  <td className="max-w-[24ch] truncate py-3 pr-4 text-[14px]">{ligne.libelle}</td>
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
                <td className="chiffre pt-4 text-right text-[14px] font-medium">{formatAmount(pesee.debit)}</td>
                <td className="chiffre pt-4 text-right text-[14px] font-medium">{formatAmount(pesee.credit)}</td>
              </tr>
            </tfoot>
          </table>
        </section>
      ) : null}

      {/* Validation */}
      <div className="flex flex-wrap items-center gap-5">
        <button
          type="button"
          onClick={valider}
          disabled={!prete || enCours}
          className="rounded-pill px-6 py-3 text-[15px] transition-opacity disabled:cursor-not-allowed disabled:opacity-35"
          style={{ backgroundColor: 'var(--c-encre)', color: 'var(--c-papier)' }}
        >
          {enCours || statut === 'envoi' ? 'Enregistrement…' : 'Valider'}
          <span className="chiffre ml-3 opacity-60">⏎</span>
        </button>

        {!peutValider ? (
          <p className="text-[14px] text-encre-douce">
            Votre rôle permet la saisie mais pas la validation.
          </p>
        ) : null}

        {message ? (
          <p
            role="status"
            aria-live="polite"
            className="text-[14px]"
            style={{ color: statut === 'erreur' ? 'var(--c-terre)' : 'var(--c-vert-sourd)' }}
          >
            {message}
          </p>
        ) : null}
      </div>
    </div>
  )
}

function formatJour(iso: string): string {
  return new Date(`${iso}T00:00:00.000Z`).toLocaleDateString('fr-FR', { timeZone: 'UTC' })
}

/** Ce que la puce affiche une fois le brouillon corrigé à la main. */
function valeurPuce(
  kind: string,
  defaut: string,
  brouillon: Brouillon | null,
  comptes: readonly LigneCompte[],
  journaux: readonly JournalOption[],
  tiers: readonly LigneTiers[],
): string {
  if (!brouillon) return defaut
  switch (kind) {
    case 'montant':
      return formatAmount(brouillon.montantTtc)
    case 'compte': {
      const compte = comptes.find((item) => item.numero === brouillon.compteNumero)
      return compte ? `${compte.numero} ${compte.libelle}` : brouillon.compteNumero
    }
    case 'tva':
      return brouillon.tauxTva === 0
        ? 'Sans TVA'
        : `TVA ${(brouillon.tauxTva / 1000).toString().replace('.', ',')} %`
    case 'journal': {
      const journal = journaux.find((item) => item.code === brouillon.journalCode)
      return journal ? `${journal.libelle} · ${journal.code}` : brouillon.journalCode
    }
    case 'date':
      return brouillon.date.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      })
    case 'sens':
      return brouillon.sens === 'vente' ? 'Vente' : 'Achat'
    case 'tiers': {
      const partenaire = tiers.find((item) => item.code === brouillon.tiersCode)
      return partenaire?.nom ?? defaut
    }
    case 'libelle':
      return brouillon.libelle
    default:
      return defaut
  }
}

interface EditeurProps {
  readonly kind: string
  readonly brouillon: Brouillon
  readonly comptes: readonly LigneCompte[]
  readonly journaux: readonly JournalOption[]
  readonly tiers: readonly LigneTiers[]
  readonly exercice: { readonly debut: string; readonly fin: string }
  readonly onModifier: (champs: Partial<Brouillon>) => void
}

function EditeurPuce({ kind, brouillon, comptes, journaux, tiers, exercice, onModifier }: EditeurProps) {
  const [requete, setRequete] = useState('')

  switch (kind) {
    case 'montant':
      return (
        <ChampTexte
          intitule="Montant TTC"
          defaut={formatAmount(brouillon.montantTtc)}
          onValider={(valeur) => {
            const montant = parseAmount(valeur)
            if (montant != null && montant > 0) onModifier({ montantTtc: montant })
          }}
        />
      )

    case 'libelle':
      return (
        <ChampTexte
          intitule="Libellé"
          defaut={brouillon.libelle}
          onValider={(valeur) => {
            if (valeur.trim().length > 0) onModifier({ libelle: valeur.trim() })
          }}
        />
      )

    case 'date':
      return (
        <ChampTexte
          intitule="Date"
          type="date"
          min={exercice.debut}
          max={exercice.fin}
          defaut={brouillon.date.toISOString().slice(0, 10)}
          onValider={(valeur) => {
            if (/^\d{4}-\d{2}-\d{2}$/.test(valeur)) {
              onModifier({ date: new Date(`${valeur}T00:00:00.000Z`) })
            }
          }}
        />
      )

    case 'compte': {
      const resultats = chercherComptes(requete, comptes, 7)
      return (
        <div className="flex flex-col gap-3">
          <label className="surtitre" htmlFor="recherche-compte">
            Compte d’imputation
          </label>
          <input
            id="recherche-compte"
            autoFocus
            value={requete}
            onChange={(evenement) => setRequete(evenement.target.value)}
            placeholder="606 ou « carburant »"
            className="chiffre w-full rounded-champ border border-trait bg-papier px-3 py-2 text-[14px] outline-none"
          />
          <ul className="flex flex-col">
            {resultats.length === 0 ? (
              <li className="px-1 py-2 text-[13px] text-encre-douce">Aucun compte ne correspond.</li>
            ) : (
              resultats.map((compte) => (
                <li key={compte.numero}>
                  <button
                    type="button"
                    onClick={() =>
                      onModifier({
                        compteNumero: compte.numero,
                        ...(compte.tauxTvaAttendu != null ? { tauxTva: compte.tauxTvaAttendu } : {}),
                      })
                    }
                    className="flex w-full items-baseline gap-3 rounded-champ px-2 py-2 text-left transition-colors hover:bg-papier-creux"
                  >
                    <span className="chiffre text-[13px] text-accent">{compte.numero}</span>
                    <span className="truncate text-[13px]">{compte.libelle}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )
    }

    case 'tva':
      return (
        <Choix
          intitule="Taux de TVA"
          options={[
            { valeur: String(TAUX.NORMAL), label: '20 %' },
            { valeur: String(TAUX.INTERMEDIAIRE), label: '10 %' },
            { valeur: String(TAUX.REDUIT), label: '5,5 %' },
            { valeur: String(TAUX.PARTICULIER), label: '2,1 %' },
            { valeur: '0', label: 'Sans TVA' },
          ]}
          courant={String(brouillon.tauxTva)}
          onChoisir={(valeur) => onModifier({ tauxTva: Number(valeur) })}
        />
      )

    case 'journal':
      return (
        <Choix
          intitule="Journal"
          options={journaux.map((journal) => ({
            valeur: journal.code,
            label: `${journal.code} · ${journal.libelle}`,
          }))}
          courant={brouillon.journalCode}
          onChoisir={(valeur) => onModifier({ journalCode: valeur })}
        />
      )

    case 'sens':
      return (
        <Choix
          intitule="Sens"
          options={[
            { valeur: 'achat', label: 'Achat' },
            { valeur: 'vente', label: 'Vente' },
          ]}
          courant={brouillon.sens}
          onChoisir={(valeur) =>
            onModifier({
              sens: valeur === 'vente' ? 'vente' : 'achat',
              contrepartieNumero: valeur === 'vente' ? '411000' : '401000',
              journalCode: valeur === 'vente' ? 'VE' : 'AC',
            })
          }
        />
      )

    case 'tiers':
      return (
        <Choix
          intitule="Tiers"
          options={tiers.map((partenaire) => ({ valeur: partenaire.code, label: partenaire.nom }))}
          courant={brouillon.tiersCode ?? ''}
          onChoisir={(valeur) => onModifier({ tiersCode: valeur })}
        />
      )

    default:
      return null
  }
}

function ChampTexte({
  intitule,
  defaut,
  type = 'text',
  min,
  max,
  onValider,
}: {
  intitule: string
  defaut: string
  type?: string
  min?: string
  max?: string
  onValider: (valeur: string) => void
}) {
  const [valeur, setValeur] = useState(defaut)
  return (
    <div className="flex flex-col gap-3">
      <label className="surtitre" htmlFor="champ-puce">
        {intitule}
      </label>
      <input
        id="champ-puce"
        autoFocus
        type={type}
        min={min}
        max={max}
        value={valeur}
        onChange={(evenement) => setValeur(evenement.target.value)}
        onKeyDown={(evenement) => {
          if (evenement.key === 'Enter') {
            evenement.preventDefault()
            onValider(valeur)
          }
        }}
        className="chiffre w-full rounded-champ border border-trait bg-papier px-3 py-2 text-[15px] outline-none"
      />
      <button
        type="button"
        onClick={() => onValider(valeur)}
        className="self-start rounded-pill px-4 py-2 text-[13px]"
        style={{ backgroundColor: 'var(--c-encre)', color: 'var(--c-papier)' }}
      >
        Appliquer
      </button>
    </div>
  )
}

function Choix({
  intitule,
  options,
  courant,
  onChoisir,
}: {
  intitule: string
  options: readonly { valeur: string; label: string }[]
  courant: string
  onChoisir: (valeur: string) => void
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="surtitre">{intitule}</p>
      <ul className="flex flex-col">
        {options.map((option) => (
          <li key={option.valeur}>
            <button
              type="button"
              onClick={() => onChoisir(option.valeur)}
              aria-current={option.valeur === courant}
              className="flex w-full items-center justify-between rounded-champ px-2 py-2 text-left text-[14px] transition-colors hover:bg-papier-creux"
              style={option.valeur === courant ? { color: 'var(--c-accent)' } : undefined}
            >
              {option.label}
              {option.valeur === courant ? <span aria-hidden>·</span> : null}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
