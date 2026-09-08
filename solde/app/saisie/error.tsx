'use client'

import { useEffect } from 'react'

/**
 * État d'erreur de la saisie. Il dit ce qui s'est passé et ce qu'on peut
 * faire — jamais « une erreur est survenue » tout court.
 */
export default function Erreur({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  const manqueDonnees = error.message.includes('db:seed') || error.message.includes('Aucune société')

  return (
    <main className="mx-auto flex w-full max-w-[60ch] flex-col gap-8 px-6 py-24 sm:px-10">
      <p className="surtitre">La saisie n’a pas pu s’ouvrir</p>
      <p className="text-[19px] leading-[1.5]">
        {manqueDonnees
          ? 'Aucune société n’est enregistrée dans cette base.'
          : 'Les données de la saisie n’ont pas pu être chargées.'}
      </p>
      <p className="text-[15px] leading-[1.6] text-encre-douce">
        {manqueDonnees ? (
          <>
            Lancez <code className="chiffre">npm run db:seed</code> pour créer la
            société de démonstration, son plan comptable et ses journaux.
          </>
        ) : (
          <>
            Aucune écriture n’a été enregistrée : le registre est intact. Vérifiez
            que la base est joignable, puis réessayez.
          </>
        )}
      </p>
      <p className="chiffre text-[13px] text-terre">{error.message}</p>
      <button
        type="button"
        onClick={reset}
        className="self-start rounded-pill px-5 py-3 text-[14px]"
        style={{ backgroundColor: 'var(--c-encre)', color: 'var(--c-papier)' }}
      >
        Réessayer
      </button>
    </main>
  )
}
