'use client'

/**
 * Enveloppe de La Balance.
 *
 * Trois états, et aucun n'est un pis-aller :
 *  - WebGL disponible et mouvement autorisé → la balance 3D ;
 *  - `prefers-reduced-motion` → la même balance, dessinée, figée dans sa
 *    position d'inclinaison. Le § 9 l'exige : la balance devient statique,
 *    elle ne disparaît pas ;
 *  - avant hydratation → la version dessinée, pour que rien ne saute.
 */

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import { formatAmount } from '@/lib/accounting/money'
import { inclinaison } from './ressort'

const Balance3D = dynamic(() => import('./Balance3D'), {
  ssr: false,
  loading: () => <BalanceDessinee debit={0} credit={0} vide />,
})

export interface BalanceProps {
  readonly debit: number
  readonly credit: number
  readonly vide: boolean
}

export function Balance({ debit, credit, vide }: BalanceProps) {
  const [mouvementAutorise, setMouvementAutorise] = useState<boolean | null>(null)

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const appliquer = (): void => setMouvementAutorise(!media.matches)
    appliquer()
    media.addEventListener('change', appliquer)
    return () => media.removeEventListener('change', appliquer)
  }, [])

  const ecart = debit - credit
  const description = vide
    ? 'Balance au repos : aucune ligne à peser.'
    : ecart === 0
      ? `Balance à l’équilibre : ${formatAmount(debit)} au débit comme au crédit.`
      : `Balance déséquilibrée de ${formatAmount(Math.abs(ecart))} au ${ecart > 0 ? 'débit' : 'crédit'}.`

  return (
    <figure className="m-0 flex flex-col items-center gap-3">
      <div className="h-[180px] w-[220px]" role="img" aria-label={description}>
        {mouvementAutorise === false ? (
          <BalanceDessinee debit={debit} credit={credit} vide={vide} />
        ) : mouvementAutorise === true ? (
          <Balance3D debit={debit} credit={credit} vide={vide} />
        ) : (
          <BalanceDessinee debit={debit} credit={credit} vide={vide} />
        )}
      </div>
      <figcaption className="sr-only">{description}</figcaption>
    </figure>
  )
}

/**
 * La balance dessinée. Même géométrie que la 3D, même inclinaison, sans
 * animation : c'est la version qu'on sert à qui a demandé que rien ne bouge.
 */
export function BalanceDessinee({ debit, credit, vide }: BalanceProps) {
  const angle = vide ? 0 : inclinaison(debit, credit) * 18 // degrés
  const equilibree = !vide && debit === credit && debit > 0
  const decalage = Math.sin((angle * Math.PI) / 180) * 46

  return (
    <svg viewBox="0 0 220 180" width="100%" height="100%" aria-hidden focusable="false">
      {/* Socle et colonne */}
      <ellipse cx="110" cy="162" rx="34" ry="7" fill="var(--c-graphite)" />
      <rect x="106" y="52" width="8" height="106" rx="4" fill="var(--c-graphite)" />
      {/* Témoin d'équilibre */}
      <circle
        cx="110"
        cy="46"
        r="7"
        fill={equilibree ? 'var(--c-vert-sourd)' : 'var(--c-terre)'}
      />
      {/* Fléau */}
      <g transform={`rotate(${-angle} 110 56)`}>
        <rect x="34" y="53" width="152" height="6" rx="3" fill="var(--c-graphite)" />
        <circle cx="38" cy="56" r="4" fill="var(--c-graphite)" />
        <circle cx="182" cy="56" r="4" fill="var(--c-graphite)" />
      </g>
      {/* Plateaux — ils pendent, ils ne basculent pas */}
      <g transform={`translate(0 ${-decalage})`}>
        <line x1="38" y1="56" x2="20" y2="96" stroke="var(--c-graphite)" strokeWidth="1.5" />
        <line x1="38" y1="56" x2="56" y2="96" stroke="var(--c-graphite)" strokeWidth="1.5" />
        <ellipse cx="38" cy="98" rx="22" ry="5" fill="var(--c-encre-douce)" />
      </g>
      <g transform={`translate(0 ${decalage})`}>
        <line x1="182" y1="56" x2="164" y2="96" stroke="var(--c-graphite)" strokeWidth="1.5" />
        <line x1="182" y1="56" x2="200" y2="96" stroke="var(--c-graphite)" strokeWidth="1.5" />
        <ellipse cx="182" cy="98" rx="22" ry="5" fill="var(--c-encre-douce)" />
      </g>
    </svg>
  )
}
