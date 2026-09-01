import { describe, expect, it } from 'vitest'
import { euros } from '../core/montant'
import { ECRITURES, EXERCICE, ligne } from '../fixtures/garage-vidal'
import { mouvements } from './aides'
import { diagnostiquer, estConforme } from './diagnostic'
import { journalNaturel } from './structure'
import { controlerEcriture } from './index'

const ACHAT = [
  ligne('607', 'Achats de marchandises', 1000, 0),
  ligne('44566', 'TVA déductible', 200, 0),
  ligne('401', 'Fournisseur Roux', 0, 1200),
]

describe('réduction d’une écriture à ses mouvements', () => {
  it('agrège deux lignes portant le même compte dans le même sens', () => {
    const reduits = mouvements([
      ligne('607', 'Pièces', 600, 0),
      ligne('607', 'Fournitures', 400, 0),
      ligne('401', 'Roux', 0, 1000),
    ])
    expect(reduits).toHaveLength(2)
    expect(reduits[0]).toMatchObject({ compte: '607', sens: 'debit', montant: euros(1000) })
  })

  it('rend une saisie ventilée équivalente à une saisie groupée', () => {
    const ventilee = [
      ligne('607', 'Pièces', 600, 0),
      ligne('607', 'Fournitures', 400, 0),
      ligne('44566', 'TVA', 200, 0),
      ligne('401', 'Roux', 0, 1200),
    ]
    expect(diagnostiquer(ventilee, ACHAT)).toEqual([])
    expect(estConforme(ventilee, ACHAT)).toBe(true)
  })
})

describe('comparaison à l’écriture attendue', () => {
  it('ne relève rien quand l’ordre des lignes diffère', () => {
    const desordre = [ACHAT[2]!, ACHAT[0]!, ACHAT[1]!]
    expect(diagnostiquer(desordre, ACHAT)).toEqual([])
  })

  it('désigne la ligne saisie en cause', () => {
    const ecarts = diagnostiquer(
      [ACHAT[0]!, ligne('44562', 'TVA', 200, 0), ACHAT[2]!],
      ACHAT,
    )
    expect(ecarts).toHaveLength(1)
    expect(ecarts[0]?.ligne).toBe(1)
    expect(ecarts[0]?.compteConstate).toBe('44562')
    expect(ecarts[0]?.compteAttendu).toBe('44566')
  })

  it('donne l’explication attendue sur la TVA d’immobilisation', () => {
    const ecarts = diagnostiquer(
      [ligne('2183', 'Ordinateur', 1000, 0), ligne('44566', 'TVA', 200, 0), ligne('404', 'Fournisseur', 0, 1200)],
      [ligne('2183', 'Ordinateur', 1000, 0), ligne('44562', 'TVA', 200, 0), ligne('404', 'Fournisseur', 0, 1200)],
    )
    expect(ecarts[0]?.explication).toBe(
      'TVA déductible portée en 44566 alors que la facture concerne une immobilisation. Le compte attendu est le 44562.',
    )
  })

  it('rend un diagnostic stable d’un appel à l’autre', () => {
    const saisie = [ligne('601', 'Achat', 1200, 0), ligne('44566', 'TVA', 200, 0), ligne('401', 'Roux', 0, 1400)]
    const premier = diagnostiquer(saisie, ACHAT)
    const second = diagnostiquer(saisie, ACHAT)
    expect(second).toEqual(premier)
  })

  it('ne consomme jamais deux fois la même ligne attendue', () => {
    const attendue = [ligne('607', 'Achat', 1000, 0), ligne('401', 'Roux', 0, 1000)]
    const saisie = [
      ligne('601', 'Achat de matières', 1000, 0),
      ligne('6063', 'Petit équipement', 1000, 0),
      ligne('401', 'Roux', 0, 2000),
    ]
    const ecarts = diagnostiquer(saisie, attendue)
    // Une seule des deux lignes de charge peut répondre à la ligne attendue :
    // l'autre est déclarée superflue, elle ne produit pas un second diagnostic
    // de confusion de compte.
    expect(ecarts.filter((e) => e.famille === 'sens')).toHaveLength(1)
    expect(ecarts.filter((e) => e.code === 'MT_MONTANT_ERRONE')).toHaveLength(2)
  })

  it('déclare superflue une ligne ajoutée à une écriture par ailleurs juste', () => {
    const saisie = [
      ligne('607', 'Achat', 1000, 0),
      ligne('44566', 'TVA', 200, 0),
      ligne('44562', 'TVA', 200, 0),
      ligne('401', 'Roux', 0, 1400),
    ]
    const ecarts = diagnostiquer(saisie, ACHAT)
    expect(ecarts.map((e) => e.compteConstate)).toEqual(['44562', '401'])
    expect(ecarts[0]?.explication).toContain('ne figure pas dans l’écriture attendue')
  })
})

describe('journal appelé par la nature de l’opération', () => {
  it('reconnaît le journal de trésorerie avant tout', () => {
    expect(journalNaturel([ligne('401', 'Roux', 1200, 0), ligne('512', 'Banque', 0, 1200)])).toBe('BQ')
    expect(journalNaturel([ligne('530', 'Caisse', 100, 0), ligne('707', 'Vente', 0, 100)])).toBe('CA')
  })

  it('reconnaît les journaux d’achats et de ventes', () => {
    expect(journalNaturel(ACHAT)).toBe('AC')
    expect(journalNaturel([ligne('411', 'Client', 1200, 0), ligne('707', 'Vente', 0, 1200)])).toBe('VE')
  })

  it('laisse les opérations diverses sans journal imposé', () => {
    expect(journalNaturel([ligne('6811', 'Dotation', 600, 0), ligne('28183', 'Amortissements', 0, 600)])).toBeNull()
  })
})

describe('écritures du dossier de référence', () => {
  it('ne produit aucun écart, écriture par écriture', () => {
    for (const ecriture of ECRITURES) {
      const ecarts = controlerEcriture(ecriture, {
        exercice: EXERCICE,
        ecrituresExistantes: ECRITURES,
      })
      expect(ecarts.map((e) => e.code), `${ecriture.id} ${ecriture.libelle}`).toEqual([])
    }
  })
})
