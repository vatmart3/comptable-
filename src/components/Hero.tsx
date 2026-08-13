import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { hero, ui } from '../config/site'
import { heroScroll, useReducedMotion } from '../lib/motion'
import { BalanceDrawing } from './scene/BalanceDrawing'

/* La scène n'est pas dans le bundle initial. Elle est demandée après le premier
   paint, et seulement si WebGL répond. */
const BalanceScene = lazy(() => import('./scene/BalanceScene'))

function webglAvailable(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const canvas = document.createElement('canvas')
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl2') || canvas.getContext('webgl'))
    )
  } catch {
    return false
  }
}

export function Hero() {
  const reduced = useReducedMotion()
  const section = useRef<HTMLElement>(null)
  const line = useRef<HTMLDivElement>(null)
  const copy = useRef<HTMLDivElement>(null)

  const [webgl] = useState(webglAvailable)
  const [mounted, setMounted] = useState(false)
  const [compact, setCompact] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < 900,
  )

  /* On attend le premier paint avant de demander la scène : le texte du hero
     et le grand livre s'affichent d'abord, la 3D arrive ensuite. */
  useEffect(() => {
    if (!webgl) return
    const id = window.requestAnimationFrame(() => window.setTimeout(() => setMounted(true), 60))
    return () => window.cancelAnimationFrame(id)
  }, [webgl])

  useEffect(() => {
    const onResize = () => setCompact(window.innerWidth < 900)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  /* Le scroll pilote l'avancement de la scène. Une seule valeur, partagée,
     hors de React : elle change à chaque frame. */
  useEffect(() => {
    if (reduced || !section.current) {
      heroScroll.progress = 1
      gsap.set([line.current], { scaleX: 1 })
      return
    }

    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: section.current,
        start: 'top top',
        end: 'bottom bottom',
        scrub: true,
        onUpdate: (self) => {
          // L'équilibre est atteint à 82 % de la course : il reste un peu de
          // scroll pour le regarder, stable, avant que la page ne bascule.
          heroScroll.progress = Math.min(1, self.progress / 0.82)
        },
      })

      // Le trait de clôture du hero : il traverse l'écran au moment exact de
      // l'équilibre, et devient la première ligne du grand livre.
      gsap.fromTo(
        line.current,
        { scaleX: 0 },
        {
          scaleX: 1,
          ease: 'none',
          scrollTrigger: {
            trigger: section.current,
            start: 'top+=72% top',
            end: 'top+=92% top',
            scrub: true,
          },
        },
      )

      gsap.to(copy.current, {
        opacity: 1,
        y: 0,
        duration: 1.1,
        delay: 0.15,
        ease: 'power2.out',
      })
    }, section)

    return () => ctx.revert()
  }, [reduced])

  /* Parallaxe pointeur. Coupée au tactile : `pointer: fine` uniquement. */
  useEffect(() => {
    if (reduced || !window.matchMedia('(pointer: fine)').matches) return
    const onMove = (e: PointerEvent) => {
      heroScroll.pointerX = (e.clientX / window.innerWidth) * 2 - 1
      heroScroll.pointerY = (e.clientY / window.innerHeight) * 2 - 1
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => window.removeEventListener('pointermove', onMove)
  }, [reduced])

  return (
    <section
      ref={section}
      id="hero"
      aria-label="Cabinet Ferrand & Solère"
      className={reduced ? 'relative' : 'relative h-[240vh]'}
    >
      <div className="sticky top-0 flex h-dvh flex-col justify-end overflow-hidden">
        {/* La scène occupe l'écran. Elle ne reçoit aucun événement : elle est
            décorative, tout le sens est dans le texte en dessous. */}
        <div className="pointer-events-none absolute inset-0 pad-rail" aria-hidden>
          {webgl ? (
            mounted ? (
              <Suspense
                fallback={
                  <div className="flex h-full items-center justify-center">
                    <BalanceDrawing variant="wire" className="h-[62%] w-auto max-w-[86%]" />
                    <span className="sr-only">{ui.loading}</span>
                  </div>
                }
              >
                <BalanceScene compact={compact} />
              </Suspense>
            ) : (
              <div className="flex h-full items-center justify-center">
                <BalanceDrawing variant="wire" className="h-[62%] w-auto max-w-[86%]" />
              </div>
            )
          ) : (
            /* Repli sans WebGL : la scène à l'équilibre, dessinée. */
            <div className="flex h-full items-center justify-center">
              <BalanceDrawing variant="solid" className="h-[64%] w-auto max-w-[88%]" />
            </div>
          )}
        </div>

        {/* Le seul texte du hero. En bas à gauche, sur la grille. */}
        <div className="sheet pad-rail relative z-10 pb-14 sm:pb-20">
          <div
            ref={copy}
            style={reduced ? undefined : { opacity: 0, transform: 'translateY(18px)' }}
          >
            <p className="eyebrow text-ink/65">{hero.eyebrow}</p>
            <h1 className="display-xl mt-4 max-w-[19ch]">{hero.line}</h1>
            <p className="lede mt-5 text-ink/75">{hero.sub}</p>
          </div>

          <p className="eyebrow mt-10 flex items-center gap-3 text-ink/65">
            <span aria-hidden className="inline-block h-3 w-px bg-ink/40" />
            {reduced ? hero.scrollReduced : hero.scroll}
          </p>
        </div>

        {/* Le trait qui devient la première ligne du registre. */}
        <div
          ref={line}
          aria-hidden
          className="relative z-10 h-px w-full origin-left bg-ink"
          style={reduced ? undefined : { transform: 'scaleX(0)' }}
        />
      </div>
    </section>
  )
}
