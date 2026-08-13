import { useEffect, useId, useRef, useState } from 'react'
import { ledgerCopy, ledgerPending } from '../config/site'
import { useLedger, type PostedLine } from '../lib/ledger'
import { euro } from '../lib/format'
import { Odometer } from './Odometer'
import { Amount } from './Amount'

/* ─────────────────────────────────────────────────────────────────────────
   LE GRAND LIVRE VIVANT

   Rail fixe tenu comme un registre : DATE · LIBELLÉ · DÉBIT · CRÉDIT.
   Chaque section franchie y écrit une écriture réelle, et le solde se
   recalcule à l'odomètre. La dernière ligne reste ouverte, en pointillés,
   jusqu'à la prise de rendez-vous.

   Contraintes tenues : masquable, accessible au clavier, et il n'écrase
   jamais le contenu — sa largeur réelle est reportée dans `--rail`, que
   la page utilise comme padding.
   ───────────────────────────────────────────────────────────────────── */

function Row({ line, index }: { line: PostedLine; index: number }) {
  return (
    <li
      className="grid grid-cols-[2.6rem_1fr_3.4rem_3.4rem] items-baseline gap-x-1 border-b border-rule/70 py-1.5"
      style={{ animation: `ledger-in 620ms var(--ease-ledger) ${Math.min(index, 4) * 40}ms both` }}
    >
      <span className="num text-[0.625rem] text-ink/65">{line.date}</span>
      <span className="text-[0.6875rem] leading-tight">{line.label}</span>
      <span className="text-right text-[0.6875rem]">
        {line.side === 'debit' ? <Amount value={line.amount} side="debit" /> : null}
      </span>
      <span className="text-right text-[0.6875rem]">
        {line.side === 'credit' ? <Amount value={line.amount} side="credit" /> : null}
      </span>
    </li>
  )
}

function PendingRow({ settled }: { settled: boolean }) {
  return (
    <li
      className={`grid grid-cols-[2.6rem_1fr_3.4rem_3.4rem] items-baseline gap-x-1 py-1.5 ${
        settled ? 'border-b border-rule/70' : 'border-b border-dashed border-ink/45'
      }`}
    >
      <span className="num text-[0.625rem] text-ink/65">{ledgerPending.date}</span>
      <span
        className={`text-[0.6875rem] leading-tight ${settled ? '' : 'italic text-ink/65'}`}
        style={settled ? undefined : { animation: 'pending-breathe 3.4s ease-in-out infinite' }}
      >
        {settled ? ledgerPending.settledLabel : ledgerPending.label}
      </span>
      <span aria-hidden />
      <span className="text-right text-[0.6875rem]">
        {settled ? <Amount value={0} side="credit" /> : <span className="text-ink/65">—</span>}
      </span>
    </li>
  )
}

