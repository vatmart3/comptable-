/**
 * Le lexique est la porte d'entrée de l'atelier : c'est par lui que
 * « assurance incendie » devient 616. S'il se trompe, tout le reste suit.
 */
import { describe, expect, it } from 'vitest'
import { chercher, LEXIQUE, meilleure, parClasse, pieges } from '@/lib/accounting/lexique'
import { accountClass, isValidAccountNumber } from '@/lib/accounting/account'
import { TAUX } from '@/lib/accounting/vat'
import { PCG } from '@/prisma/data/pcg'

describe('intégrité du lexique', () => {
  it('ne référence que des comptes du plan comptable', () => {
    const connus = new Set(PCG.map((compte) => compte.numero))
    for (const entree of LEXIQUE) {
      expect(isValidAccountNumber(entree.compte), entree.compte).toBe(true)
      expect(connus.has(entree.compte), `${entree.compte} absent du PCG`).toBe(true)
    }
  })

  it('donne à chaque entrée au moins un terme et une note', () => {
    for (const entree of LEXIQUE) {
      expect(entree.termes.length, entree.compte).toBeGreaterThan(0)
      expect(entree.note.length, entree.compte).toBeGreaterThan(25)
    }
  })

  it('n’annonce que des taux de TVA légaux', () => {
    const legaux = [TAUX.NORMAL, TAUX.INTERMEDIAIRE, TAUX.REDUIT, TAUX.PARTICULIER]
    for (const entree of LEXIQUE) {
      if (entree.tva == null) continue
      expect(legaux, entree.compte).toContain(entree.tva)
    }
  })

  it('donne un sens cohérent avec la classe du compte', () => {
    for (const entree of LEXIQUE) {
      const classe = accountClass(entree.compte)
      // Une charge (6) se débite, un produit (7) se crédite — sauf les
      // comptes de rabais, dont le sens est inversé, et qui sont justement
      // le piège qu'on veut enseigner.
      if (classe === 6 && !entree.compte.startsWith('609')) {
        expect(entree.sens, entree.compte).toBe('debit')
      }
      if (classe === 7 && !entree.compte.startsWith('709')) {
        expect(entree.sens, entree.compte).toBe('credit')
      }
    }
  })

  it('couvre les huit familles utiles au programme', () => {
    for (const classe of [1, 2, 4, 5, 6, 7]) {
      expect(parClasse(classe).length, `classe ${classe}`).toBeGreaterThan(0)
    }
  })

  it('recense les pièges d’épreuve', () => {
    expect(pieges().length).toBeGreaterThan(20)
    for (const entree of pieges()) {
      expect(entree.piege!.length).toBeGreaterThan(25)
    }
  })
})

describe('recherche', () => {
  const cas: [string, string][] = [
    ['assurance incendie', '616000'],
    ['assurance', '616000'],
    ['achat de marchandises', '607000'],
    ['marchandises', '607000'],
    ['matière première', '601000'],
    ['loyer', '613200'],
    ['honoraires', '622600'],
    ['timbre', '626000'],
    ['urssaf', '645100'],
    ['salaire', '641100'],
    ['ordinateur', '218300'],
    ['terrain', '211000'],
    ['emprunt', '164000'],
    ['client douteux', '416000'],
    ['tva collectée', '445711'],
    ['tva déductible', '445660'],
    ['caisse', '530000'],
    ['dépôt de garantie', '275000'],
    ['carburant', '606150'],
    ['dotation aux amortissements', '681120'],
  ]

  it.each(cas)('« %s » → %s', (requete, compte) => {
    expect(chercher(requete, 1)[0]?.entree.compte).toBe(compte)
  })

  it('ignore les accents et la casse', () => {
    expect(chercher('ASSURANCE INCENDIE', 1)[0]?.entree.compte).toBe('616000')
    expect(chercher('depot de garantie', 1)[0]?.entree.compte).toBe('275000')
    expect(chercher('matieres premieres', 1)[0]?.entree.compte).toBe('601000')
  })

  it('accepte un numéro de compte tapé directement', () => {
    expect(chercher('616', 1)[0]?.entree.compte).toBe('616000')
    expect(chercher('607', 1)[0]?.entree.compte).toBe('607000')
  })

  it('ne rend rien sur une requête vide', () => {
    expect(chercher('')).toEqual([])
    expect(chercher('   ')).toEqual([])
  })

  it('borne le nombre de résultats', () => {
    expect(chercher('a', 3).length).toBeLessThanOrEqual(3)
  })

  it('refuse de deviner sous le seuil de confiance', () => {
    expect(meilleure('zzzzz')).toBeNull()
  })
})

describe('les pièges enseignés', () => {
  it('sait que l’assurance n’a pas de TVA', () => {
    const assurance = chercher('assurance', 1)[0]?.entree
    expect(assurance?.tva).toBeNull()
    expect(assurance?.piege).toContain('PAS de TVA')
  })

  it('sait que les timbres n’ont pas de TVA', () => {
    expect(chercher('timbre', 1)[0]?.entree.tva).toBeNull()
  })

  it('sait qu’un terrain ne s’amortit pas', () => {
    expect(chercher('terrain', 1)[0]?.entree.piege).toContain('amortir un terrain')
  })

  it('sait qu’une immobilisation se paie en 404, pas en 401', () => {
    expect(chercher('fournisseur d’immobilisation', 1)[0]?.entree.compte).toBe('404000')
  })

  it('sait qu’un dépôt de garantie n’est pas une charge', () => {
    expect(chercher('dépôt de garantie', 1)[0]?.entree.compte).toBe('275000')
  })

  it('sait que les rabais accordés se débitent malgré la classe 7', () => {
    const rabais = LEXIQUE.find((entree) => entree.compte === '709000')
    expect(rabais?.sens).toBe('debit')
  })
})
