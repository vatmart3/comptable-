import { describe, expect, it } from 'vitest'
import { DOSSIER, ECRITURES, ecriture, ligne } from '../fixtures/garage-vidal'
import { CHAMPS_FEC, analyserFEC, exporterFEC, lignesFEC, lireMontantFEC, nomFichierFEC } from './fec'

describe('export du fichier des écritures comptables', () => {
  const { nom, contenu } = exporterFEC(DOSSIER, ECRITURES)
  const lignes = contenu.split('\r\n').filter((l) => l !== '')

  it('nomme le fichier selon la règle : SIREN, FEC, date de clôture', () => {
    expect(nom).toBe('812345678FEC20251231.txt')
    expect(nomFichierFEC(DOSSIER)).toBe(nom)
  })

  it('porte les dix-huit champs réglementaires dans l’ordre', () => {
    expect(lignes[0]?.split('\t')).toEqual([...CHAMPS_FEC])
    expect(CHAMPS_FEC).toHaveLength(18)
  })

  it('écrit une ligne par ligne d’écriture', () => {
    const nombreDeLignes = ECRITURES.reduce((total, e) => total + e.lignes.length, 0)
    expect(lignes).toHaveLength(nombreDeLignes + 1)
  })

  it('numérote les écritures chronologiquement par journal', () => {
    const brutes = lignesFEC(DOSSIER, ECRITURES)
    const numerosBanque = [...new Set(brutes.filter((l) => l.JournalCode === 'BQ').map((l) => l.EcritureNum))]
    expect(numerosBanque).toEqual(['BQ000001', 'BQ000002'])
  })

  it('formate les dates en AAAAMMJJ et les montants à la virgule', () => {
    const premiere = lignesFEC(DOSSIER, ECRITURES)[0]!
    expect(premiere.EcritureDate).toBe('20250101')
    expect(premiere.ValidDate).toBe('20260115')
    expect(premiere.Debit).toBe('3000,00')
    expect(premiere.Credit).toBe('0,00')
    expect(premiere.Debit).not.toMatch(/\s/)
  })

  it('reporte le lettrage et sa date', () => {
    const lettree = lignesFEC(DOSSIER, ECRITURES).find((l) => l.EcritureLet !== '')!
    expect(lettree.EcritureLet).toBe('A')
    expect(lettree.DateLet).toBe('20250220')
  })

  it('se relit sans aucune anomalie', () => {
    const { lignes: relues, anomalies } = analyserFEC(contenu)
    expect(anomalies).toEqual([])
    expect(relues).toHaveLength(lignes.length - 1)
  })

  it('n’exporte que les écritures validées de l’exercice', () => {
    const brouillon = ecriture('brouillon', 'OD', '2025-06-01', 'OD-77', 'Non validée', [
      ligne('607', 'Achat', 100, 0),
      ligne('401', 'Roux', 0, 100),
    ])
    brouillon.validee = false
    const horsExercice = ecriture('hors', 'OD', '2026-01-05', 'OD-78', 'Exercice suivant', [
      ligne('607', 'Achat', 100, 0),
      ligne('401', 'Roux', 0, 100),
    ])
    expect(lignesFEC(DOSSIER, [...ECRITURES, brouillon, horsExercice])).toHaveLength(
      lignesFEC(DOSSIER, ECRITURES).length,
    )
  })
})

describe('relecture d’un fichier', () => {
  it('signale un en-tête incomplet', () => {
    const { anomalies } = analyserFEC('JournalCode\tJournalLib\n')
    expect(anomalies.some((a) => a.message.includes('champs'))).toBe(true)
  })

  it('signale un montant mal formé', () => {
    const { contenu } = exporterFEC(DOSSIER, ECRITURES)
    const abime = contenu.replace('3000,00', '3000.00')
    expect(analyserFEC(abime).anomalies.some((a) => a.champ === 'Debit')).toBe(true)
  })

  it('signale un fichier déséquilibré', () => {
    const { contenu } = exporterFEC(DOSSIER, ECRITURES)
    const abime = contenu.replace('3000,00\t0,00', '3100,00\t0,00')
    expect(analyserFEC(abime).anomalies.some((a) => a.message.includes('déséquilibré'))).toBe(true)
  })

  it('signale une date hors format', () => {
    const { contenu } = exporterFEC(DOSSIER, ECRITURES)
    const abime = contenu.replace('20250101', '01/01/2025')
    expect(analyserFEC(abime).anomalies.some((a) => a.champ === 'EcritureDate')).toBe(true)
  })

  it('relit un montant', () => {
    expect(lireMontantFEC('1234,56')).toBe(123456)
    expect(lireMontantFEC('0,00')).toBe(0)
  })

  it('signale un fichier vide', () => {
    expect(analyserFEC('').anomalies[0]?.message).toBe('Fichier vide.')
  })
})
