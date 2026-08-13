import { hero } from '../../config/site'

/* La même balance, dessinée.
 *
 * `wire`  — état de chargement de la scène 3D. Un tracé de fil de fer qui se
 *           dessine : jamais un spinner, qui n'aurait rien à voir avec le sujet.
 * `solid` — repli si WebGL est indisponible. La scène à l'équilibre, en dur.
 *
 * Un seul dessin sert les deux cas : ils ne peuvent pas diverger.
 */

const SHEETS = [0, 1, 2, 3, 4]

function Pan({ x, variant }: { x: number; variant: 'wire' | 'solid' }) {
  const cy = 332
  const solid = variant === 'solid'
  return (
    <g>
      {/* Suspentes */}
      <path d={`M ${x} 200 L ${x - 78} ${cy - 6}`} />
      <path d={`M ${x} 200 L ${x + 78} ${cy - 6}`} />
      <path d={`M ${x} 200 L ${x} ${cy + 16}`} />
      {/* Plateau */}
      <ellipse cx={x} cy={cy} rx={80} ry={19} fill={solid ? 'var(--color-rule)' : 'none'} />
      <path
        d={`M ${x - 80} ${cy} v 7 a 80 19 0 0 0 160 0 v -7`}
        fill={solid ? 'var(--color-ink)' : 'none'}
        opacity={solid ? 0.82 : 1}
      />
      {/* Les documents, rangés à plat */}
      {SHEETS.map((i) => {
        const y = cy - 8 - i * 7
        return (
          <path
            key={i}
            d={`M ${x - 44} ${y} L ${x + 4} ${y - 13} L ${x + 44} ${y} L ${x - 4} ${y + 13} Z`}
            fill={solid ? 'var(--color-paper-hi)' : 'none'}
          />
        )
      })}
    </g>
  )
}

export function BalanceDrawing({
  variant = 'wire',
  className = '',
}: {
  variant?: 'wire' | 'solid'
  className?: string
}) {
  const solid = variant === 'solid'

  return (
    <svg
      viewBox="0 0 800 600"
      className={className}
      role="img"
      aria-label={
        solid ? 'Une balance à deux plateaux, à l’équilibre, documents rangés.' : hero.alt
      }
      style={{
        stroke: 'var(--color-ink)',
        strokeWidth: solid ? 1.25 : 1,
        fill: 'none',
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        opacity: solid ? 1 : 0.5,
      }}
    >
      <g style={solid ? undefined : { animation: 'draw-in 2.2s var(--ease-ledger) forwards' }}
         strokeDasharray={solid ? undefined : 2400}
         strokeDashoffset={solid ? undefined : 2400}>
        {/* Socle */}
        <ellipse cx={400} cy={520} rx={122} ry={27} fill={solid ? 'var(--color-rule)' : 'none'} />
        <path
          d="M 278 520 v 9 a 122 27 0 0 0 244 0 v -9"
          fill={solid ? 'var(--color-ink)' : 'none'}
        />
        {/* Colonne */}
        <path
          d="M 391 205 h 18 l 7 310 h -32 z"
          fill={solid ? 'var(--color-ink)' : 'none'}
        />
        {/* Graduation : trois repères, celui du milieu plus long */}
        <path d="M 366 138 l -6 -14 M 400 130 v -18 M 434 138 l 6 -14" />
        {/* Aiguille, au zéro */}
        <path d="M 400 196 v -60" stroke="var(--color-stamp)" strokeWidth={solid ? 3 : 2} />
        {/* Fléau, horizontal */}
        <path
          d="M 140 194 h 520 v 13 h -520 z"
          fill={solid ? 'var(--color-ink)' : 'none'}
        />
        <circle cx={400} cy={200} r={15} fill={solid ? 'var(--color-rule)' : 'none'} />

        <Pan x={140} variant={variant} />
        <Pan x={660} variant={variant} />
      </g>
    </svg>
  )
}
