import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { ledgerLines, referenceProfile, type LedgerSide } from '../config/site'
import type { Profile } from './simulator'

export interface PostedLine {
  id: string
  date: string
  label: string
  side: LedgerSide
  amount: number
}

interface LedgerState {
  profile: Profile
  /** Vrai dès que le visiteur a terminé le simulateur : ce sont ses chiffres. */
  personalized: boolean
  lines: PostedLine[]
  totalDebit: number
  totalCredit: number
  solde: number
  /** L'écriture du 31/12 est-elle soldée ? Seule la prise de rendez-vous la solde. */
  settled: boolean
  visible: boolean
  post: (id: string) => void
  adopt: (p: Profile) => void
  settle: () => void
  setVisible: (v: boolean) => void
}

const Ctx = createContext<LedgerState | null>(null)

export function LedgerProvider({ children }: { children: ReactNode }) {
  const [posted, setPosted] = useState<string[]>([])
  const [profile, setProfile] = useState<Profile>(referenceProfile)
  const [personalized, setPersonalized] = useState(false)
  const [settled, setSettled] = useState(false)
  const [visible, setVisible] = useState(true)

  /* Une écriture passée ne s'efface pas : on n'enlève jamais une ligne du registre,
     même si le visiteur remonte la page. */
  const post = useCallback((id: string) => {
    setPosted((prev) => (prev.includes(id) ? prev : [...prev, id]))
  }, [])

  const adopt = useCallback((p: Profile) => {
    setProfile(p)
    setPersonalized(true)
  }, [])

  const settle = useCallback(() => setSettled(true), [])

  /* L'ordre affiché est celui du registre (chronologique), pas celui du scroll :
     un visiteur qui remonte puis redescend ne désordonne pas l'exercice. */
  const lines = useMemo<PostedLine[]>(
    () =>
      ledgerLines
        .filter((l) => posted.includes(l.id))
        .map((l) => ({
          id: l.id,
          date: l.date,
          label: l.label,
          side: l.side,
          amount: l.amount(profile),
        })),
    [posted, profile],
  )

  const { totalDebit, totalCredit } = useMemo(() => {
    let d = 0
    let c = 0
    for (const l of lines) (l.side === 'debit' ? (d += l.amount) : (c += l.amount))
    return { totalDebit: d, totalCredit: c }
  }, [lines])

  const value: LedgerState = {
    profile,
    personalized,
    lines,
    totalDebit,
    totalCredit,
    solde: totalCredit - totalDebit,
    settled,
    visible,
    post,
    adopt,
    settle,
    setVisible,
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useLedger(): LedgerState {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useLedger doit être appelé dans <LedgerProvider>')
  return ctx
}

/**
 * Renvoie une ref à poser sur l'élément qui déclenche l'écriture.
 * L'écriture part quand l'élément est franchi, pas quand il apparaît :
 * le seuil est réglé au tiers inférieur de l'écran.
 */
export function useLedgerEntry<T extends HTMLElement>(id: string | null) {
  const ref = useRef<T | null>(null)
  const { post } = useLedger()

  useEffect(() => {
    const el = ref.current
    if (!el || !id) return

    if (typeof IntersectionObserver === 'undefined') {
      post(id)
      return
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            post(id)
            io.disconnect()
          }
        }
      },
      { rootMargin: '0px 0px -28% 0px', threshold: 0.01 },
    )

    io.observe(el)
    return () => io.disconnect()
  }, [id, post])

  return ref
}
