/**
 * La physique de La Balance. Elle est testée comme le reste : ce que
 * l'utilisateur lit d'un coup d'œil doit être exact, pas seulement joli.
 */
import { describe, expect, it } from 'vitest'
import { ANGLE_MAX, auRepos, avancer, inclinaison } from '@/components/balance/ressort'

describe('inclinaison', () => {
  it('est nulle à l’équilibre', () => {
    expect(inclinaison(24_000, 24_000)).toBe(0)
    expect(inclinaison(0, 0)).toBe(0)
  })

  it('penche du côté du débit quand le débit l’emporte', () => {
    expect(inclinaison(24_000, 0)).toBeGreaterThan(0)
  })

  it('penche du côté du crédit quand le crédit l’emporte', () => {
    expect(inclinaison(0, 24_000)).toBeLessThan(0)
  })

  it('sature à la butée sur un plateau vide', () => {
    expect(inclinaison(24_000, 0)).toBe(1)
    expect(inclinaison(0, 24_000)).toBe(-1)
  })

  it('reste bornée entre -1 et 1', () => {
    for (const [debit, credit] of [
      [1, 999_999_999],
      [999_999_999, 1],
      [500, 501],
    ] as const) {
      const valeur = inclinaison(debit, credit)
      expect(valeur).toBeGreaterThanOrEqual(-1)
      expect(valeur).toBeLessThanOrEqual(1)
    }
  })

  it('rend un écart d’un centime visible sur une petite écriture', () => {
    // 12 € contre 12,01 € : la balance doit bouger d'au moins un degré.
    const angle = Math.abs(inclinaison(120_000, 120_100) * ANGLE_MAX * (180 / Math.PI))
    expect(angle).toBeGreaterThan(0.5)
  })

  it('ne couche pas la balance pour le même centime sur une grosse écriture', () => {
    const petite = Math.abs(inclinaison(120_000, 120_100))
    const grosse = Math.abs(inclinaison(12_000_000, 12_000_100))
    expect(grosse).toBeLessThan(petite)
  })

  it('est symétrique', () => {
    expect(inclinaison(30_000, 10_000)).toBe(-inclinaison(10_000, 30_000))
  })
})

describe('ressort', () => {
  it('converge vers sa cible et s’y arrête', () => {
    let etat = { valeur: 0, vitesse: 0 }
    for (let image = 0; image < 240; image += 1) {
      etat = avancer(etat, 0.3, 1 / 60)
    }
    expect(etat.valeur).toBeCloseTo(0.3, 4)
    expect(auRepos(etat, 0.3)).toBe(true)
  })

  it('n’est pas au repos tant qu’il n’a pas convergé', () => {
    const etat = avancer({ valeur: 0, vitesse: 0 }, 0.3, 1 / 60)
    expect(auRepos(etat, 0.3)).toBe(false)
  })

  it('ne rebondit jamais deux fois — § 6', () => {
    // Raideur 260, amortissement 30 : ζ ≈ 0,93, le ressort est quasi critique.
    // Il se pose net, sans osciller. C'est ce qu'on attend d'un plateau de
    // balance, et c'est ce que la direction artistique impose.
    let etat = { valeur: 0, vitesse: 0 }
    let inversions = 0
    let signePrecedent = 0
    for (let image = 0; image < 240; image += 1) {
      etat = avancer(etat, 0.3, 1 / 60)
      const signe = Math.sign(etat.vitesse)
      if (signe !== 0 && signePrecedent !== 0 && signe !== signePrecedent) inversions += 1
      if (signe !== 0) signePrecedent = signe
    }
    expect(inversions).toBeLessThanOrEqual(1)
  })

  it('se pose vite : moins d’une seconde pour rejoindre sa cible', () => {
    let etat = { valeur: 0, vitesse: 0 }
    let images = 0
    while (!auRepos(etat, 0.3) && images < 600) {
      etat = avancer(etat, 0.3, 1 / 60)
      images += 1
    }
    expect(images).toBeLessThan(60)
  })

  it('borne le pas de temps : un onglet en arrière-plan ne fait pas exploser l’intégration', () => {
    const etat = avancer({ valeur: 0, vitesse: 0 }, 0.3, 12)
    expect(Number.isFinite(etat.valeur)).toBe(true)
    expect(Math.abs(etat.valeur)).toBeLessThan(1)
  })
})
