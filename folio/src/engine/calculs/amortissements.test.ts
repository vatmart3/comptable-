import { describe, expect, it } from 'vitest'
import { euros, somme } from '../core/montant'
import {
  baseAmortissable,
  coefficientDegressif,
  cumulALaCloture,
  depreciationImmobilisation,
  dotationDeLExercice,
  joursProrata,
  moisProrata,
  planAmortissement,
  tauxDegressif,
  type Immobilisation,
} from './amortissements'

const EXERCICE = { debut: '2025-01-01', fin: '2025-12-31' }

const materiel = (surcharge: Partial<Immobilisation> = {}): Immobilisation => ({
  id: 'immo-1',
  compte: '2154',
  libelle: 'Machine à commande numérique',
  valeurOrigine: euros(24000),
  dateAcquisition: '2025-03-15',
  dateMiseEnService: '2025-03-15',
  dureeAnnees: 5,
  mode: 'lineaire',
  compteAmortissement: '28154',
  ...surcharge,
})

describe('prorata temporis', () => {
  it('compte les jours du linéaire depuis la mise en service, base 360', () => {
    expect(joursProrata('2025-03-15', '2025-12-31')).toBe(286)
    expect(joursProrata('2025-01-01', '2025-12-31')).toBe(360)
    expect(joursProrata('2025-04-01', '2025-12-31')).toBe(270)
    expect(joursProrata('2026-02-01', '2025-12-31')).toBe(0)
  })

  it('compte les mois du dégressif depuis le premier du mois d’acquisition', () => {
    expect(moisProrata('2025-04-12', EXERCICE)).toBe(9)
    expect(moisProrata('2025-01-31', EXERCICE)).toBe(12)
    expect(moisProrata('2025-12-28', EXERCICE)).toBe(1)
  })

  it('donne les coefficients du dégressif', () => {
    expect(coefficientDegressif(3)).toBe(1.25)
    expect(coefficientDegressif(5)).toBe(1.75)
    expect(coefficientDegressif(8)).toBe(2.25)
    expect(tauxDegressif(5)).toBeCloseTo(0.35, 10)
  })
})

describe('amortissement linéaire', () => {
  it('étale la première annuité sur 286 jours et déborde sur un sixième exercice', () => {
    const plan = planAmortissement(materiel(), EXERCICE)
    expect(plan).toHaveLength(6)
    expect(plan[0]?.dotation).toBe(euros(3813.33))
    expect(plan[0]?.prorata).toEqual({ unite: 'jours', valeur: 286, sur: 360 })
    expect(plan[1]?.dotation).toBe(euros(4800))
    expect(plan[5]?.dotation).toBe(euros(986.67))
    expect(plan[5]?.valeurNetteComptable).toBe(0)
  })

  it('ne perd jamais un centime, quelle que soit la valeur ou la date', () => {
    const valeurs = [24000, 13333.33, 999.99, 7.77, 100000.01]
    const dates = ['2025-01-01', '2025-02-28', '2025-03-15', '2025-07-04', '2025-12-31']
    for (const valeur of valeurs) {
      for (const date of dates) {
        for (const duree of [3, 5, 7]) {
          const immobilisation = materiel({
            valeurOrigine: euros(valeur),
            dureeAnnees: duree,
            dateAcquisition: date,
            dateMiseEnService: date,
          })
          const plan = planAmortissement(immobilisation, EXERCICE)
          expect(somme(plan.map((l) => l.dotation)), `${valeur} au ${date} sur ${duree} ans`).toBe(
            euros(valeur),
          )
          expect(plan.at(-1)?.valeurNetteComptable).toBe(0)
        }
      }
    }
  })

  it('exclut la valeur résiduelle de la base amortissable', () => {
    const immobilisation = materiel({
      valeurOrigine: euros(10000),
      valeurResiduelle: euros(1000),
      dureeAnnees: 3,
      dateAcquisition: '2025-01-01',
      dateMiseEnService: '2025-01-01',
    })
    expect(baseAmortissable(immobilisation)).toBe(euros(9000))
    const plan = planAmortissement(immobilisation, EXERCICE)
    expect(plan).toHaveLength(3)
    expect(plan.map((l) => l.dotation)).toEqual([euros(3000), euros(3000), euros(3000)])
    expect(plan[2]?.valeurNetteComptable).toBe(euros(1000))
  })

  it('rend la dotation et le cumul d’un exercice donné', () => {
    const immobilisation = materiel()
    expect(dotationDeLExercice(immobilisation, EXERCICE)).toBe(euros(3813.33))
    expect(cumulALaCloture(immobilisation, { debut: '2026-01-01', fin: '2026-12-31' })).toBe(
      euros(8613.33),
    )
  })
})

describe('amortissement dégressif', () => {
  const immobilisation = materiel({
    valeurOrigine: euros(20000),
    dateAcquisition: '2025-04-12',
    dateMiseEnService: '2025-04-12',
    mode: 'degressif',
  })

  it('applique le taux dégressif au prorata des mois puis bascule sur le linéaire résiduel', () => {
    const plan = planAmortissement(immobilisation, EXERCICE)
    expect(plan).toHaveLength(5)
    expect(plan[0]?.dotation).toBe(euros(5250))
    expect(plan[0]?.prorata).toEqual({ unite: 'mois', valeur: 9, sur: 12 })
    expect(plan[1]?.dotation).toBe(euros(5162.5))
    expect(plan[2]?.dotation).toBe(euros(3355.63))
    expect(plan[3]?.bascule).toBe(true)
    expect(plan[3]?.dotation).toBe(euros(3115.94))
    expect(plan[4]?.dotation).toBe(euros(3115.93))
  })

  it('solde exactement la base amortissable', () => {
    const plan = planAmortissement(immobilisation, EXERCICE)
    expect(somme(plan.map((l) => l.dotation))).toBe(euros(20000))
    expect(plan.at(-1)?.valeurNetteComptable).toBe(0)
  })
})

describe('dépréciation', () => {
  it('porte sur la valeur nette comptable, pas sur le brut', () => {
    expect(depreciationImmobilisation(euros(300), euros(250))).toBe(euros(50))
    expect(depreciationImmobilisation(euros(300), euros(400))).toBe(0)
  })
})
