import { describe, expect, it } from 'vitest'
import {
  PLAN_COMPTABLE,
  classeDe,
  existeAuPlan,
  rechercherComptes,
  resoudreCompte,
  trouverCompte,
} from './plan-comptable'
import { JOURNAUX, trouverJournal } from './journaux'
import { TAUX_TVA, estTauxAdmis, formatTaux } from './tva'

describe('cohérence de la table', () => {
  it('n’a aucun numéro en double', () => {
    const numeros = PLAN_COMPTABLE.map((c) => c.numero)
    expect(new Set(numeros).size).toBe(numeros.length)
  })

  it('classe chaque compte dans le bilan ou la gestion selon sa classe', () => {
    for (const compte of PLAN_COMPTABLE) {
      expect(compte.classe).toBe(classeDe(compte.numero))
      expect(compte.type).toBe(compte.classe >= 6 ? 'gestion' : 'bilan')
    }
  })

  it('ne rend lettrables que des comptes de tiers', () => {
    for (const compte of PLAN_COMPTABLE.filter((c) => c.lettrable)) {
      expect(compte.classe).toBe(4)
    }
  })

  it('ne rend rapprochables que des comptes financiers', () => {
    for (const compte of PLAN_COMPTABLE.filter((c) => c.rapprochable)) {
      expect(compte.classe).toBe(5)
    }
  })

  it('porte les comptes attendus du BTS', () => {
    for (const numero of ['607', '401', '411', '44566', '44562', '44571', '44551', '512', '6811', '2818']) {
      expect(trouverCompte(numero), numero).toBeDefined()
    }
  })
})

describe('résolution d’un numéro saisi', () => {
  it('accepte une subdivision non listée en la rattachant à sa racine', () => {
    const compte = resoudreCompte('6068')
    expect(compte?.classe).toBe(6)
    expect(compte?.numero).toBe('6068')
  })

  it('accepte un compte auxiliaire de tiers', () => {
    const compte = resoudreCompte('401VIDAL')
    expect(compte?.lettrable).toBe(true)
    expect(compte?.libelle).toContain('VIDAL')
  })

  it('refuse un numéro hors plan', () => {
    expect(existeAuPlan('9999')).toBe(false)
    expect(existeAuPlan('12')).toBe(false)
    expect(resoudreCompte('XYZ')).toBeUndefined()
  })
})

describe('recherche de compte', () => {
  it('trouve par numéro', () => {
    expect(rechercherComptes('607')[0]?.numero).toBe('607')
  })

  it('trouve par libellé, sans se soucier des accents', () => {
    const resultats = rechercherComptes('deductible sur immobilisations')
    expect(resultats.map((c) => c.numero)).toContain('44562')
  })

  it('ne rend rien sur une requête vide', () => {
    expect(rechercherComptes('  ')).toEqual([])
  })
})

describe('journaux et taux', () => {
  it('expose les six journaux du dossier', () => {
    expect(JOURNAUX.map((j) => j.code)).toEqual(['AN', 'AC', 'VE', 'BQ', 'CA', 'OD'])
    expect(trouverJournal('BQ')?.compteContrepartie).toBe('512')
    expect(trouverJournal('ZZ')).toBeUndefined()
  })

  it('connaît les taux de TVA en vigueur', () => {
    expect(TAUX_TVA.map((t) => t.taux)).toEqual([2000, 1000, 550, 210, 0])
    expect(estTauxAdmis(1750)).toBe(false)
    expect(formatTaux(550)).toBe('5,5 %')
    expect(formatTaux(2000)).toBe('20 %')
  })
})
