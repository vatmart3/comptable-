import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { ui } from '../config/site'
import { hasFinePointer, useReducedMotion } from '../lib/motion'

/* ─────────────────────────────────────────────────────────────────────────
   RÉTICULE DE LECTURE

   Un viseur fin qui remplace le curseur sur desktop. Au survol d'une donnée
   (tout élément portant `data-cursor`), il affiche la valeur de la ligne —
   comme une règle de lecture posée sur un tableau de chiffres.

   Jamais sur mobile, jamais sous `prefers-reduced-motion`, et désactivable
   depuis le pied de page. Le curseur système revient immédiatement.
   ───────────────────────────────────────────────────────────────────────── */

const KEY = 'fs.crosshair'

interface CursorCtx {
  enabled: boolean
  available: boolean
  toggle: () => void
}

const Ctx = createContext<CursorCtx>({ enabled: false, available: false, toggle: () => {} })

export function CursorProvider({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion()
  const [available, setAvailable] = useState(false)
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    const ok = hasFinePointer() && !reduced
    setAvailable(ok)
    if (!ok) {
      setEnabled(false)
      return
    }
    setEnabled(window.localStorage.getItem(KEY) !== 'off')
  }, [reduced])

  useEffect(() => {
    document.body.classList.toggle('no-cursor', enabled)
    return () => document.body.classList.remove('no-cursor')
  }, [enabled])

  const toggle = () => {
    setEnabled((v) => {
      window.localStorage.setItem(KEY, v ? 'off' : 'on')
      return !v
    })
  }

  return <Ctx.Provider value={{ enabled, available, toggle }}>{children}</Ctx.Provider>
}

export function CursorToggle({ className = '' }: { className?: string }) {
  const { enabled, available, toggle } = useContext(Ctx)
  if (!available) return null
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={enabled}
      className={`eyebrow cursor-pointer text-left underline-offset-4 hover:underline ${className}`}
    >
      {ui.cursorLabel} — {enabled ? 'activé' : 'désactivé'}
    </button>
  )
}

export function Crosshair() {
  const { enabled } = useContext(Ctx)
  const root = useRef<HTMLDivElement>(null)
  const labelRef = useRef<HTMLSpanElement>(null)
  const [label, setLabel] = useState('')

  useEffect(() => {
    if (!enabled) return
    const el = root.current
    if (!el) return

    let raf = 0
    let x = -100
    let y = -100
    let cx = -100
    let cy = -100

    const onMove = (e: PointerEvent) => {
      x = e.clientX
      y = e.clientY
      const data = (e.target as HTMLElement | null)?.closest?.('[data-cursor]')
      setLabel(data instanceof HTMLElement ? (data.dataset.cursor ?? '') : '')
    }

    const tick = () => {
      // Très légèrement amorti : le réticule suit sans coller, il ne traîne pas.
      cx += (x - cx) * 0.42
      cy += (y - cy) * 0.42
      el.style.transform = `translate3d(${cx}px, ${cy}px, 0)`
      raf = requestAnimationFrame(tick)
    }

    window.addEventListener('pointermove', onMove, { passive: true })
    raf = requestAnimationFrame(tick)
    return () => {
      window.removeEventListener('pointermove', onMove)
      cancelAnimationFrame(raf)
    }
  }, [enabled])

  if (!enabled) return null

  return (
    <div
      ref={root}
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-[65] will-change-transform"
    >
      <span className="absolute -left-3.5 top-0 block h-px w-7 bg-ink/70" />
      <span className="absolute left-0 -top-3.5 block h-7 w-px bg-ink/70" />
      <span className="absolute -left-[3px] -top-[3px] block h-1.5 w-1.5 border border-ink/70" />
      {label && (
        <span
          ref={labelRef}
          className="num absolute left-5 top-2 whitespace-nowrap border border-ink bg-paper-hi px-2 py-1 text-[0.625rem]"
        >
          {label}
        </span>
      )}
    </div>
  )
}
