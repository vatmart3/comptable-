import { describe, expect, it } from 'vitest'
import {
  checkLettering,
  letterAt,
  letterIndex,
  nextLetter,
  proposeMatches,
  soldeOuvert,
  type LetterableLine,
} from '@/lib/accounting/lettering'

function ligne(
  id: string,
  debit: number,
  credit: number,
  date: string,
  extra: Partial<LetterableLine> = {},
): LetterableLine {
  return {
    id,
    accountNumero: '411DUP',
    date: new Date(date),
    libelle: 'x',
    debit,
    credit,
    lettre: null,
    ...extra,
  }
}

describe('suite de lettres', () => {
  it('va de A à Z puis AA', () => {
    expect(letterAt(1)).toBe('A')
    expect(letterAt(26)).toBe('Z')
    expect(letterAt(27)).toBe('AA')
    expect(letterAt(28)).toBe('AB')
    expect(letterAt(52)).toBe('AZ')
    expect(letterAt(53)).toBe('BA')
    expect(letterAt(702)).toBe('ZZ')
    expect(letterAt(703)).toBe('AAA')
  })

  it('fait l’aller-retour lettre ↔ index', () => {
    for (const index of [1, 26, 27, 100, 702, 703]) {
      expect(letterIndex(letterAt(index))).toBe(index)
    }
  })

  it('ne réutilise jamais une lettre libérée', () => {
    expect(nextLetter(['A', 'B', 'D'])).toBe('E')
    expect(nextLetter([])).toBe('A')
    expect(nextLetter(['Z'])).toBe('AA')
  })
})

describe('validité d’un lettrage', () => {
  it('accepte un groupe soldé sur un compte lettrable', () => {
    const verdict = checkLettering([
      ligne('1', 120_000, 0, '2025-01-10'),
      ligne('2', 0, 120_000, '2025-02-05'),
    ])
    expect(verdict.ok).toBe(true)
    expect(verdict.ecart).toBe(0)
  })

  it('refuse des comptes différents', () => {
    const verdict = checkLettering([
      ligne('1', 120_000, 0, '2025-01-10'),
      ligne('2', 0, 120_000, '2025-02-05', { accountNumero: '401FOU' }),
    ])
    expect(verdict.problems.map((p) => p.code)).toContain('comptes_differents')
  })

  it('refuse un compte non lettrable', () => {
    const verdict = checkLettering([
      ligne('1', 120_000, 0, '2025-01-10', { accountNumero: '606100' }),
      ligne('2', 0, 120_000, '2025-02-05', { accountNumero: '606100' }),
    ])
    expect(verdict.problems.map((p) => p.code)).toContain('compte_non_lettrable')
  })

  it('refuse un groupe qui ne se solde pas', () => {
    const verdict = checkLettering([
      ligne('1', 120_000, 0, '2025-01-10'),
      ligne('2', 0, 100_000, '2025-02-05'),
    ])
    expect(verdict.problems.map((p) => p.code)).toContain('ecart')
    expect(verdict.ecart).toBe(20_000)
  })

  it('accepte le lettrage partiel quand il est demandé', () => {
    const verdict = checkLettering(
      [ligne('1', 120_000, 0, '2025-01-10'), ligne('2', 0, 100_000, '2025-02-05')],
      { autoriserPartiel: true },
    )
    expect(verdict.ok).toBe(true)
    expect(verdict.partiel).toBe(true)
    expect(verdict.ecart).toBe(20_000)
  })

  it('refuse un groupe à sens unique', () => {
    const verdict = checkLettering([
      ligne('1', 120_000, 0, '2025-01-10'),
      ligne('2', 100_000, 0, '2025-02-05'),
    ])
    expect(verdict.problems.map((p) => p.code)).toContain('un_seul_sens')
  })

  it('refuse une ligne déjà lettrée', () => {
    const verdict = checkLettering([
      ligne('1', 120_000, 0, '2025-01-10', { lettre: 'A' }),
      ligne('2', 0, 120_000, '2025-02-05'),
    ])
    expect(verdict.problems.map((p) => p.code)).toContain('deja_lettre')
  })
})

describe('propositions — Le Lettrage Magnétique', () => {
  it('apparie facture et règlement de même montant', () => {
    const matches = proposeMatches([
      ligne('f1', 120_000, 0, '2025-01-10', { pieceRef: 'FA-0042' }),
      ligne('r1', 0, 120_000, '2025-01-12', { libelle: 'VIR DUPONT FA-0042' }),
    ])
    expect(matches).toHaveLength(1)
    expect(matches[0]?.montant).toBe(120_000)
    expect(matches[0]?.score).toBeGreaterThan(920)
  })

  it('note plus bas un règlement éloigné dans le temps', () => {
    const proche = proposeMatches([
      ligne('f1', 120_000, 0, '2025-01-10'),
      ligne('r1', 0, 120_000, '2025-01-11'),
    ])
    const lointain = proposeMatches([
      ligne('f2', 120_000, 0, '2025-01-10'),
      ligne('r2', 0, 120_000, '2025-09-30'),
    ])
    expect(proche[0]!.score).toBeGreaterThan(lointain[0]!.score)
  })

  it('n’apparie jamais deux fois la même ligne', () => {
    const matches = proposeMatches([
      ligne('f1', 120_000, 0, '2025-01-10'),
      ligne('f2', 120_000, 0, '2025-01-11'),
      ligne('r1', 0, 120_000, '2025-01-12'),
    ])
    expect(matches).toHaveLength(1)
    const utilisees = [...matches[0]!.debitIds, ...matches[0]!.creditIds]
    expect(new Set(utilisees).size).toBe(utilisees.length)
  })

  it('ignore les lignes déjà lettrées', () => {
    const matches = proposeMatches([
      ligne('f1', 120_000, 0, '2025-01-10', { lettre: 'A' }),
      ligne('r1', 0, 120_000, '2025-01-12', { lettre: 'A' }),
    ])
    expect(matches).toEqual([])
  })

  it('ne propose rien quand les montants diffèrent', () => {
    expect(
      proposeMatches([ligne('f1', 120_000, 0, '2025-01-10'), ligne('r1', 0, 119_000, '2025-01-12')]),
    ).toEqual([])
  })
})

describe('solde ouvert', () => {
  it('ne compte que les lignes non lettrées', () => {
    expect(
      soldeOuvert([
        ligne('1', 120_000, 0, '2025-01-10', { lettre: 'A' }),
        ligne('2', 0, 120_000, '2025-01-12', { lettre: 'A' }),
        ligne('3', 80_000, 0, '2025-03-01'),
      ]),
    ).toBe(80_000)
  })
})