function Body({ onHide, hideId }: { onHide: () => void; hideId: string }) {
  const { lines, solde, personalized, settled, totalDebit, totalCredit } = useLedger()
  const empty = lines.length === 0

  return (
    <div className="flex h-full flex-col bg-paper-hi">
      {/* En-tête : solde courant */}
      <div className="border-b border-ink px-4 pb-3 pt-4">
        <div className="flex items-baseline justify-between">
          <span className="eyebrow">{ledgerCopy.title}</span>
          <button
            id={hideId}
            type="button"
            onClick={onHide}
            aria-label={ledgerCopy.hideLong}
            className="eyebrow cursor-pointer text-ink/65 underline-offset-4 hover:text-ink hover:underline"
          >
            {ledgerCopy.hide}
          </button>
        </div>

        <div className="mt-3 flex items-baseline justify-between gap-2">
          <span className="label">{ledgerCopy.balance}</span>
          {/* Pas d'aria-live ici : le solde est annoncé une seule fois, par le
              résumé en fin de composant. Deux régions live diraient deux fois
              la même chose. */}
          <span className={`display-md tnum ${solde < 0 ? 'text-debit' : ''}`}>
            <Odometer value={solde} signed />
          </span>
        </div>

        <p className="eyebrow mt-2 text-ink/65">
          {personalized ? ledgerCopy.yours : ledgerCopy.reference}
        </p>
      </div>

      {/* Colonnes */}
      <div className="grid grid-cols-[2.6rem_1fr_3.4rem_3.4rem] gap-x-1 border-b border-rule px-4 py-1.5">
        <span className="folio text-[0.5625rem] text-ink/65">DATE</span>
        <span className="folio text-[0.5625rem] text-ink/65">LIBELLÉ</span>
        <span className="folio text-right text-[0.5625rem] text-ink/65">DÉB.</span>
        <span className="folio text-right text-[0.5625rem] text-ink/65">CRÉD.</span>
      </div>

      {/* Écritures */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4">
        {empty ? (
          <p className="py-4 text-[0.6875rem] leading-relaxed text-ink/65">{ledgerCopy.hint}</p>
        ) : (
          <ul className="pb-2">
            {lines.map((l, i) => (
              <Row key={l.id} line={l} index={i} />
            ))}
            <PendingRow settled={settled} />
          </ul>
        )}
      </div>

      {/* Pied : totaux, tracés seulement une fois l'exercice soldé */}
      {settled && (
        <div className="rule-close mx-4 mb-4 mt-1 pt-3">
          <dl className="space-y-1 text-[0.6875rem]">
            <div className="flex justify-between">
              <dt className="text-ink/65">Total débit</dt>
              <dd>
                <Amount value={totalDebit} side="debit" />
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink/65">Total crédit</dt>
              <dd>
                <Amount value={totalCredit} side="credit" />
              </dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  )
}

export function Ledger() {
  const { visible, setVisible, solde, lines, settled } = useLedger()
  const railRef = useRef<HTMLElement | null>(null)
  const [open, setOpen] = useState(false)
  const hideId = useId()
  const panelId = useId()

  /* La largeur réelle du rail est reportée dans `--rail`. La page s'y adapte :
     le contenu n'est jamais recouvert, et masquer le rail rend la largeur. */
  useEffect(() => {
    const el = railRef.current
    const root = document.documentElement
    if (!el || !visible) {
      root.style.setProperty('--rail', '0px')
      return
    }
    const ro = new ResizeObserver(([entry]) => {
      root.style.setProperty('--rail', `${entry.contentRect.width}px`)
    })
    ro.observe(el)
    return () => {
      ro.disconnect()
      root.style.setProperty('--rail', '0px')
    }
  }, [visible])

  const lastLine = lines[lines.length - 1]

  return (
    <>
      {/* ── Desktop : colonne fixe en bord d'écran ─────────────────────── */}
      {visible && (
        <aside
          ref={railRef}
          aria-label={ledgerCopy.title}
          className="fixed right-0 top-[3.25rem] z-40 hidden h-[calc(100dvh-3.25rem)] w-[17.5rem] border-l border-ink lg:block xl:w-[20rem]"
        >
          <Body onHide={() => setVisible(false)} hideId={hideId} />
        </aside>
      )}

      {/* Onglet de rappel quand le rail est masqué */}
      {!visible && (
        <button
          type="button"
          onClick={() => setVisible(true)}
          className="fixed right-0 top-1/2 z-40 hidden -translate-y-1/2 cursor-pointer border-y border-l border-ink bg-paper-hi px-2 py-5 lg:block"
        >
          <span className="eyebrow [writing-mode:vertical-rl]">{ledgerCopy.show}</span>
        </button>
      )}

      {/* ── Mobile : barre basse compacte, dépliable ───────────────────── */}
      <div className="fixed inset-x-0 bottom-0 z-40 lg:hidden">
        {open && (
          <div
            id={panelId}
            className="max-h-[62vh] overflow-hidden border-t border-ink bg-paper-hi"
          >
            <div className="flex h-[62vh] flex-col">
              <Body onHide={() => setOpen(false)} hideId={`${hideId}-m`} />
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={panelId}
          className="flex w-full cursor-pointer items-center justify-between gap-3 border-t border-ink bg-paper-hi px-4 py-3 text-left"
        >
          <span className="min-w-0 flex-1">
            <span className="eyebrow block text-ink/65">{ledgerCopy.title}</span>
            <span className="block truncate text-[0.6875rem]">
              {settled
                ? ledgerPending.settledLabel
                : lastLine
                  ? `${lastLine.date} · ${lastLine.label}`
                  : ledgerPending.label}
            </span>
          </span>
          <span className="flex items-baseline gap-2">
            <span className={`num text-sm ${solde < 0 ? 'text-debit' : ''}`}>
              <Odometer value={solde} signed />
            </span>
            <span aria-hidden className="eyebrow text-ink/65">
              {open ? '▾' : '▴'}
            </span>
          </span>
        </button>
      </div>

      {/* Résumé textuel : ce que le rail dit, en une phrase, pour les lecteurs
          d'écran qui ne parcourent pas le tableau. */}
      <p className="sr-only" aria-live="polite">
        {`Grand livre : ${lines.length} écriture${lines.length > 1 ? 's' : ''}, solde ${euro(solde)}.`}
      </p>
    </>
  )
}
