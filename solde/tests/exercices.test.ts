/**
 * La banque d'exercices est du contenu pédagogique : un corrigé faux
 * apprendrait faux. Ces tests vérifient d'abord les corrigés eux-mêmes,
 * ensuite la correction.
 */
import { describe, expect, it } from 'vitest'
import { corriger, EXERCICES, THEMES, type MouvementSaisi } from '@/lib/accounting/exercices'
import { isValidAccountNumber } from '@/lib/accounting/account'
import { PCG } from '@/prisma/data/pcg'
import { LEXIQUE } from '@/lib/accounting/lexique'

describe('intégrité de la banque', () => {
  it('n’a pas d’identifiant en double', () => {
    const ids = EXERCICES.map((exercice) => exercice.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('propose au moins un exercice par thème', () => {
    for (const theme of Object.keys(THEMES)) {
      expect(EXERCICES.some((exercice) => exercice.theme === theme), theme).toBe(true)
    }
  })

  it('donne à chaque exercice un énoncé et un corrigé rédigés', () => {
    for (const exercice of EXERCICES) {
      expect(exercice.enonce.length, exercice.id).toBeGreaterThan(60)
      expect(exercice.corrige.length, exercice.id).toBeGreaterThan(80)
      expect(exercice.attendu.length, exercice.id).toBeGreaterThan(0)
    }
  })
})

describe('justesse des corrigés', () => {
  it('n’attend que des écritures équilibrées', () => {
    for (const exercice of EXERCICES) {
      for (const ecriture of exercice.attendu) {
        const debit = ecriture.mouvements
          .filter((m) => m.sens === 'debit')
          .reduce((total, m) => total + m.montant, 0)
        const credit = ecriture.mouvements
          .filter((m) => m.sens === 'credit')
          .reduce((total, m) => total + m.montant, 0)
        expect(debit, `${exercice.id} — ${ecriture.libelle}`).toBe(credit)
      }
    }
  })

  it('n’utilise que des comptes du plan comptable', () => {
    const connus = new Set(PCG.map((compte) => compte.numero))
    for (const exercice of EXERCICES) {
      for (const ecriture of exercice.attendu) {
        for (const mouvement of ecriture.mouvements) {
          expect(isValidAccountNumber(mouvement.compte), mouvement.compte).toBe(true)
          expect(connus.has(mouvement.compte), `${exercice.id} : ${mouvement.compte} hors PCG`).toBe(true)
        }
      }
    }
  })

  it('n’attend jamais un montant nul ou négatif', () => {
    for (const exercice of EXERCICES) {
      for (const ecriture of exercice.attendu) {
        for (const mouvement of ecriture.mouvements) {
          expect(mouvement.montant, `${exercice.id}`).toBeGreaterThan(0)
        }
      }
    }
  })

  it('vérifie les corrigés que l’énoncé permet de recalculer', () => {
    const trouver = (id: string) => EXERCICES.find((exercice) => exercice.id === id)!

    // Achat 1 200 HT à 20 % : TVA 240, dette 1 440.
    const achat = trouver('ach-1').attendu[0]!.mouvements
    expect(achat.find((m) => m.compte === '445660')?.montant).toBe(24_000)
    expect(achat.find((m) => m.compte === '401000')?.montant).toBe(144_000)

    // Remise de 10 % sur 2 000 : net commercial 1 800, TVA 360.
    const remise = trouver('ach-2').attendu[0]!.mouvements
    expect(remise.find((m) => m.compte === '607000')?.montant).toBe(180_000)
    expect(remise.some((m) => m.compte === '609000')).toBe(false)

    // Assurance : aucune TVA.
    expect(trouver('ach-4').attendu[0]!.mouvements).toHaveLength(2)

    // Paie : charge de l'entreprise = brut + patronales ; 431 = les deux parts.
    const paie = trouver('pai-1').attendu[0]!.mouvements
    expect(paie.find((m) => m.compte === '431000')?.montant).toBe(180_000)
    expect(paie.find((m) => m.compte === '421000')?.montant).toBe(240_000)

    // Dépréciation calculée sur le HT, pas le TTC.
    const douteux = trouver('reg-3').attendu[1]!.mouvements
    expect(douteux.find((m) => m.compte === '491000')?.montant).toBe(80_000)

    // Emprunt : seuls les intérêts sont une charge.
    const emprunt = trouver('reg-5').attendu[0]!.mouvements
    expect(emprunt.find((m) => m.compte === '661100')?.montant).toBe(80_000)
    expect(emprunt.find((m) => m.compte === '164000')?.montant).toBe(420_000)
  })

  it('renvoie à des notions présentes dans le lexique', () => {
    const comptesLexique = new Set(LEXIQUE.map((entree) => entree.compte))
    const utilises = new Set(
      EXERCICES.flatMap((exercice) =>
        exercice.attendu.flatMap((ecriture) => ecriture.mouvements.map((m) => m.compte)),
      ),
    )
    const orphelins = [...utilises].filter((compte) => !comptesLexique.has(compte))
    // Tolérance : quelques comptes très spécifiques n'ont pas d'entrée propre.
    expect(orphelins.length, `sans entrée de lexique : ${orphelins.join(', ')}`).toBeLessThanOrEqual(3)
  })
})

describe('correction', () => {
  const attendu = EXERCICES.find((exercice) => exercice.id === 'ach-1')!.attendu[0]!

  const saisir = (mouvements: readonly [string, number, number][]): MouvementSaisi[] =>
    mouvements.map(([compte, debit, credit]) => ({ compte, debit, credit }))

  it('valide une écriture juste', () => {
    const resultat = corriger(
      saisir([
        ['607000', 120_000, 0],
        ['445660', 24_000, 0],
        ['401000', 0, 144_000],
      ]),
      attendu,
    )
    expect(resultat.juste).toBe(true)
    expect(resultat.score).toBe(100)
    expect(resultat.ecarts).toEqual([])
  })

  it('accepte les lignes dans n’importe quel ordre', () => {
    const resultat = corriger(
      saisir([
        ['401000', 0, 144_000],
        ['445660', 24_000, 0],
        ['607000', 120_000, 0],
      ]),
      attendu,
    )
    expect(resultat.juste).toBe(true)
  })

  it('signale un compte oublié', () => {
    const resultat = corriger(
      saisir([
        ['607000', 120_000, 0],
        ['401000', 0, 120_000],
      ]),
      attendu,
    )
    expect(resultat.ecarts.some((ecart) => ecart.code === 'compte_absent' && ecart.compte === '445660')).toBe(true)
  })

  it('distingue un sens inversé d’un compte oublié', () => {
    const resultat = corriger(
      saisir([
        ['607000', 120_000, 0],
        ['445660', 24_000, 0],
        ['401000', 144_000, 0],
      ]),
      attendu,
    )
    const sens = resultat.ecarts.find((ecart) => ecart.code === 'sens_inverse')
    expect(sens?.compte).toBe('401000')
    expect(sens?.message).toContain('crédit')
    expect(resultat.ecarts.some((ecart) => ecart.code === 'compte_absent')).toBe(false)
  })

  it('signale un montant faux sans crier au compte manquant', () => {
    const resultat = corriger(
      saisir([
        ['607000', 120_000, 0],
        ['445660', 12_000, 0],
        ['401000', 0, 132_000],
      ]),
      attendu,
    )
    const montant = resultat.ecarts.find((ecart) => ecart.code === 'montant_faux')
    expect(montant?.compte).toBe('445660')
    expect(montant?.message).toContain('240')
  })

  it('signale un compte en trop', () => {
    const resultat = corriger(
      saisir([
        ['607000', 120_000, 0],
        ['445660', 24_000, 0],
        ['401000', 0, 144_000],
        ['626000', 1_000, 0],
        ['512000', 0, 1_000],
      ]),
      attendu,
    )
    expect(resultat.ecarts.filter((ecart) => ecart.code === 'compte_en_trop')).toHaveLength(2)
  })

  it('signale le déséquilibre avant tout le reste', () => {
    const resultat = corriger(
      saisir([
        ['607000', 120_000, 0],
        ['445660', 24_000, 0],
        ['401000', 0, 100_000],
      ]),
      attendu,
    )
    expect(resultat.ecarts[0]?.code).toBe('desequilibre')
    expect(resultat.juste).toBe(false)
  })

  it('note partiellement une écriture à moitié juste', () => {
    const resultat = corriger(
      saisir([
        ['607000', 120_000, 0],
        ['445660', 24_000, 0],
        ['401000', 144_000, 0],
      ]),
      attendu,
    )
    expect(resultat.score).toBe(67)
  })
})
