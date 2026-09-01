import { describe, expect, it } from 'vitest'
import { euros } from '../core/montant'
import {
  ecritureFactureAEtablir,
  ecritureFactureNonParvenue,
  partConstateeDAvance,
  partRattacheeALExercice,
} from './regularisations'

const EXERCICE = { debut: '2025-01-01', fin: '2025-12-31' }

describe('charges et produits constatés d’avance', () => {
  it('reporte huit douzièmes d’une prime d’assurance annuelle payée le 1er septembre', () => {
    const periode = { debut: '2025-09-01', fin: '2026-08-31' }
    expect(partConstateeDAvance(euros(1200), periode, EXERCICE)).toBe(euros(800))
    expect(partConstateeDAvance(euros(1200), periode, EXERCICE, 'mois')).toBe(euros(800))
    expect(partRattacheeALExercice(euros(1200), periode, EXERCICE)).toBe(euros(400))
  })

  it('reporte deux tiers d’un loyer trimestriel payé le 1er décembre', () => {
    const periode = { debut: '2025-12-01', fin: '2026-02-28' }
    expect(partConstateeDAvance(euros(3000), periode, EXERCICE)).toBe(euros(2000))
  })

  it('ne reporte rien quand la période s’achève avant la clôture', () => {
    expect(
      partConstateeDAvance(euros(1200), { debut: '2025-01-01', fin: '2025-06-30' }, EXERCICE),
    ).toBe(0)
  })

  it('reporte tout quand la période commence après la clôture', () => {
    expect(
      partConstateeDAvance(euros(1200), { debut: '2026-01-01', fin: '2026-12-31' }, EXERCICE),
    ).toBe(euros(1200))
  })

  it('ne perd pas de centime entre les deux exercices', () => {
    const periode = { debut: '2025-11-15', fin: '2026-05-14' }
    const montant = euros(999.99)
    expect(
      partConstateeDAvance(montant, periode, EXERCICE) +
        partRattacheeALExercice(montant, periode, EXERCICE),
    ).toBe(montant)
  })
})

describe('factures non parvenues et à établir', () => {
  it('rattache la charge, la TVA et la dette', () => {
    const lignes = ecritureFactureNonParvenue({
      compteCharge: '607',
      montantHT: euros(500),
      montantTVA: euros(100),
    })
    expect(lignes).toEqual([
      { compte: '607', debit: euros(500), credit: 0 },
      { compte: '44586', debit: euros(100), credit: 0 },
      { compte: '408', debit: 0, credit: euros(600) },
    ])
  })

  it('rattache le produit non encore facturé', () => {
    const lignes = ecritureFactureAEtablir({
      compteProduit: '706',
      montantHT: euros(800),
      montantTVA: euros(160),
    })
    expect(lignes[0]).toEqual({ compte: '418', debit: euros(960), credit: 0 })
    expect(lignes[2]).toEqual({ compte: '44587', debit: 0, credit: euros(160) })
  })
})
