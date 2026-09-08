import { describe, expect, it } from 'vitest'
import {
  buildPlan,
  coefficientDegressif,
  days360,
  dotationEntry,
  exercicesCivils,
  monthsInclusive,
  tauxLineaire,
  vncAt,
} from '@/lib/accounting/depreciation'

const EXERCICES = exercicesCivils(new Date(Date.UTC(2025, 0, 1)), 8)
const MISE_EN_SERVICE_1ER_JUILLET = new Date(Date.UTC(2025, 6, 1))

function total(plan: readonly { dotation: number }[]): number {
  return plan.reduce((acc, row) => acc + row.dotation, 0)
}

describe('bases de calcul', () => {
  it('compte les jours en base 360', () => {
    expect(days360(new Date(Date.UTC(2025, 0, 1)), new Date(Date.UTC(2025, 11, 31)))).toBe(359)
    expect(days360(new Date(Date.UTC(2025, 6, 1)), new Date(Date.UTC(2025, 11, 31)))).toBe(179)
  })

  it('compte le mois d’acquisition en entier pour le dégressif', () => {
    expect(monthsInclusive(new Date(Date.UTC(2025, 6, 28)), new Date(Date.UTC(2025, 11, 31)))).toBe(6)
  })

  it('applique les coefficients dégressifs du CGI', () => {
    expect(coefficientDegressif(24)).toBe(1) // moins de 3 ans : dégressif fermé
    expect(coefficientDegressif(36)).toBe(1.25)
    expect(coefficientDegressif(48)).toBe(1.25)
    expect(coefficientDegressif(60)).toBe(1.75)
    expect(coefficientDegressif(72)).toBe(1.75)
    expect(coefficientDegressif(96)).toBe(2.25)
  })

  it('calcule le taux linéaire annuel', () => {
    expect(tauxLineaire(60)).toBe(20_000)
    expect(tauxLineaire(36)).toBe(33_333)
    expect(tauxLineaire(120)).toBe(10_000)
  })
})

describe('amortissement linéaire', () => {
  // Matériel informatique 12 000 € HT, mis en service le 1er juillet, 5 ans.
  const plan = buildPlan({
    valeurBrute: 1_200_000,
    dateMiseEnService: MISE_EN_SERVICE_1ER_JUILLET,
    dureeMois: 60,
    mode: 'lineaire',
    exercices: EXERCICES,
  })

  it('proratise la première annuité en jours', () => {
    expect(plan[0]?.dotation).toBe(120_000) // exactement une demi-annuité
  })

  it('sert une annuité pleine sur les exercices complets', () => {
    expect(plan[1]?.dotation).toBe(240_000)
    expect(plan[4]?.dotation).toBe(240_000)
  })

  it('étale l’amortissement sur six exercices civils', () => {
    const actifs = plan.filter((row) => row.dotation > 0)
    expect(actifs).toHaveLength(6)
  })

  it('solde exactement la valeur brute — un plan qui ne solde pas est faux', () => {
    expect(total(plan)).toBe(1_200_000)
    expect(plan[plan.length - 1]?.vnc).toBe(0)
  })

  it('tient la valeur nette comptable à toute date', () => {
    expect(vncAt(plan, new Date(Date.UTC(2026, 11, 31)))).toBe(840_000)
  })

  it('respecte une valeur résiduelle', () => {
    const avecResiduelle = buildPlan({
      valeurBrute: 1_200_000,
      valeurResiduelle: 200_000,
      dateMiseEnService: new Date(Date.UTC(2025, 0, 1)),
      dureeMois: 60,
      mode: 'lineaire',
      exercices: EXERCICES,
    })
    expect(total(avecResiduelle)).toBe(1_000_000)
    expect(avecResiduelle[avecResiduelle.length - 1]?.vnc).toBe(200_000)
  })
})

