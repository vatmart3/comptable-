import { useEffect } from 'react'
import Lenis from 'lenis'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useReducedMotion } from './motion'

gsap.registerPlugin(ScrollTrigger)

/**
 * Scroll amorti (Lenis) branché sur l'horloge de GSAP, pour que ScrollTrigger
 * et l'amortissement partagent la même frame — sinon les sections se déclenchent
 * avec un temps de retard visible.
 *
 * Sous `prefers-reduced-motion`, Lenis n'est simplement pas monté : on rend la
 * main au scroll natif du navigateur.
 */
export function useSmoothScroll() {
  const reduced = useReducedMotion()

  useEffect(() => {
    if (reduced) {
      ScrollTrigger.refresh()
      return
    }

    const lenis = new Lenis({
      duration: 1.05,
      easing: (t) => 1 - Math.pow(1 - t, 3),
      touchMultiplier: 1.6,
    })

    const onScroll = () => ScrollTrigger.update()
    lenis.on('scroll', onScroll)

    const raf = (time: number) => lenis.raf(time * 1000)
    gsap.ticker.add(raf)
    gsap.ticker.lagSmoothing(0)

    // Les ancres du sommaire passent par Lenis, sinon elles sautent.
    const onClick = (e: MouseEvent) => {
      const link = (e.target as HTMLElement | null)?.closest('a[href^="#"]')
      if (!(link instanceof HTMLAnchorElement)) return
      const id = link.getAttribute('href')
      if (!id || id === '#') return
      const target = document.querySelector(id)
      if (!target) return
      e.preventDefault()
      lenis.scrollTo(target as HTMLElement, { offset: -72 })
      // On rend le focus au clavier : sans ça, la tabulation repart du haut.
      ;(target as HTMLElement).setAttribute('tabindex', '-1')
      ;(target as HTMLElement).focus({ preventScroll: true })
    }
    document.addEventListener('click', onClick)

    return () => {
      document.removeEventListener('click', onClick)
      lenis.off('scroll', onScroll)
      gsap.ticker.remove(raf)
      lenis.destroy()
    }
  }, [reduced])
}
