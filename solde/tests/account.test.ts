import { describe, expect, it } from 'vitest'
import {
  accountClass,
  accountNature,
  collectiveOf,
  compareAccountNumbers,
  depreciationAccountFor,
  isCollective,
  isDepreciableAsset,
  isLettrable,
  isTreasury,
  isValidAccountNumber,
  isVatAccount,
  naturalSide,
} from '@/lib/accounting/account'
import { PCG } from '@/prisma/data/pcg'

describe('grammaire du numéro de compte', () => {
  it('lit la classe dans le premier chiffre', () => {
    expect(accountClass('606100')).toBe(6)
    expect(accountClass('101000')).toBe(1)
    expect(accountClass('809000')).toBe(8)
  })

  it('refuse un numéro hors plan', () => {
    expect(isValidAccountNumber('906100')).toBe(false)
    expect(isValidAccountNumber('0')).toBe(false)
    expect(isValidAccountNumber('6')).toBe(false)
    expect(isValidAccountNumber('60A100')).toBe(false)
    expect(isValidAccountNumber('606100')).toBe(true)
    expect(() => accountClass('abc')).toThrow()
  })

  it('sépare bilan et gestion', () => {
    expect(accountNature('218300')).toBe('bilan')
    expect(accountNature('512000')).toBe('bilan')
    expect(accountNature('606100')).toBe('gestion')
    expect(accountNature('706000')).toBe('gestion')
    expect(accountNature('801000')).toBe('special')
  })

  it('connaît le sens naturel du solde', () => {
    expect(naturalSide('101000')).toBe('credit')
    expect(naturalSide('218300')).toBe('debit')
    expect(naturalSide('281830')).toBe('credit')
    expect(naturalSide('401000')).toBe('credit')
    expect(naturalSide('411000')).toBe('debit')
    expect(naturalSide('512000')).toBe('mixte')
    expect(naturalSide('606100')).toBe('debit')
    expect(naturalSide('706000')).toBe('credit')
  })
})

describe('familles de comptes', () => {
  it('désigne les comptes lettrables', () => {
    expect(isLettrable('401000')).toBe(true)
    expect(isLettrable('411000')).toBe(true)
    expect(isLettrable('471000')).toBe(true)
    expect(isLettrable('512000')).toBe(false)
    expect(isLettrable('606100')).toBe(false)
  })

  it('désigne les comptes collectifs et leurs auxiliaires', () => {
    expect(isCollective('411000')).toBe(true)
    expect(isCollective('411DUP')).toBe(false)
    expect(collectiveOf('411DUP')).toBe('411000')
    expect(collectiveOf('401TOT')).toBe('401000')
  })

  it('désigne la trésorerie et la TVA', () => {
    expect(isTreasury('512000')).toBe(true)
    expect(isTreasury('530000')).toBe(true)
    expect(isTreasury('580000')).toBe(true)
    expect(isVatAccount('445711')).toBe(true)
    expect(isVatAccount('444000')).toBe(false)
  })

  it('sait ce qui s’amortit — un terrain, jamais', () => {
    expect(isDepreciableAsset('218300')).toBe(true)
    expect(isDepreciableAsset('213100')).toBe(true)
    expect(isDepreciableAsset('211000')).toBe(false)
    expect(isDepreciableAsset('261000')).toBe(false)
    expect(isDepreciableAsset('281830')).toBe(false)
    expect(isDepreciableAsset('606100')).toBe(false)
  })

  it('déduit le compte d’amortissement du compte d’immobilisation', () => {
    expect(depreciationAccountFor('218300')).toBe('281830')
    expect(depreciationAccountFor('213100')).toBe('281310')
    expect(() => depreciationAccountFor('606100')).toThrow()
  })
})

describe('tri', () => {
  it('ordonne dans l’ordre du plan comptable, pas numériquement', () => {
    const comptes = ['706000', '101000', '512000', '445711', '411000']
    expect([...comptes].sort(compareAccountNumbers)).toEqual([
      '101000',
      '411000',
      '445711',
      '512000',
      '706000',
    ])
  })
})

describe('plan comptable seedé', () => {
  it('contient les comptes des huit classes', () => {
    const classes = new Set(PCG.map((compte) => accountClass(compte.numero)))
    expect([...classes].sort()).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  })

  it('n’a que des numéros valides et uniques', () => {
    const numeros = new Set<string>()
    for (const compte of PCG) {
      expect(isValidAccountNumber(compte.numero)).toBe(true)
      expect(compte.numero).toHaveLength(6)
      expect(numeros.has(compte.numero)).toBe(false)
      numeros.add(compte.numero)
      expect(compte.libelle.length).toBeGreaterThan(2)
    }
  })

  it('contient tous les comptes dont le moteur a besoin', () => {
    const requis = [
      '401000', '411000', '445510', '445620', '445660', '445670',
      '445711', '445712', '445713', '445714', '445720',
      '471000', '512000', '530000', '580000',
      '120000', '129000', '110000', '119000', '106100', '457000',
      '681120', '675000', '775000',
    ]
    const numeros = new Set(PCG.map((compte) => compte.numero))
    for (const numero of requis) {
      expect(numeros.has(numero), `compte ${numero} manquant du PCG`).toBe(true)
    }
  })

  it('déclare un taux de TVA cohérent quand il en déclare un', () => {
    for (const compte of PCG) {
      if (compte.tauxTva == null) continue
      expect([20_000, 10_000, 5_500, 2_100]).toContain(compte.tauxTva)
    }
  })
})
