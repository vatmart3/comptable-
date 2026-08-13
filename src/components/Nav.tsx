import { useEffect, useState } from 'react'
import { identity, nav, ui } from '../config/site'

/**
 * Le sommaire.
 *
 * Un registre n'a pas de menu déroulant, il a un sommaire folioté. La barre
 * liste les folios dans l'ordre, marque celui où l'on se trouve, et ne cache
 * rien derrière un bouton. Sur petit écran elle défile horizontalement plutôt
 * que de se replier : on garde la lecture continue du sommaire.
 */
const items = nav.slice(0, -1)
const last = nav[nav.length - 1]

export function Nav() {
  const [active, setActive] = useState<string>('')

  useEffect(() => {
    const sections = nav
      .map((n) => document.getElementById(n.id))
      .filter((el): el is HTMLElement => Boolean(el))
    if (!sections.length) return

    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
        if (visible) setActive(visible.target.id)
      },
      { rootMargin: '-45% 0px -50% 0px' },
    )

    sections.forEach((s) => io.observe(s))
    return () => io.disconnect()
  }, [])

  return (
    <>
      <a
        href="#cout"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:bg-stamp focus:px-4 focus:py-2 focus:text-paper-hi"
      >
        {ui.skipLink}
      </a>

      <header className="fixed inset-x-0 top-0 z-50 border-b border-ink bg-paper">
        <div className="sheet pad-rail flex h-[3.25rem] items-center gap-4">
          <a href="#hero" className="display-sm shrink-0 tracking-tight">
            {identity.name}
            <span className="sr-only"> — retour en haut</span>
          </a>

          <nav
            aria-label="Sommaire"
            className="min-w-0 flex-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <ul className="flex items-center gap-0">
              {/* Sous 2xl les libellés sont repliés : sans ce mot, la barre ne
                  serait qu'une suite de nombres. */}
              <li className="shrink-0 pr-1 2xl:hidden">
                <span className="eyebrow text-ink/65">Sommaire</span>
              </li>
              {items.map((item) => {
                const on = active === item.id
                return (
                  <li key={item.id} className="shrink-0">
                    <a
                      href={`#${item.id}`}
                      aria-current={on ? 'true' : undefined}
                      className={`flex items-baseline gap-1.5 border-l border-rule px-2.5 py-1 transition-colors ${
                        on ? 'text-ink' : 'text-ink/65 hover:text-ink/80'
                      }`}
                    >
                      <span className="folio">{item.folio}</span>
                      {/* Un sommaire folioté se lit au numéro. Le libellé du folio
                          courant reste affiché ; les autres reviennent dès qu'il y
                          a la place. Rien n'est replié derrière un bouton. */}
                      <span
                        className={`eyebrow whitespace-nowrap ${on ? '' : 'hidden 2xl:inline'}`}
                      >
                        {item.label}
                      </span>
                    </a>
                  </li>
                )
              })}
            </ul>
          </nav>

          {/* Le dernier folio du sommaire est le bouton. Le registre se termine
              par l'écriture qu'il reste à passer. */}
          <a
            href={`#${last.id}`}
            aria-current={active === last.id ? 'true' : undefined}
            className="btn hidden shrink-0 gap-2 px-4 py-2 text-[0.6875rem] sm:inline-flex"
          >
            <span className="folio opacity-60">{last.folio}</span>
            {last.label}
          </a>
        </div>
      </header>
    </>
  )
}
