import { describe, expect, it } from 'vitest'
import {
  chercherComptes,
  construireLignes,
  fold,
  parseLigne,
  type LigneContexte,
} from '@/lib/accounting/ligne'
import { isBalanced } from '@/lib/accounting/entry'
import { PCG } from '@/prisma/data/pcg'

const CONTEXTE: LigneContexte = {
  comptes: PCG.map((compte) => ({
    numero: compte.numero,
    libelle: compte.libelle,
    tauxTvaAttendu: compte.tauxTva ?? null,
  })),
  tiers: [
    { code: 'FOUTOTAL', nom: 'Total Énergies', type: 'fournisseur' },
    { code: 'FOUORANGE', nom: 'Orange Business', type: 'fournisseur' },
    { code: 'CLIMERIDIEN', nom: 'Méridien Studio', type: 'client' },
  ],
  // Un mercredi.
  aujourdHui: new Date(Date.UTC(2025, 5, 11)),
}

function lire(saisie: string) {
  return parseLigne(saisie, CONTEXTE)
}

describe('normalisation', () => {
  it('efface accents et casse', () => {
    expect(fold('Réglé — Énergies')).toBe('regle — energies')
  })
})

describe('la phrase de référence du cahier des charges', () => {
  const resultat = lire('payé 240€ gasoil Total CB hier')

  it('produit une écriture équilibrée', () => {
    expect(resultat.ecriture).not.toBeNull()
    expect(isBalanced(resultat.ecriture!.lines)).toBe(true)
  })

  it('imputate en 606100 / 445660 / 512000, comme annoncé au § 5.1', () => {
    const comptes = resultat.ecriture!.lines.map((l) => l.accountNumero)
    expect(comptes).toEqual(['606100', '445660', '512000'])
  })

  it('traite les 240 € comme un TTC — c’est ce qu’un humain veut dire', () => {
    const [charge, tva, banque] = resultat.ecriture!.lines
    expect(charge?.debit).toBe(20_000)
    expect(tva?.debit).toBe(4_000)
    expect(banque?.credit).toBe(24_000)
  })

  it('lit la date relative', () => {
    expect(resultat.ecriture!.date.toISOString().slice(0, 10)).toBe('2025-06-10')
  })

  it('choisit le journal de banque', () => {
    expect(resultat.ecriture!.journalCode).toBe('BQ')
  })

  it('rattache le tiers et le nomme dans le libellé', () => {
    expect(resultat.chips.find((c) => c.kind === 'tiers')?.value).toBe('FOUTOTAL')
    expect(resultat.ecriture!.libelle).toBe('Total Énergies — gasoil')
  })

  it('explique son raisonnement en une phrase', () => {
    expect(resultat.raison).toContain('606100')
    expect(resultat.raison).toContain('20 %')
  })
})

describe('montants', () => {
  const cas: [string, number][] = [
    ['payé 240 gasoil CB', 24_000],
    ['payé 240,50 € gasoil CB', 24_050],
    ['payé 1 234,56 € gasoil CB', 123_456],
    ['payé 1234.56 euros gasoil CB', 123_456],
    ['gasoil 89 € CB', 8_900],
  ]
  it.each(cas)('lit le montant de « %s »', (saisie, attendu) => {
    const ttc = lire(saisie).ecriture!.lines.reduce((acc, l) => acc + l.credit, 0)
    expect(ttc).toBe(attendu)
  })

  it('accepte un montant annoncé hors taxe', () => {
    const lignes = lire('payé 200 HT gasoil CB').ecriture!.lines
    expect(lignes[0]?.debit).toBe(20_000)
    expect(lignes[2]?.credit).toBe(24_000)
  })
})

describe('dates', () => {
  const cas: [string, string][] = [
    ['payé 100 gasoil CB hier', '2025-06-10'],
    ['payé 100 gasoil CB avant-hier', '2025-06-09'],
    ["payé 100 gasoil CB aujourd'hui", '2025-06-11'],
    ['payé 100 gasoil CB lundi', '2025-06-09'],
    ['payé 100 gasoil CB le 03/04', '2025-04-03'],
    ['payé 100 gasoil CB le 03/04/2024', '2024-04-03'],
    ['payé 100 gasoil CB le 3 mars', '2025-03-03'],
  ]
  it.each(cas)('lit la date de « %s »', (saisie, attendu) => {
    expect(lire(saisie).ecriture!.date.toISOString().slice(0, 10)).toBe(attendu)
  })

  it('sans date, retient aujourd’hui', () => {
    expect(lire('payé 100 gasoil CB').ecriture!.date.toISOString().slice(0, 10)).toBe('2025-06-11')
  })

  it('une date sans année qui tomberait dans le futur appartient à l’an dernier', () => {
    expect(lire('payé 100 gasoil CB le 20/12').ecriture!.date.toISOString().slice(0, 10)).toBe(
      '2024-12-20',
    )
  })
})

