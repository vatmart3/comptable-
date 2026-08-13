import { euro, signedEuro } from '../lib/format'

/**
 * Un montant.
 *
 * Règle de couleur tenue dans tout le site : `--debit` n'apparaît QUE sur un
 * montant porté au débit ou sur un solde négatif. Nulle part ailleurs. Ce n'est
 * pas une couleur d'accent, c'est le rouge de report d'un livre de comptes.
 */
export function Amount({
  value,
  side,
  signed = false,
  className = '',
}: {
  value: number
  side?: 'debit' | 'credit'
  signed?: boolean
  className?: string
}) {
  const negative = signed ? value < 0 : side === 'debit'
  const text = signed ? signedEuro(value) : euro(value)

  return (
    <span
      className={`num tnum ${negative && value !== 0 ? 'text-debit' : ''} ${className}`}
      /* Un montant au débit ne doit pas dépendre de la seule couleur pour être
         compris : le mot est donné aux lecteurs d'écran. */
      aria-label={side ? `${text} au ${side === 'debit' ? 'débit' : 'crédit'}` : undefined}
    >
      {text}
    </span>
  )
}
