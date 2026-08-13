import { useEffect, useState } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia(QUERY).matches
}

/**
 * Réévalué en direct : un visiteur qui active la réduction de mouvement
 * dans son système pendant sa visite voit le site s'immobiliser sans recharger.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(prefersReducedMotion)

  useEffect(() => {
    const mq = window.matchMedia(QUERY)
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return reduced
}

/** Vrai pointeur (souris / trackpad), par opposition au tactile. */
export function hasFinePointer(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(pointer: fine)').matches
}

/**
 * Avancement du hero, partagé entre GSAP et la scène 3D.
 * Volontairement hors de React : cette valeur change à chaque frame, elle
 * n'a rien à faire dans un état qui déclencherait un rendu.
 */
export const heroScroll = { progress: 0, pointerX: 0, pointerY: 0 }
