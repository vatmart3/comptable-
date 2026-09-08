/**
 * État de chargement de la saisie. Il reprend la structure de l'écran plutôt
 * qu'un spinner : la page ne doit pas sauter quand les données arrivent.
 */
export default function Chargement() {
  return (
    <main className="mx-auto flex w-full max-w-[92ch] flex-col gap-12 px-6 pt-16 pb-24 sm:px-10">
      <div className="flex items-start justify-between gap-8">
        <div className="flex flex-col gap-3">
          <p className="surtitre">Saisie</p>
          <div className="h-4 w-[34ch] max-w-full rounded-pill bg-papier-creux" />
          <div className="h-4 w-[26ch] max-w-full rounded-pill bg-papier-creux" />
        </div>
        <div className="h-[180px] w-[220px] rounded-carte bg-papier-creux" />
      </div>
      <div className="flex flex-col gap-4">
        <div className="h-9 w-[24ch] max-w-full rounded-pill bg-papier-creux" />
        <div className="h-px w-full bg-trait" />
      </div>
      <p className="sr-only" role="status">
        Chargement du plan comptable et des journaux.
      </p>
    </main>
  )
}
