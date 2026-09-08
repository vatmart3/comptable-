import { describe, expect, it } from 'vitest'
import { detectAnomalies, radarPosition, type AuditEntry } from '@/lib/accounting/anomalies'
import { can, permissionsOf } from '@/lib/accounting/roles'

function ecriture(overrides: Partial<AuditEntry> & { id: string }): AuditEntry {
  return {
    journalCode: 'AC',
    numero: 1,
    fiscalYearId: 'ex2025',
    date: new Date(Date.UTC(2025, 2, 4)), // un mardi
    libelle: 'Facture Total',
    pieceRef: 'FA-1',
    statut: 'validee',
    lines: [
      { accountNumero: '606100', debit: 20_000, credit: 0 },
      { accountNumero: '445660', debit: 4_000, credit: 0 },
      { accountNumero: '401000', debit: 0, credit: 24_000 },
    ],
    ...overrides,
  }
}

describe('radar d’anomalies', () => {
  it('ne dit rien d’un exercice sain', () => {
    expect(detectAnomalies([ecriture({ id: 'a' })])).toEqual([])
  })

  it('détecte un doublon', () => {
    const anomalies = detectAnomalies([
      ecriture({ id: 'a', numero: 1 }),
      ecriture({ id: 'b', numero: 2 }),
    ])
    const doublon = anomalies.find((a) => a.code === 'doublon')
    expect(doublon?.entryIds).toEqual(['a', 'b'])
    expect(doublon?.gravite).toBe(3)
  })

  it('détecte une TVA qui ne correspond à aucun taux légal', () => {
    const anomalies = detectAnomalies([
      ecriture({
        id: 'a',
        lines: [
          { accountNumero: '606100', debit: 20_000, credit: 0 },
          { accountNumero: '445660', debit: 1_400, credit: 0 },
          { accountNumero: '401000', debit: 0, credit: 21_400 },
        ],
      }),
    ])
    expect(anomalies.some((a) => a.code === 'tva_incoherente')).toBe(true)
  })

  it('accepte les taux légaux sans broncher', () => {
    for (const [base, tva] of [
      [20_000, 4_000],
      [20_000, 2_000],
      [20_000, 1_100],
      [20_000, 420],
    ] as const) {
      const anomalies = detectAnomalies([
        ecriture({
          id: 'a',
          lines: [
            { accountNumero: '606100', debit: base, credit: 0 },
            { accountNumero: '445660', debit: tva, credit: 0 },
            { accountNumero: '401000', debit: 0, credit: base + tva },
          ],
        }),
      ])
      expect(anomalies.filter((a) => a.code === 'tva_incoherente')).toEqual([])
    }
  })

  it('signale une écriture datée un dimanche', () => {
    const anomalies = detectAnomalies([
      ecriture({ id: 'a', date: new Date(Date.UTC(2025, 2, 9)) }),
    ])
    expect(anomalies.some((a) => a.code === 'date_week_end')).toBe(true)
  })

  it('ne signale pas les à-nouveaux datés un week-end', () => {
    const anomalies = detectAnomalies([
      ecriture({ id: 'a', journalCode: 'AN', date: new Date(Date.UTC(2025, 2, 9)) }),
    ])
    expect(anomalies.some((a) => a.code === 'date_week_end')).toBe(false)
  })

  it('remonte tout usage du compte d’attente 471', () => {
    const anomalies = detectAnomalies([
      ecriture({
        id: 'a',
        lines: [
          { accountNumero: '471000', debit: 24_000, credit: 0 },
          { accountNumero: '512000', debit: 0, credit: 24_000 },
        ],
      }),
    ])
    const attente = anomalies.find((a) => a.code === 'compte_attente')
    expect(attente?.gravite).toBe(3)
    expect(attente?.montant).toBe(24_000)
  })

  it('détecte un trou dans la séquence d’un journal', () => {
    const anomalies = detectAnomalies([
      ecriture({ id: 'a', numero: 1, libelle: 'A' }),
      ecriture({ id: 'b', numero: 3, libelle: 'B' }),
    ])
    expect(anomalies.some((a) => a.code === 'sequence_trou' && a.axe === 'registre')).toBe(true)
  })

  it('ignore les brouillons — ils n’ont pas encore de numéro définitif', () => {
    const anomalies = detectAnomalies([
      ecriture({ id: 'a', numero: 1, statut: 'brouillon' }),
      ecriture({ id: 'b', numero: 1, statut: 'brouillon', libelle: 'Autre' }),
    ])
    expect(anomalies).toEqual([])
  })

  it('signale un compte inhabituel pour un tiers connu', () => {
    const habitudes = new Map([['TOTAL', new Set(['606100'])]])
    const anomalies = detectAnomalies(
      [
        ecriture({
          id: 'a',
          lines: [
            { accountNumero: '623000', debit: 20_000, credit: 0, partnerCode: 'TOTAL' },
            { accountNumero: '445660', debit: 4_000, credit: 0 },
            { accountNumero: '401000', debit: 0, credit: 24_000, partnerCode: 'TOTAL' },
          ],
        }),
      ],
      { habitudes },
    )
    expect(anomalies.some((a) => a.code === 'compte_inhabituel')).toBe(true)
  })

  it('signale un montant aberrant au regard de l’historique du tiers', () => {
    const historique = new Map([['TOTAL', [20_000, 21_000, 19_500, 20_500, 20_200]]])
    const anomalies = detectAnomalies(
      [
        ecriture({
          id: 'a',
          lines: [
            { accountNumero: '606100', debit: 900_000, credit: 0, partnerCode: 'TOTAL' },
            { accountNumero: '401000', debit: 0, credit: 900_000, partnerCode: 'TOTAL' },
          ],
        }),
      ],
      { historiqueParTiers: historique },
    )
    expect(anomalies.some((a) => a.code === 'montant_aberrant')).toBe(true)
  })

  it('trie les anomalies par gravité décroissante', () => {
    const anomalies = detectAnomalies([
      ecriture({ id: 'a', numero: 1, date: new Date(Date.UTC(2025, 2, 9)) }),
      ecriture({ id: 'b', numero: 3, libelle: 'Autre' }),
    ])
    expect(anomalies[0]?.gravite).toBe(3)
  })
})

describe('positionnement sur le radar', () => {
  it('donne un angle par axe et un rayon par gravité', () => {
    const position = radarPosition({
      code: 'x',
      axe: 'tva',
      gravite: 3,
      message: '',
      entryIds: [],
    })
    expect(position).toEqual({ angle: 0, rayon: 1 })
  })
})

describe('rôles', () => {
  it('la lecture ne peut rien écrire', () => {
    expect(can('lecture', 'entry.read')).toBe(true)
    expect(can('lecture', 'entry.draft')).toBe(false)
  })

  it('la saisie ne valide pas', () => {
    expect(can('saisie', 'entry.draft')).toBe(true)
    expect(can('saisie', 'entry.validate')).toBe(false)
  })

  it('le réviseur valide mais ne clôture pas', () => {
    expect(can('reviseur', 'entry.validate')).toBe(true)
    expect(can('reviseur', 'closing.run')).toBe(false)
  })

  it('l’expert peut tout', () => {
    expect(permissionsOf('expert')).toHaveLength(13)
    expect(can('expert', 'closing.run')).toBe(true)
    expect(can('expert', 'user.manage')).toBe(true)
  })
})
