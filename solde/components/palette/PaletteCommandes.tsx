'use client'

/**
 * ⌘K — la navigation principale de SOLDE (§ 7.3).
 *
 * Il n'y a pas de barre latérale : tout se trouve ici. Les écrans encore à
 * construire y figurent, désactivés et datés — mieux vaut une porte fermée
 * qu'on voit qu'une porte qu'on ne soupçonne pas.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Commande {
  readonly id: string
  readonly libelle: string
  readonly indice: string
  readonly chemin?: string
  readonly action?: () => void
  readonly phase?: string
}

export function PaletteCommandes() {
  const router = useRouter()
  const [ouverte, setOuverte] = useState(false)
  const [raccourcis, setRaccourcis] = useState(false)
  const [requete, setRequete] = useState('')
  const [curseur, setCurseur] = useState(0)
  const champ = useRef<HTMLInputElement>(null)

  const basculerTheme = useCallback(() => {
    const racine = document.documentElement
    const actuel = racine.getAttribute('data-theme')
    const sombre = window.matchMedia('(prefers-color-scheme: dark)').matches
    const prochain = actuel === 'nuit' ? 'clair' : actuel === 'clair' ? 'nuit' : sombre ? 'clair' : 'nuit'
    racine.setAttribute('data-theme', prochain)
    try {
      localStorage.setItem('solde-theme', prochain)
    } catch {
      // Navigation privée : le thème vaut pour la session, c'est suffisant.
    }
  }, [])

  const commandes = useMemo<Commande[]>(
    () => [
      { id: 'saisie', libelle: 'Saisir une écriture', indice: 'La Ligne', chemin: '/saisie' },
      { id: 'specimen', libelle: 'Spécimen de la direction artistique', indice: 'Design', chemin: '/' },
      { id: 'theme', libelle: 'Basculer jour / nuit', indice: 'Affichage', action: basculerTheme },
      { id: 'raccourcis', libelle: 'Afficher les raccourcis clavier', indice: '?', action: () => setRaccourcis(true) },
      { id: 'livre', libelle: 'Le Fil — grand livre', indice: 'Consultation', phase: 'Phase 2' },
      { id: 'banque', libelle: 'Lettrage magnétique et rapprochement', indice: 'Banque', phase: 'Phase 3' },
      { id: 'tva', libelle: 'Assistant CA3', indice: 'TVA', phase: 'Phase 4' },
      { id: 'immo', libelle: 'Immobilisations et amortissements', indice: 'Immobilisations', phase: 'Phase 4' },
      { id: 'etats', libelle: 'Bilan, compte de résultat, SIG', indice: 'États', phase: 'Phase 6' },
      { id: 'cloture', libelle: 'Le Radar — clôture', indice: 'Clôture', phase: 'Phase 6' },
    ],
    [basculerTheme],
  )

  const filtrees = useMemo(() => {
    const q = requete.trim().toLowerCase()
    if (q.length === 0) return commandes
    return commandes.filter(
      (commande) =>
        commande.libelle.toLowerCase().includes(q) || commande.indice.toLowerCase().includes(q),
    )
  }, [commandes, requete])

  useEffect(() => {
    const surTouche = (evenement: KeyboardEvent): void => {
      const cible = evenement.target
      const dansUnChamp =
        cible instanceof HTMLElement &&
        (cible.tagName === 'INPUT' || cible.tagName === 'TEXTAREA' || cible.isContentEditable)

      if ((evenement.metaKey || evenement.ctrlKey) && evenement.key.toLowerCase() === 'k') {
        evenement.preventDefault()
        setOuverte((precedent) => !precedent)
        setRequete('')
        setCurseur(0)
      }
      if (evenement.key === '?' && !dansUnChamp) {
        evenement.preventDefault()
        setRaccourcis((precedent) => !precedent)
      }
      if (evenement.key === 'Escape') {
        setOuverte(false)
        setRaccourcis(false)
      }
    }
    window.addEventListener('keydown', surTouche)
    return () => window.removeEventListener('keydown', surTouche)
  }, [])

  // Thème mémorisé d'une visite à l'autre.
  useEffect(() => {
    try {
      const memorise = localStorage.getItem('solde-theme')
      if (memorise === 'nuit' || memorise === 'clair') {
        document.documentElement.setAttribute('data-theme', memorise)
      }
    } catch {
      // Rien à faire : le thème système s'applique.
    }
  }, [])

  useEffect(() => {
    if (ouverte) champ.current?.focus()
  }, [ouverte])

  const lancer = useCallback(
    (commande: Commande | undefined) => {
      if (!commande || commande.phase) return
      setOuverte(false)
      if (commande.action) commande.action()
      if (commande.chemin) router.push(commande.chemin)
    },
    [router],
  )

  return (
    <>
      {/* Rappel discret, en bas à gauche : la seule affordance de navigation. */}
      <button
        type="button"
        onClick={() => setOuverte(true)}
        className="fixed bottom-6 left-6 z-40 flex items-center gap-2 rounded-pill border border-trait bg-papier-haut px-4 py-2 text-[13px] text-encre-douce transition-colors hover:text-encre"
      >
        <span className="chiffre">⌘K</span>
        <span>Commandes</span>
      </button>

      {ouverte ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Palette de commandes"
          className="fixed inset-0 z-50 flex items-start justify-center px-6 pt-[12vh]"
          style={{ backgroundColor: 'color-mix(in oklab, var(--c-encre) 22%, transparent)' }}
          onClick={(evenement) => {
            if (evenement.target === evenement.currentTarget) setOuverte(false)
          }}
        >
          <div className="carte w-full max-w-[52ch] p-0">
            <input
              ref={champ}
              value={requete}
              onChange={(evenement) => {
                setRequete(evenement.target.value)
                setCurseur(0)
              }}
              onKeyDown={(evenement) => {
                if (evenement.key === 'ArrowDown') {
                  evenement.preventDefault()
                  setCurseur((precedent) => Math.min(precedent + 1, filtrees.length - 1))
                }
                if (evenement.key === 'ArrowUp') {
                  evenement.preventDefault()
                  setCurseur((precedent) => Math.max(precedent - 1, 0))
                }
                if (evenement.key === 'Enter') {
                  evenement.preventDefault()
                  lancer(filtrees[curseur])
                }
              }}
              placeholder="Chercher une commande…"
              aria-label="Chercher une commande"
              // `champ-ligne` neutralise l'anneau de focus global : il
              // déborderait du rayon de la carte. Le focus se marque par le
              // filet sous le champ, comme sur La Ligne.
              className="champ-ligne w-full border-0 border-b-2 border-trait bg-transparent px-6 py-5 text-[17px] outline-none transition-colors focus-visible:border-accent placeholder:text-encre-douce"
            />
            <ul className="max-h-[46vh] overflow-y-auto p-2">
              {filtrees.length === 0 ? (
                <li className="px-4 py-6 text-[14px] text-encre-douce">Aucune commande.</li>
              ) : (
                filtrees.map((commande, index) => (
                  <li key={commande.id}>
                    <button
                      type="button"
                      disabled={commande.phase != null}
                      onMouseEnter={() => setCurseur(index)}
                      onClick={() => lancer(commande)}
                      aria-current={index === curseur}
                      className="flex w-full items-baseline justify-between gap-4 rounded-champ px-4 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                      style={index === curseur && !commande.phase ? { backgroundColor: 'var(--c-papier-creux)' } : undefined}
                    >
                      <span className="text-[15px]">{commande.libelle}</span>
                      <span className="surtitre shrink-0">{commande.phase ?? commande.indice}</span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      ) : null}

      {raccourcis ? <Raccourcis onFermer={() => setRaccourcis(false)} /> : null}
    </>
  )
}

const TOUCHES: readonly { readonly touche: string; readonly effet: string }[] = [
  { touche: '⌘K', effet: 'Ouvrir la palette de commandes' },
  { touche: '?', effet: 'Afficher ou masquer cet écran' },
  { touche: '⏎', effet: 'Valider l’écriture, si la balance est à l’équilibre' },
  { touche: '⇥', effet: 'Passer de puce en puce' },
  { touche: '⌘Z', effet: 'Revenir à l’état précédent de la ligne' },
  { touche: '⎋', effet: 'Fermer l’éditeur de puce ou la palette' },
]

function Raccourcis({ onFermer }: { onFermer: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Raccourcis clavier"
      className="fixed inset-0 z-50 flex items-center justify-center px-6"
      style={{ backgroundColor: 'color-mix(in oklab, var(--c-encre) 22%, transparent)' }}
      onClick={(evenement) => {
        if (evenement.target === evenement.currentTarget) onFermer()
      }}
    >
      <div className="carte w-full max-w-[46ch]">
        <p className="surtitre mb-6">Raccourcis</p>
        <dl className="flex flex-col gap-4">
          {TOUCHES.map((raccourci) => (
            <div key={raccourci.touche} className="flex items-baseline justify-between gap-6">
              <dt className="chiffre shrink-0 text-[14px]">{raccourci.touche}</dt>
              <dd className="text-right text-[14px] text-encre-douce">{raccourci.effet}</dd>
            </div>
          ))}
        </dl>
        <button
          type="button"
          onClick={onFermer}
          className="mt-8 rounded-pill border border-trait px-4 py-2 text-[13px]"
        >
          Fermer
        </button>
      </div>
    </div>
  )
}