describe('amortissement dégressif', () => {
  const plan = buildPlan({
    valeurBrute: 1_200_000,
    dateMiseEnService: MISE_EN_SERVICE_1ER_JUILLET,
    dureeMois: 60,
    mode: 'degressif',
    exercices: EXERCICES,
  })

  it('applique le taux dégressif : 20 % × 1,75 = 35 %', () => {
    expect(plan[0]?.taux).toBe(35_000)
  })

  it('proratise la première annuité en mois entiers, pas en jours', () => {
    // Six mois sur douze : 12 000 × 35 % × 6/12 = 2 100 €.
    expect(plan[0]?.dotation).toBe(210_000)
  })

  it('amortit plus vite que le linéaire les premières années', () => {
    const lineaire = buildPlan({
      valeurBrute: 1_200_000,
      dateMiseEnService: MISE_EN_SERVICE_1ER_JUILLET,
      dureeMois: 60,
      mode: 'lineaire',
      exercices: EXERCICES,
    })
    expect(plan[1]!.cumule).toBeGreaterThan(lineaire[1]!.cumule)
  })

  it('bascule obligatoirement en linéaire quand celui-ci devient plus favorable', () => {
    const bascule = plan.findIndex((row) => row.bascule)
    expect(bascule).toBe(3) // 4e annuité : 1/2,5 = 40 % > 35 %
    expect(plan[bascule]?.taux).toBe(40_000)
  })

  it('ne bascule jamais en arrière une fois basculé', () => {
    const premier = plan.findIndex((row) => row.bascule)
    for (let index = premier; index < plan.length; index += 1) {
      if (plan[index]!.dotation > 0) expect(plan[index]!.bascule).toBe(true)
    }
  })

  it('solde exactement la valeur brute', () => {
    expect(total(plan)).toBe(1_200_000)
    expect(plan[plan.length - 1]?.vnc).toBe(0)
  })
})

describe('cas limites', () => {
  it('n’amortit pas un bien non amortissable — un terrain reste au bilan', () => {
    expect(
      buildPlan({
        valeurBrute: 5_000_000,
        dateMiseEnService: MISE_EN_SERVICE_1ER_JUILLET,
        dureeMois: 0,
        mode: 'non_amortissable',
        exercices: EXERCICES,
      }),
    ).toEqual([])
  })

  it('arrête le plan à la date de cession', () => {
    const plan = buildPlan({
      valeurBrute: 1_200_000,
      dateMiseEnService: new Date(Date.UTC(2025, 0, 1)),
      dureeMois: 60,
      mode: 'lineaire',
      exercices: EXERCICES,
      dateCession: new Date(Date.UTC(2027, 5, 30)),
    })
    expect(plan).toHaveLength(3)
    expect(plan[2]?.dotation).toBe(120_000) // six mois d'amortissement en 2027
    expect(total(plan)).toBe(600_000)
  })

  it('ne dote rien avant la mise en service', () => {
    const plan = buildPlan({
      valeurBrute: 1_200_000,
      dateMiseEnService: new Date(Date.UTC(2027, 0, 1)),
      dureeMois: 60,
      mode: 'lineaire',
      exercices: EXERCICES,
    })
    expect(plan[0]?.dotation).toBe(0)
    expect(plan[1]?.dotation).toBe(0)
    expect(plan[2]?.dotation).toBe(240_000)
  })
})

describe('écriture de dotation', () => {
  it('débite le 681120 et crédite le compte d’amortissement', () => {
    const lignes = dotationEntry({
      dotation: 240_000,
      compteAmortissement: '281830',
      libelle: 'Dotation 2026 — poste de travail',
    })
    expect(lignes).toHaveLength(2)
    expect(lignes[0]?.accountNumero).toBe('681120')
    expect(lignes[0]?.debit).toBe(240_000)
    expect(lignes[1]?.accountNumero).toBe('281830')
    expect(lignes[1]?.credit).toBe(240_000)
  })

  it('ne produit rien pour une dotation nulle', () => {
    expect(dotationEntry({ dotation: 0, compteAmortissement: '281830', libelle: 'x' })).toEqual([])
  })
})
