import { describe, expect, it } from 'vitest'
import { euros } from '../core/montant'
import type { Immobilisation } from '../calculs/amortissements'
import { CODES_ECART } from './codes'
import { creerEcart, ficheEcart, titreEcart, trierEcarts } from './catalogue'
import {
  controlerDateDOperation,
  controlerDepreciation,
  controlerDotation,
  controlerRattachement,
} from './inventaire'

const EXERCICE = { debut: '2025-01-01', fin: '2025-12-31' }

const machine: Immobilisation = {
  id: 'i1',
  compte: '2154',
  libelle: 'Machine',
  valeurOrigine: euros(24000),
  dateAcquisition: '2025-03-15',
  dateMiseEnService: '2025-03-15',
  dureeAnnees: 5,
  mode: 'lineaire',
  compteAmortissement: '28154',
}

describe('contrôle de la dotation', () => {
  it('ne relève rien sur une dotation juste', () => {
    expect(controlerDotation(machine, EXERCICE, euros(3813.33))).toEqual([])
  })

  it('signale l’écart d’arrondi au centime', () => {
    const ecarts = controlerDotation(machine, EXERCICE, euros(3813.34))
    expect(ecarts.map((e) => e.code)).toEqual(['MT_ECART_ARRONDI'])
  })

  it('signale une dotation sans rapport avec le plan', () => {
    const ecarts = controlerDotation(machine, EXERCICE, euros(1000))
    expect(ecarts[0]?.code).toBe('INV_PRORATA_TEMPORIS')
    expect(ecarts[0]?.montantAttendu).toBe(euros(3813.33))
  })

  it('nomme la valeur résiduelle ignorée en dégressif comme en linéaire', () => {
    const degressive: Immobilisation = {
      ...machine,
      mode: 'degressif',
      valeurOrigine: euros(20000),
      valeurResiduelle: euros(2000),
      dateAcquisition: '2025-01-01',
      dateMiseEnService: '2025-01-01',
      dureeAnnees: 5,
    }
    // Taux dégressif de 35 % appliqué à la valeur d’origine au lieu de la base.
    const ecarts = controlerDotation(degressive, EXERCICE, euros(4000))
    expect(ecarts[0]?.code).toBe('INV_BASE_AMORTISSABLE')
    expect(ecarts[0]?.montantAttendu).toBe(euros(18000))
  })

  it('explique le prorata en mois pour une immobilisation dégressive', () => {
    const degressive: Immobilisation = {
      ...machine,
      mode: 'degressif',
      valeurOrigine: euros(20000),
      dateAcquisition: '2025-04-12',
      dateMiseEnService: '2025-04-12',
    }
    const ecarts = controlerDotation(degressive, EXERCICE, euros(7000))
    expect(ecarts[0]?.code).toBe('INV_PRORATA_TEMPORIS')
    expect(ecarts[0]?.explication).toContain('9 mois sur 12')
  })
})

describe('contrôle de la dépréciation', () => {
  const parametres = {
    valeurBrute: euros(30000),
    cumulAmortissements: euros(12000),
    valeurActuelle: euros(15000),
  }

  it('ne relève rien sur une dépréciation juste', () => {
    expect(controlerDepreciation(parametres, euros(3000))).toEqual([])
  })

  it('signale un montant qui ne correspond à aucune base', () => {
    const ecarts = controlerDepreciation(parametres, euros(4200))
    expect(ecarts[0]?.code).toBe('MT_MONTANT_ERRONE')
    expect(ecarts[0]?.explication).toContain('valeur nette comptable')
  })

  it('ne déprécie pas une immobilisation dont la valeur actuelle dépasse la nette', () => {
    expect(
      controlerDepreciation({ ...parametres, valeurActuelle: euros(25000) }, 0),
    ).toEqual([])
  })
})

describe('contrôle du rattachement', () => {
  const parametres = {
    montant: euros(1200),
    periode: { debut: '2025-09-01', fin: '2026-08-31' },
    exercice: EXERCICE,
  }

  it('ne relève rien sur une régularisation juste', () => {
    expect(controlerRattachement(parametres, euros(800))).toEqual([])
    expect(controlerRattachement({ ...parametres, base: 'mois' }, euros(800))).toEqual([])
  })

  it('tolère le centime et le nomme', () => {
    const ecarts = controlerRattachement(parametres, euros(800.01))
    expect(ecarts.map((e) => e.code)).toEqual(['MT_ECART_ARRONDI'])
  })

  it('signale une opération datée hors exercice', () => {
    expect(controlerDateDOperation('2025-06-30', EXERCICE)).toEqual([])
    const ecarts = controlerDateDOperation('2026-01-15', EXERCICE)
    expect(ecarts[0]?.code).toBe('INV_RATTACHEMENT_EXERCICE')
  })
})

describe('catalogue', () => {
  it('rédige chaque écart, avec ou sans détail', () => {
    const details = {
      ligne: 1,
      compteConstate: '44566',
      compteAttendu: '44562',
      montantConstate: euros(1200),
      montantAttendu: euros(1000),
      tauxConstate: 1000,
      tauxAttendu: 2000,
      journalConstate: 'VE',
      journalAttendu: 'AC',
      date: '2025-02-05',
      dateAttendue: '2025-02-04',
      exerciceDebut: '2025-01-01',
      exerciceFin: '2025-12-31',
      numeroPiece: 'FA-114',
    }
    for (const code of CODES_ECART) {
      for (const jeu of [details, {}]) {
        const ecart = creerEcart(code, jeu)
        expect(ecart.explication, code).not.toContain('undefined')
        expect(ecart.explication, code).not.toContain('NaN')
        expect(ecart.explication.length, code).toBeGreaterThan(30)
        expect(titreEcart(code).length).toBeGreaterThan(3)
        expect(ficheEcart(code).gravite).toBe(ecart.gravite)
      }
    }
  })

  it('permet de forcer la gravité d’un écart', () => {
    expect(creerEcart('MT_ECART_ARRONDI', {}, 'bloquant').gravite).toBe('bloquant')
  })

  it('trie les écarts par gravité puis par ligne', () => {
    const tries = trierEcarts([
      creerEcart('MT_ECART_ARRONDI', { ligne: 0 }),
      creerEcart('STRUCT_DESEQUILIBRE', { montantConstate: 100 }),
      creerEcart('SENS_INVERSE', { ligne: 2, compteConstate: '607' }),
      creerEcart('SENS_INVERSE', { ligne: 1, compteConstate: '401' }),
    ])
    expect(tries.map((e) => e.code)).toEqual([
      'STRUCT_DESEQUILIBRE',
      'SENS_INVERSE',
      'SENS_INVERSE',
      'MT_ECART_ARRONDI',
    ])
    expect(tries[1]?.ligne).toBe(1)
  })
})
