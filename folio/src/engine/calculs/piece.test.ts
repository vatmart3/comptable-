import { describe, expect, it } from 'vitest'
import { euros } from '../core/montant'
import type { DetailPiece } from '../types/piece'
import { calculerTotauxPiece, montantNetLigne } from './piece'

const ligne = (quantite: number, prix: number, taux: number, remise?: number) => ({
  designation: 'Article',
  quantite,
  prixUnitaireHT: euros(prix),
  tauxTVA: taux,
  ...(remise ? { remise } : {}),
})

describe('pied de facture', () => {
  it('applique la remise de ligne avant tout', () => {
    expect(montantNetLigne(ligne(10, 50, 2000, 500))).toBe(euros(475))
  })

  it('calcule une facture simple', () => {
    const detail: DetailPiece = { lignes: [ligne(10, 50, 2000, 500)] }
    const totaux = calculerTotauxPiece(detail)
    expect(totaux.brutHT).toBe(euros(500))
    expect(totaux.netCommercial).toBe(euros(475))
    expect(totaux.totalTVA).toBe(euros(95))
    expect(totaux.totalTTC).toBe(euros(570))
  })

  it('déduit la remise de pied puis l’escompte de la base de TVA', () => {
    const detail: DetailPiece = {
      lignes: [ligne(10, 50, 2000, 500)],
      reductionsCommerciales: euros(47.5),
      escompte: euros(9.5),
    }
    const totaux = calculerTotauxPiece(detail)
    expect(totaux.netCommercial).toBe(euros(427.5))
    expect(totaux.netFinancier).toBe(euros(418))
    expect(totaux.totalTVA).toBe(euros(83.6))
    expect(totaux.totalTTC).toBe(euros(501.6))
  })

  it('soumet le port à la TVA et laisse la consignation hors champ', () => {
    const detail: DetailPiece = {
      lignes: [ligne(10, 50, 2000, 500)],
      port: euros(30),
      tauxTVAPort: 2000,
      consignation: euros(24),
    }
    const totaux = calculerTotauxPiece(detail)
    expect(totaux.totalHT).toBe(euros(505))
    expect(totaux.totalTVA).toBe(euros(101))
    expect(totaux.totalTTC).toBe(euros(630))
  })

  it('ventile la remise de pied au prorata des taux, sans perdre de centime', () => {
    const detail: DetailPiece = {
      lignes: [ligne(1, 100, 2000), ligne(1, 200, 550)],
      reductionsCommerciales: euros(30),
    }
    const totaux = calculerTotauxPiece(detail)
    expect(totaux.basesParTaux).toEqual([
      { taux: 2000, base: euros(90), tva: euros(18) },
      { taux: 550, base: euros(180), tva: euros(9.9) },
    ])
    expect(totaux.totalTVA).toBe(euros(27.9))
    expect(totaux.totalTTC).toBe(euros(297.9))
  })

  it('n’arrondit la TVA qu’une fois par taux', () => {
    const detail: DetailPiece = { lignes: [ligne(1, 123.45, 550)] }
    expect(calculerTotauxPiece(detail).totalTVA).toBe(679)
  })

  it('déduit l’acompte du net à payer sans toucher à la TVA', () => {
    const detail: DetailPiece = { lignes: [ligne(1, 1000, 2000)], acompte: euros(300) }
    const totaux = calculerTotauxPiece(detail)
    expect(totaux.totalTTC).toBe(euros(1200))
    expect(totaux.netAPayer).toBe(euros(900))
  })

  it('traite un avoir comme une facture de signe opposé', () => {
    const detail: DetailPiece = { lignes: [ligne(-2, 50, 2000)] }
    const totaux = calculerTotauxPiece(detail)
    expect(totaux.netCommercial).toBe(euros(-100))
    expect(totaux.totalTVA).toBe(euros(-20))
    expect(totaux.totalTTC).toBe(euros(-120))
  })
})
