import { describe, expect, it } from 'vitest'
import {
  ajouterMois,
  comparerDates,
  dansExercice,
  estBissextile,
  estDateValide,
  finDeMois,
  formatDateFec,
  formatDateFr,
  jours30360,
  joursReels,
  rangDuMois,
} from './dates'

const EXERCICE = { debut: '2025-01-01', fin: '2025-12-31' }

describe('validité et comparaison', () => {
  it('reconnaît une date impossible', () => {
    expect(estDateValide('2025-02-29')).toBe(false)
    expect(estDateValide('2024-02-29')).toBe(true)
    expect(estDateValide('2025-13-01')).toBe(false)
    expect(estDateValide('01/03/2025')).toBe(false)
  })

  it('compare dans l’ordre chronologique', () => {
    expect(comparerDates('2025-01-01', '2025-12-31')).toBe(-1)
    expect(comparerDates('2025-12-31', '2025-12-31')).toBe(0)
  })

  it('situe une date dans l’exercice sans décalage de fuseau', () => {
    expect(dansExercice('2025-12-31', EXERCICE)).toBe(true)
    expect(dansExercice('2026-01-01', EXERCICE)).toBe(false)
    expect(dansExercice('2024-12-31', EXERCICE)).toBe(false)
  })

  it('connaît les années bissextiles', () => {
    expect(estBissextile(2024)).toBe(true)
    expect(estBissextile(2100)).toBe(false)
    expect(estBissextile(2000)).toBe(true)
  })
})

describe('arithmétique des dates', () => {
  it('compte les jours en base 30/360', () => {
    expect(jours30360('2025-03-15', '2025-12-31')).toBe(285)
    expect(jours30360('2025-01-01', '2025-12-31')).toBe(359)
    expect(jours30360('2025-01-01', '2026-01-01')).toBe(360)
    expect(jours30360('2025-02-28', '2025-12-31')).toBe(302)
  })

  it('compte un mois plein quand la période s’achève un dernier jour de mois', () => {
    expect(jours30360('2025-12-01', '2026-02-28') + 1).toBe(90)
    expect(jours30360('2025-09-01', '2026-08-31') + 1).toBe(360)
  })

  it('compte les jours réels', () => {
    expect(joursReels('2025-01-01', '2025-12-31')).toBe(364)
    expect(joursReels('2024-02-28', '2024-03-01')).toBe(2)
  })

  it('ajoute des mois en repliant sur la fin du mois', () => {
    expect(ajouterMois('2025-01-31', 1)).toBe('2025-02-28')
    expect(ajouterMois('2025-01-01', 12)).toBe('2026-01-01')
    expect(ajouterMois('2025-01-01', -12)).toBe('2024-01-01')
    expect(finDeMois('2024-02-10')).toBe('2024-02-29')
  })

  it('situe le mois dans l’exercice', () => {
    expect(rangDuMois('2025-01-15', EXERCICE)).toBe(1)
    expect(rangDuMois('2025-12-31', EXERCICE)).toBe(12)
    const decale = { debut: '2025-07-01', fin: '2026-06-30' }
    expect(rangDuMois('2026-06-30', decale)).toBe(12)
  })
})

describe('rendus', () => {
  it('rend les formats français et FEC', () => {
    expect(formatDateFr('2025-03-07')).toBe('07/03/2025')
    expect(formatDateFec('2025-03-07')).toBe('20250307')
  })
})
