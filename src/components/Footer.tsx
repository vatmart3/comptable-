import { demo, footer, identity } from '../config/site'
import { useLedger } from '../lib/ledger'
import { euro, signedEuro } from '../lib/format'
import { CursorToggle } from './Crosshair'

/* Le pied de registre.
   Pas quatre colonnes de liens : le bas d'un compte, avec ses totaux et son
   double filet de clôture. Le site se termine comme il s'est écrit. */

export function Footer() {
  const { totalDebit, totalCredit, solde, lines } = useLedger()

  return (
    <footer className="bg-ink text-paper" data-surface="ink">
      <div className="sheet pad-rail py-14">
        {/* Totaux de l'exercice */}
        <div className="grid grid-cols-1 gap-x-10 gap-y-4 sm:grid-cols-3">
          <div className="flex items-baseline justify-between gap-4 border-t border-paper pt-3 sm:flex-col sm:items-start sm:gap-2">
            <span className="eyebrow text-paper/55">{footer.totals.debit}</span>
            <span className="display-md num">{euro(totalDebit)}</span>
          </div>
          <div className="flex items-baseline justify-between gap-4 border-t border-paper pt-3 sm:flex-col sm:items-start sm:gap-2">
            <span className="eyebrow text-paper/55">{footer.totals.credit}</span>
            <span className="display-md num">{euro(totalCredit)}</span>
          </div>
          <div className="flex items-baseline justify-between gap-4 border-t border-paper pt-3 sm:flex-col sm:items-start sm:gap-2">
            <span className="eyebrow text-paper/55">{footer.totals.solde}</span>
            {/* Sur fond encre, le rouge de report n'aurait pas le contraste
                requis : le solde négatif est signalé par son signe, pas par sa
                couleur. C'est la seule entorse, et elle est délibérée. */}
            <span className="display-md num">{signedEuro(solde)}</span>
          </div>
        </div>

        <p className="eyebrow mt-4 text-paper/55">
          {lines.length} écriture{lines.length > 1 ? 's' : ''} passée
          {lines.length > 1 ? 's' : ''} pendant votre lecture.
        </p>

        {/* Mentions */}
        <div className="mt-14 grid grid-cols-1 gap-x-12 gap-y-8 border-t border-rule-ink pt-8 lg:grid-cols-[1fr_auto]">
          <div>
            <h2 className="eyebrow text-paper/55">{footer.legalTitle}</h2>
            <ul className="mt-3 space-y-1.5">
              {footer.legal.map((l) => (
                <li key={l} className="max-w-[70ch] text-[0.8125rem] leading-relaxed text-paper/65">
                  {l}
                </li>
              ))}
            </ul>
            {demo && (
              <p className="mt-5 max-w-[70ch] border-l-2 border-paper/40 pl-4 text-[0.8125rem] leading-relaxed text-paper/70">
                {footer.demoLine}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-3 lg:items-end lg:text-right">
            <a
              href={`tel:${identity.phoneHref}`}
              className="num text-[0.9375rem] underline-offset-4 hover:underline"
            >
              {identity.phone}
            </a>
            <a
              href={`mailto:${identity.email}`}
              className="num text-[0.9375rem] underline-offset-4 hover:underline"
            >
              {identity.email}
            </a>
            <CursorToggle className="text-paper/55 hover:text-paper" />
            <p className="eyebrow mt-4 text-paper/55">{footer.credit}</p>
          </div>
        </div>
      </div>
    </footer>
  )
}