describe('mode de règlement et journal', () => {
  const cas: [string, string, string][] = [
    ['payé 100 gasoil CB', 'BQ', '512000'],
    ['payé 100 gasoil par virement', 'BQ', '512000'],
    ['payé 100 gasoil en espèces', 'CA', '530000'],
    ['payé 100 gasoil par chèque', 'BQ', '512000'],
    ['facture de 100 gasoil', 'AC', '401000'],
  ]
  it.each(cas)('« %s » → journal %s, contrepartie %s', (saisie, journal, contrepartie) => {
    const resultat = lire(saisie)
    expect(resultat.ecriture!.journalCode).toBe(journal)
    const derniere = resultat.ecriture!.lines[resultat.ecriture!.lines.length - 1]
    expect(derniere?.accountNumero).toBe(contrepartie)
  })
})

describe('ventes', () => {
  const resultat = lire('encaissé 1 200 € prestation Méridien virement hier')

  it('inverse le sens : trésorerie au débit, produit au crédit', () => {
    const lignes = resultat.ecriture!.lines
    expect(lignes[0]?.accountNumero).toBe('512000')
    expect(lignes[0]?.debit).toBe(120_000)
    expect(lignes[1]?.accountNumero).toBe('706000')
    expect(lignes[1]?.credit).toBe(100_000)
    expect(lignes[2]?.accountNumero).toBe('445711')
    expect(lignes[2]?.credit).toBe(20_000)
  })

  it('reste équilibrée', () => {
    expect(isBalanced(resultat.ecriture!.lines)).toBe(true)
  })

  it('utilise le journal des ventes quand rien n’est encaissé', () => {
    const credit = lire('facturé 1 200 € prestation à Méridien')
    expect(credit.ecriture!.journalCode).toBe('VE')
    expect(credit.ecriture!.lines[0]?.accountNumero).toBe('411000')
  })
})

describe('TVA', () => {
  it('prend le taux attendu du compte', () => {
    // 625100 Voyages et déplacements : taux intermédiaire 10 %.
    const lignes = lire('payé 110 € train CB').ecriture!.lines
    expect(lignes[0]?.debit).toBe(10_000)
    expect(lignes[1]?.debit).toBe(1_000)
  })

  it('accepte un taux explicite qui prime sur le compte', () => {
    const lignes = lire('payé 105,50 € gasoil CB tva 5,5').ecriture!.lines
    expect(lignes[1]?.debit).toBe(550)
  })

  it('accepte l’absence de TVA', () => {
    const lignes = lire('payé 240 € assurance CB sans TVA').ecriture!.lines
    expect(lignes).toHaveLength(2)
    expect(lignes[0]?.debit).toBe(24_000)
  })

  it('utilise le compte de TVA sur immobilisations pour un compte de classe 2', () => {
    const lignes = lire('payé 1 200 € ordinateur CB').ecriture!.lines
    expect(lignes[0]?.accountNumero).toBe('218300')
    expect(lignes[1]?.accountNumero).toBe('445620')
  })

  it('ventile la TVA collectée sur le bon sous-compte', () => {
    const lignes = lire('encaissé 105,50 € vente virement tva 5,5').ecriture!.lines
    expect(lignes[2]?.accountNumero).toBe('445713')
  })
})

describe('imputation', () => {
  const cas: [string, string][] = [
    ['payé 100 loyer virement', '613200'],
    ['payé 100 honoraires avocat virement', '622600'],
    ['payé 100 restaurant CB', '625700'],
    ['payé 100 abonnement Orange CB', '626000'],
    ['payé 100 fournitures CB', '606400'],
    ['payé 100 urssaf virement', '645100'],
  ]
  it.each(cas)('« %s » → compte %s', (saisie, compte) => {
    expect(lire(saisie).ecriture!.lines[0]?.accountNumero).toBe(compte)
  })

  it('accepte un numéro de compte tapé directement, qui prime sur le lexique', () => {
    expect(lire('payé 100 gasoil 606300 CB').ecriture!.lines[0]?.accountNumero).toBe('606300')
  })
})

