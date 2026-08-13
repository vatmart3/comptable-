import { euro, signedEuro } from '../lib/format'

/**
 * Compteur à rouleau. Chaque chiffre est une colonne de 0 à 9 qui se translate.
 * Les unités roulent en premier, les milliers en dernier — comme un compteur réel.
 *
 * Aucun saut visuel : la valeur ne se remplace jamais, elle se déplace. C'est le
 * seul mouvement toléré sur un chiffre dans tout le site.
 */
function Digit({ d, delay }: { d: number; delay: number }) {
  return (
    <span
      aria-hidden
      className="relative inline-block h-[1em] w-[1ch] overflow-hidden align-[-0.115em] leading-none"
    >
      <span
        className="flex flex-col"
        style={{
          transform: `translateY(-${d}em)`,
          transition: `transform 720ms var(--ease-ledger) ${delay}ms`,
        }}
      >
        {Array.from({ length: 10 }, (_, n) => (
          <span key={n} className="block h-[1em] leading-none">
            {n}
          </span>
        ))}
      </span>
    </span>
  )
}

export function Odometer({
  value,
  signed = false,
  className = '',
}: {
  value: number
  signed?: boolean
  className?: string
}) {
  const text = signed ? signedEuro(value) : euro(value)
  const chars = Array.from(text)
  const last = chars.length - 1

  return (
    <span className={`num inline-flex items-baseline whitespace-nowrap ${className}`}>
      {/* Le texte complet est lu d'un bloc par les lecteurs d'écran ;
          les colonnes de chiffres, elles, sont masquées. */}
      <span className="sr-only">{text}</span>
      {chars.map((c, i) => {
        if (/\d/.test(c)) return <Digit key={i} d={Number(c)} delay={(last - i) * 28} />
        // Intl utilise une espace fine insécable (U+202F) comme séparateur de
        // milliers : on lui donne une largeur fixe pour que rien ne bouge.
        const isSpace = /\s/u.test(c)
        return (
          <span key={i} aria-hidden className={isSpace ? 'inline-block w-[0.3ch]' : ''}>
            {isSpace ? '' : c}
          </span>
        )
      })}
    </span>
  )
}
