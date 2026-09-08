import { describe, expect, it } from 'vitest'
import {
  chain,
  computeHash,
  fingerprint,
  GENESIS_HASH,
  verifyChain,
  type ChainableEntry,
} from '@/lib/accounting/chain'

function ecriture(numero: number, montant: number, libelle = 'Achat carburant'): ChainableEntry {
  return {
    journalCode: 'AC',
    numero,
    date: new Date(`2025-03-${String((numero % 28) + 1).padStart(2, '0')}`),
    libelle,
    pieceRef: `FA-${numero}`,
    lines: [
      { accountNumero: '606100', debit: montant, credit: 0, libelle },
      { accountNumero: '401000', debit: 0, credit: montant, libelle },
    ],
  }
}

describe('empreinte', () => {
  it('est déterministe', () => {
    expect(fingerprint(ecriture(1, 24_000))).toBe(fingerprint(ecriture(1, 24_000)))
  })

  it('change dès qu’un centime bouge', () => {
    expect(fingerprint(ecriture(1, 24_000))).not.toBe(fingerprint(ecriture(1, 24_001)))
  })

  it('change si le libellé change', () => {
    expect(fingerprint(ecriture(1, 24_000))).not.toBe(fingerprint(ecriture(1, 24_000, 'Autre')))
  })

  it('est recalculable à la main : c’est du texte, pas un binaire', () => {
    const empreinte = fingerprint(ecriture(1, 24_000))
    expect(empreinte).toContain('606100~240,00~0,00')
    expect(empreinte).toContain('AC~1~2025-03-02')
  })
})

describe('chaînage', () => {
  it('part du hash de genèse', () => {
    const chainee = chain([ecriture(1, 24_000)])
    expect(chainee[0]?.hashPrecedent).toBe(GENESIS_HASH)
    expect(chainee[0]?.chainIndex).toBe(1)
    expect(chainee[0]?.hash).toHaveLength(64)
  })

  it('lie chaque maillon au précédent', () => {
    const chainee = chain([ecriture(1, 1_000), ecriture(2, 2_000), ecriture(3, 3_000)])
    expect(chainee[1]?.hashPrecedent).toBe(chainee[0]?.hash)
    expect(chainee[2]?.hashPrecedent).toBe(chainee[1]?.hash)
    expect(chainee[2]?.chainIndex).toBe(3)
  })

  it('reprend une chaîne existante', () => {
    const premiere = chain([ecriture(1, 1_000)])
    const suite = chain([ecriture(2, 2_000)], {
      hash: premiere[0]?.hash ?? GENESIS_HASH,
      index: 1,
    })
    expect(suite[0]?.chainIndex).toBe(2)
    expect(suite[0]?.hashPrecedent).toBe(premiere[0]?.hash)
  })
})

describe('vérification — le registre est inviolable', () => {
  const chainee = chain([ecriture(1, 1_000), ecriture(2, 2_000), ecriture(3, 3_000)])

  it('valide une chaîne intacte', () => {
    const verdict = verifyChain(chainee)
    expect(verdict.ok).toBe(true)
    expect(verdict.verifiees).toBe(3)
    expect(verdict.ruptures).toHaveLength(0)
  })

  it('détecte un montant modifié après validation', () => {
    const altered = chainee.map((entry, index) =>
      index === 1
        ? {
            ...entry,
            lines: [
              { ...entry.lines[0]!, debit: 999_999 },
              { ...entry.lines[1]!, credit: 999_999 },
            ],
          }
        : entry,
    )
    const verdict = verifyChain(altered)
    expect(verdict.ok).toBe(false)
    expect(verdict.ruptures.some((r) => r.kind === 'hash_altere' && r.chainIndex === 2)).toBe(true)
  })

  it('détecte une écriture supprimée', () => {
    const verdict = verifyChain([chainee[0]!, chainee[2]!])
    expect(verdict.ok).toBe(false)
    expect(verdict.ruptures.some((r) => r.kind === 'index_manquant' && r.chainIndex === 2)).toBe(true)
    expect(verdict.ruptures.some((r) => r.kind === 'maillon_rompu')).toBe(true)
  })

  it('détecte une écriture intercalée', () => {
    const intruse = {
      ...ecriture(99, 50_000),
      chainIndex: 2,
      hash: computeHash(ecriture(99, 50_000), chainee[0]!.hash),
      hashPrecedent: chainee[0]!.hash,
    }
    const verdict = verifyChain([chainee[0]!, intruse, chainee[1]!, chainee[2]!])
    expect(verdict.ok).toBe(false)
    expect(verdict.ruptures.some((r) => r.kind === 'index_duplique')).toBe(true)
  })

  it('détecte un libellé retouché sans toucher aux montants', () => {
    const altered = chainee.map((entry, index) =>
      index === 0 ? { ...entry, libelle: 'Libellé blanchi' } : entry,
    )
    const verdict = verifyChain(altered)
    expect(verdict.ok).toBe(false)
    expect(verdict.ruptures[0]?.chainIndex).toBe(1)
  })

  it('rend le dernier hash valide comme point de reprise', () => {
    const verdict = verifyChain(chainee)
    expect(verdict.dernierHash).toBe(chainee[2]?.hash)
  })
})