describe('saisies incomplètes — la ligne ne devine jamais à moitié', () => {
  it('ne propose rien sur une saisie vide', () => {
    const resultat = lire('')
    expect(resultat.ecriture).toBeNull()
    expect(resultat.chips).toEqual([])
  })

  it('signale le montant manquant', () => {
    const resultat = lire('payé gasoil CB hier')
    expect(resultat.ecriture).toBeNull()
    expect(resultat.manque).toContain('montant')
    expect(resultat.raison).toContain('montant')
  })

  it('signale la nature manquante', () => {
    const resultat = lire('payé 240 € CB hier')
    expect(resultat.ecriture).toBeNull()
    expect(resultat.manque).toContain('compte')
  })

  it('rend tout de même les puces déjà lues', () => {
    const resultat = lire('payé gasoil CB hier')
    expect(resultat.chips.map((c) => c.kind)).toContain('compte')
    expect(resultat.chips.map((c) => c.kind)).toContain('date')
  })
})

describe('autocomplétion du plan comptable', () => {
  const comptes = CONTEXTE.comptes

  it('cherche d’abord par numéro', () => {
    const trouves = chercherComptes('606', comptes)
    expect(trouves[0]?.numero.startsWith('606')).toBe(true)
  })

  it('cherche ensuite par libellé, sans accent ni casse', () => {
    const trouves = chercherComptes('honoraires', comptes)
    expect(trouves.some((compte) => compte.numero === '622600')).toBe(true)
  })

  it('borne le nombre de résultats', () => {
    expect(chercherComptes('', comptes, 5)).toHaveLength(5)
  })
})

describe('brouillon éditable — ce que les puces modifient', () => {
  it('expose un brouillon dès que l’écriture est complète', () => {
    const { brouillon } = lire('payé 240€ gasoil Total CB hier')
    expect(brouillon).toEqual({
      sens: 'achat',
      date: new Date(Date.UTC(2025, 5, 10)),
      montantTtc: 24_000,
      compteNumero: '606100',
      tauxTva: 20_000,
      journalCode: 'BQ',
      contrepartieNumero: '512000',
      tiersCode: 'FOUTOTAL',
      libelle: 'Total Énergies — gasoil',
    })
  })

  it('reconstruit une écriture équilibrée depuis un brouillon modifié', () => {
    const { brouillon } = lire('payé 240€ gasoil Total CB hier')
    const modifie = { ...brouillon!, montantTtc: 105_50, tauxTva: 5_500 }
    const lignes = construireLignes(modifie)
    expect(isBalanced(lignes)).toBe(true)
    expect(lignes[0]?.debit).toBe(10_000)
    expect(lignes[1]?.debit).toBe(550)
  })

  it('change de sens sans se déséquilibrer', () => {
    const { brouillon } = lire('payé 240€ gasoil Total CB hier')
    const vente = { ...brouillon!, sens: 'vente' as const, contrepartieNumero: '411000', compteNumero: '706000' }
    const lignes = construireLignes(vente)
    expect(isBalanced(lignes)).toBe(true)
    expect(lignes[0]?.accountNumero).toBe('411000')
    expect(lignes[0]?.debit).toBe(24_000)
  })
})

describe('pesée — ce que La Balance affiche pendant la frappe', () => {
  it('ne pèse rien sur une saisie vide', () => {
    expect(lire('').pesee).toEqual({ debit: 0, credit: 0 })
  })

  it('penche à fond quand le montant est connu mais pas l’imputation', () => {
    const { pesee, ecriture } = lire('payé 240 € CB hier')
    expect(ecriture).toBeNull()
    expect(pesee).toEqual({ debit: 0, credit: 24_000 })
  })

  it('penche de l’autre côté pour une vente incomplète', () => {
    expect(lire('encaissé 240 € virement').pesee).toEqual({ debit: 240_00, credit: 0 })
  })

  it('s’équilibre exactement dès que l’écriture est complète', () => {
    const { pesee } = lire('payé 240€ gasoil Total CB hier')
    expect(pesee.debit).toBe(pesee.credit)
    expect(pesee.debit).toBe(24_000)
  })

  it('ne pèse rien tant qu’aucun montant n’est lu', () => {
    expect(lire('payé gasoil CB').pesee).toEqual({ debit: 0, credit: 0 })
  })
})

describe('libellé de l’écriture', () => {
  it('reprend le mot réellement lu, pas le libellé du compte', () => {
    // « Total Énergies — gasoil » se relit dans un grand livre.
    // « Total Énergies — Fournitures non stockables (eau, énergie) », non.
    expect(lire('payé 240€ gasoil Total CB').ecriture!.libelle).toBe('Total Énergies — gasoil')
    expect(lire('payé 100 loyer virement').ecriture!.libelle).toBe('Loyer')
    expect(lire('payé 100 restaurant CB').ecriture!.libelle).toBe('Restaurant')
  })

  it('retombe sur le libellé du compte quand aucun mot n’a été lu', () => {
    expect(lire('payé 100 606300 CB').ecriture!.libelle).toBe(
      'Fournitures d’entretien et petit équipement',
    )
  })
})
