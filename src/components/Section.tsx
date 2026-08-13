import type { ReactNode } from 'react'

/**
 * L'ossature commune : un filet, un folio dans la colonne de gauche, le titre
 * dans la colonne de libellé. Aucune section n'est centrée — la colonne de
 * folio tient l'alignement de bout en bout, comme un numéro de compte.
 */
export function Section({
  id,
  folio,
  title,
  intro,
  aside,
  surface = 'paper',
  children,
}: {
  id: string
  folio: string
  title: string
  intro?: string
  aside?: ReactNode
  surface?: 'paper' | 'ink'
  children: ReactNode
}) {
  const ink = surface === 'ink'
  return (
    <section
      id={id}
      data-surface={surface}
      aria-labelledby={`${id}-titre`}
      className={ink ? 'bg-ink text-paper' : ''}
    >
      <div className="sheet pad-rail">
        <div className="rule-t grid grid-cols-1 gap-x-8 gap-y-6 pb-16 pt-14 md:grid-cols-[4.5rem_1fr] md:pb-24 md:pt-20">
          <div className="flex items-start md:pt-1.5">
            <span className={`folio ${ink ? 'text-paper/55' : 'text-ink/65'}`}>{folio}</span>
          </div>

          <div>
            <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
              <h2 id={`${id}-titre`} className="display-lg max-w-[22ch]">
                {title}
              </h2>
              {aside}
            </div>
            {intro && (
              <p className={`lede mt-6 ${ink ? 'text-paper/75' : 'text-ink/75'}`}>{intro}</p>
            )}
            <div className="mt-12">{children}</div>
          </div>
        </div>
      </div>
    </section>
  )
}
