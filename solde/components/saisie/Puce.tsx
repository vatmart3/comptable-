'use client'

/**
 * Une puce — la vue d'un champ du brouillon.
 *
 * Chaque puce est un bouton : elle entre donc naturellement dans l'ordre de
 * tabulation, sans `tabindex` acrobatique. Entrée ou clic ouvre l'éditeur du
 * champ ; Échap le referme. Les mains ne quittent jamais le clavier.
 */

import { useEffect, useRef, useState } from 'react'
import type { ChipKind } from '@/lib/accounting/ligne'

const TEINTE: Record<ChipKind, string> = {
  sens: 'var(--c-encre-douce)',
  date: 'var(--c-encre-douce)',
  montant: 'var(--c-encre)',
  compte: 'var(--c-accent)',
  tva: 'var(--c-vert-sourd)',
  journal: 'var(--c-graphite)',
  tiers: 'var(--c-terre)',
  libelle: 'var(--c-encre-douce)',
}

const INTITULE: Record<ChipKind, string> = {
  sens: 'Sens',
  date: 'Date',
  montant: 'Montant',
  compte: 'Compte',
  tva: 'TVA',
  journal: 'Journal',
  tiers: 'Tiers',
  libelle: 'Libellé',
}

export interface PuceProps {
  readonly kind: ChipKind
  readonly label: string
  /** Confiance en millièmes : sous 700, la puce se signale comme déduite. */
  readonly confiance: number
  readonly enfants?: React.ReactNode
  readonly onOuvrir?: () => void
  readonly ouverte?: boolean
}

export function Puce({ kind, label, confiance, enfants, onOuvrir, ouverte = false }: PuceProps) {
  const conteneur = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<'bas' | 'haut'>('bas')

  useEffect(() => {
    if (!ouverte || !conteneur.current) return
    const rect = conteneur.current.getBoundingClientRect()
    setPosition(window.innerHeight - rect.bottom < 280 ? 'haut' : 'bas')
  }, [ouverte])

  const deduite = confiance < 700

  return (
    <div ref={conteneur} className="relative">
      <button
        type="button"
        onClick={onOuvrir}
        aria-expanded={enfants ? ouverte : undefined}
        aria-label={`${INTITULE[kind]} : ${label}`}
        className="group flex items-center gap-2 rounded-pill border px-3 py-1.5 text-left transition-colors"
        style={{
          borderColor: deduite ? 'var(--c-trait)' : 'color-mix(in oklab, ' + TEINTE[kind] + ' 32%, transparent)',
          backgroundColor: 'color-mix(in oklab, ' + TEINTE[kind] + ' 8%, transparent)',
          borderStyle: deduite ? 'dashed' : 'solid',
        }}
      >
        <span className="surtitre" style={{ fontSize: '10px' }}>
          {INTITULE[kind]}
        </span>
        <span
          className={kind === 'montant' || kind === 'compte' ? 'chiffre text-[14px]' : 'text-[14px]'}
          style={{ color: TEINTE[kind] }}
        >
          {label}
        </span>
      </button>

      {ouverte && enfants ? (
        <div
          className="carte absolute z-30 w-[min(92vw,340px)] p-4"
          style={{
            [position === 'bas' ? 'top' : 'bottom']: 'calc(100% + 8px)',
            left: 0,
            backgroundColor: 'var(--c-papier-haut)',
          }}
        >
          {enfants}
        </div>
      ) : null}
    </div>
  )
}
