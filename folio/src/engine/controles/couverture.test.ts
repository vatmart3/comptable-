import { describe, expect, it } from 'vitest'
import { euros } from '../core/montant'
import type { LigneEcriture } from '../types/ecriture'
import type { Piece } from '../types/piece'
import { ECRITURES, EXERCICE, ecriture, ligne } from '../fixtures/garage-vidal'
import type { Immobilisation } from '../calculs/amortissements'
import { CODES_ECART, type CodeEcart } from './codes'
import { graviteEcart, type Ecart } from './catalogue'
import { controlerEcriture } from './index'
import { diagnostiquer } from './diagnostic'
import { controlerDepreciation, controlerDotation, controlerRattachement } from './inventaire'
import { controlerConcordanceResultat, controlerDossier } from './global'

const CONTEXTE = { exercice: EXERCICE }

const enTete = {
  journalCode: 'AC' as const,
  date: '2025-02-05',
  numeroPiece: 'FA-114',
}

/** Facture d'achat de marchandises : 1 000,00 € HT, TVA 20 %. */
const FACTURE: Piece = {
  id: 'p1',
  type: 'facture-achat',
  emetteur: 'Roux',
  numero: 'FA-114',
  date: '2025-02-05',
  detail: { lignes: [{ designation: 'Pièces', quantite: 1, prixUnitaireHT: euros(1000), tauxTVA: 2000 }] },
  montantHT: euros(1000),
  montantTVA: euros(200),
  montantTTC: euros(1200),
  netAPayer: euros(1200),
  journalAttendu: 'AC',
  ecritureAttendue: [
    ligne('607', 'Achats de marchandises', 1000, 0),
    ligne('44566', 'TVA déductible', 200, 0),
    ligne('401', 'Fournisseur Roux', 0, 1200),
  ],
}

const ATTENDUE = FACTURE.ecritureAttendue

const immobilisation: Immobilisation = {
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

const codes = (ecarts: readonly Ecart[]): CodeEcart[] => ecarts.map((e) => e.code)

interface Scenario {
  code: CodeEcart
  intitule: string
  produire: () => Ecart[]
}

/**
 * Chaque code du catalogue est adossé à une erreur qu'un étudiant commet
 * réellement. Un code sans scénario est un code que le moteur ne sait pas
 * produire : le test final l'interdit.
 */
const SCENARIOS: Scenario[] = [
  // ---- Structure ----------------------------------------------------------
  {
    code: 'STRUCT_DESEQUILIBRE',
    intitule: 'la contrepartie est saisie pour le montant hors taxes',
    produire: () =>
      controlerEcriture(
        { ...enTete, lignes: [ligne('607', 'Achat', 1000, 0), ligne('401', 'Roux', 0, 900)] },
        CONTEXTE,
      ),
  },
  {
    code: 'STRUCT_ECRITURE_VIDE',
    intitule: 'l’écriture est validée sans aucune ligne',
    produire: () => controlerEcriture({ ...enTete, lignes: [] }, CONTEXTE),
  },
  {
    code: 'STRUCT_LIGNE_SANS_MONTANT',
    intitule: 'une ligne porte un compte sans montant',
    produire: () =>
      controlerEcriture(
        {
          ...enTete,
          lignes: [ligne('607', 'Achat', 1000, 0), ligne('44566', 'TVA', 0, 0), ligne('401', 'Roux', 0, 1000)],
        },
        CONTEXTE,
      ),
  },
  {
    code: 'STRUCT_LIGNE_DEBIT_ET_CREDIT',
    intitule: 'une ligne est mouvementée au débit et au crédit',
    produire: () =>
      controlerEcriture(
        { ...enTete, lignes: [ligne('607', 'Achat', 1000, 200), ligne('401', 'Roux', 0, 800)] },
        CONTEXTE,
      ),
  },
  {
    code: 'STRUCT_MONTANT_NEGATIF',
    intitule: 'un avoir est saisi en montant négatif au lieu d’être inversé',
    produire: () =>
      controlerEcriture(
        { ...enTete, lignes: [ligne('607', 'Avoir', -1000, 0), ligne('401', 'Roux', 0, -1000)] },
        CONTEXTE,
      ),
  },
  {
    code: 'STRUCT_COMPTE_INEXISTANT',
    intitule: 'le numéro tapé ne figure pas au plan comptable',
    produire: () =>
      controlerEcriture(
        { ...enTete, lignes: [ligne('9999', 'Achat', 1000, 0), ligne('401', 'Roux', 0, 1000)] },
        CONTEXTE,
      ),
  },
  {
    code: 'STRUCT_JOURNAL_INCOHERENT',
    intitule: 'une facture d’achat est passée au journal des ventes',
    produire: () =>
      controlerEcriture(
        { ...enTete, journalCode: 'VE', lignes: [...ATTENDUE] },
        CONTEXTE,
      ),
  },
  {
    code: 'STRUCT_DATE_HORS_EXERCICE',
    intitule: 'l’écriture est datée de l’exercice suivant',
    produire: () =>
      controlerEcriture({ ...enTete, date: '2026-02-05', lignes: [...ATTENDUE] }, CONTEXTE),
  },
  {
    code: 'STRUCT_DATE_INVALIDE',
    intitule: 'la date tapée n’existe pas',
    produire: () =>
      controlerEcriture({ ...enTete, date: '2025-02-30', lignes: [...ATTENDUE] }, CONTEXTE),
  },
  {
    code: 'STRUCT_DATE_ERRONEE',
    intitule: 'l’écriture est datée du jour de la saisie et non de la pièce',
    produire: () =>
      diagnostiquer(ATTENDUE, ATTENDUE, {
        dateSaisie: '2025-03-01',
        dateAttendue: '2025-02-05',
        exercice: EXERCICE,
      }),
  },
  {
    code: 'STRUCT_PIECE_MANQUANTE',
    intitule: 'aucun numéro de pièce n’est renseigné',
    produire: () =>
      controlerEcriture({ ...enTete, numeroPiece: '', lignes: [...ATTENDUE] }, CONTEXTE),
  },
  {
    code: 'STRUCT_PIECE_DOUBLON',
    intitule: 'la facture est comptabilisée une seconde fois',
    produire: () =>
      controlerEcriture(
        { ...enTete, id: 'nouvelle', lignes: [...ATTENDUE] },
        { ...CONTEXTE, ecrituresExistantes: ECRITURES },
      ),
  },

  // ---- Sens et affectation -------------------------------------------------
  {
    code: 'SENS_INVERSE',
    intitule: 'l’écriture est passée à l’envers',
    produire: () =>
      diagnostiquer(
        [
          ligne('607', 'Achat', 0, 1000),
          ligne('44566', 'TVA', 0, 200),
          ligne('401', 'Roux', 1200, 0),
        ],
        ATTENDUE,
      ),
  },
  {
    code: 'SENS_CONFUSION_BILAN_GESTION',
    intitule: 'une prime d’assurance est portée en charge constatée d’avance',
    produire: () =>
      diagnostiquer(
        [ligne('486', 'Assurance', 1000, 0), ligne('401', 'Assureur', 0, 1000)],
        [ligne('616', 'Primes d’assurances', 1000, 0), ligne('401', 'Assureur', 0, 1000)],
      ),
  },
  {
    code: 'SENS_CONFUSION_401_404',
    intitule: 'la dette sur immobilisation est portée en fournisseur d’exploitation',
    produire: () =>
      diagnostiquer(
        [ligne('2183', 'Ordinateur', 1000, 0), ligne('401', 'Fournisseur', 0, 1000)],
        [ligne('2183', 'Ordinateur', 1000, 0), ligne('404', 'Fournisseur d’immobilisations', 0, 1000)],
      ),
  },
  {
    code: 'SENS_CONFUSION_411_462',
    intitule: 'la créance sur cession est portée en clients',
    produire: () =>
      diagnostiquer(
        [ligne('411', 'Acquéreur', 1200, 0), ligne('775', 'Cession', 0, 1200)],
        [ligne('462', 'Créance sur cession', 1200, 0), ligne('775', 'Cession', 0, 1200)],
      ),
  },
  {
    code: 'SENS_CONFUSION_CHARGE_IMMOBILISATION',
    intitule: 'un ordinateur est passé en charge',
    produire: () =>
      diagnostiquer(
        [ligne('6063', 'Ordinateur', 1000, 0), ligne('404', 'Fournisseur', 0, 1000)],
        [ligne('2183', 'Ordinateur', 1000, 0), ligne('404', 'Fournisseur', 0, 1000)],
      ),
  },
  {
    code: 'SENS_CLASSE_VOISINE',
    intitule: 'les marchandises sont portées en matières premières',
    produire: () =>
      diagnostiquer(
        [ligne('601', 'Achat', 1000, 0), ligne('401', 'Roux', 0, 1000)],
        [ligne('607', 'Achat', 1000, 0), ligne('401', 'Roux', 0, 1000)],
      ),
  },

  // ---- TVA ------------------------------------------------------------------
  {
    code: 'TVA_CONFUSION_44566_44562',
    intitule: 'la TVA d’une immobilisation est portée en 44566',
    produire: () =>
      diagnostiquer(
        [ligne('2183', 'Ordinateur', 1000, 0), ligne('44566', 'TVA', 200, 0), ligne('404', 'Fournisseur', 0, 1200)],
        [ligne('2183', 'Ordinateur', 1000, 0), ligne('44562', 'TVA', 200, 0), ligne('404', 'Fournisseur', 0, 1200)],
      ),
  },
  {
    code: 'TVA_CONFUSION_44571_44551',
    intitule: 'la TVA facturée au client est portée en TVA à décaisser',
    produire: () =>
      diagnostiquer(
        [ligne('411', 'Client', 1200, 0), ligne('707', 'Vente', 0, 1000), ligne('44551', 'TVA', 0, 200)],
        [ligne('411', 'Client', 1200, 0), ligne('707', 'Vente', 0, 1000), ligne('44571', 'TVA', 0, 200)],
      ),
  },
  {
    code: 'TVA_TAUX_NON_CONFORME',
    intitule: 'la TVA est calculée au taux de 10 % sur une base à 20 %',
    produire: () =>
      controlerEcriture(
        {
          ...enTete,
          lignes: [
            ligne('607', 'Achat', 1000, 0),
            ligne('44566', 'TVA', 100, 0),
            ligne('401', 'Roux', 0, 1100),
          ],
        },
        { ...CONTEXTE, piece: FACTURE },
      ),
  },
  {
    code: 'TVA_BASE_ERRONEE',
    intitule: 'la TVA est calculée sur le brut, remise non déduite',
    produire: () => {
      const avecRemise: Piece = {
        ...FACTURE,
        detail: {
          lignes: [{ designation: 'Pièces', quantite: 1, prixUnitaireHT: euros(1000), tauxTVA: 2000 }],
          reductionsCommerciales: euros(100),
        },
      }
      return controlerEcriture(
        {
          ...enTete,
          lignes: [
            ligne('607', 'Achat', 900, 0),
            ligne('44566', 'TVA', 200, 0),
            ligne('401', 'Roux', 0, 1100),
          ],
        },
        { ...CONTEXTE, piece: avecRemise },
      )
    },
  },
  {
    code: 'TVA_ARRONDI_NON_CONFORME',
    intitule: 'la TVA est arrondie ligne à ligne au lieu du total',
    produire: () => {
      const piece: Piece = {
        ...FACTURE,
        detail: { lignes: [{ designation: 'Livres', quantite: 1, prixUnitaireHT: euros(123.45), tauxTVA: 550 }] },
      }
      return controlerEcriture(
        {
          ...enTete,
          lignes: [
            ligne('607', 'Achat', 123.45, 0),
            ligne('44566', 'TVA', 6.78, 0),
            ligne('401', 'Roux', 0, 130.23),
          ],
        },
        { ...CONTEXTE, piece },
      )
    },
  },
  {
    code: 'TVA_OMISE',
    intitule: 'la TVA déductible est oubliée',
    produire: () =>
      controlerEcriture(
        { ...enTete, lignes: [ligne('607', 'Achat', 1000, 0), ligne('401', 'Roux', 0, 1000)] },
        { ...CONTEXTE, piece: FACTURE },
      ),
  },

  // ---- Montants --------------------------------------------------------------
  {
    code: 'MT_CONFUSION_HT_TTC',
    intitule: 'l’achat est enregistré pour son montant toutes taxes',
    produire: () =>
      diagnostiquer(
        [ligne('607', 'Achat', 1200, 0), ligne('44566', 'TVA', 200, 0), ligne('401', 'Roux', 0, 1400)],
        ATTENDUE,
      ),
  },
  {
    code: 'MT_ESCOMPTE',
    intitule: 'l’escompte obtenu n’est pas enregistré',
    produire: () =>
      diagnostiquer(
        [ligne('607', 'Achat', 1000, 0), ligne('401', 'Roux', 0, 1000)],
        [
          ligne('607', 'Achat', 1000, 0),
          ligne('765', 'Escompte obtenu', 0, 20),
          ligne('401', 'Roux', 0, 980),
        ],
      ),
  },
  {
    code: 'MT_REMISE',
    intitule: 'la remise de la facture est comptabilisée séparément',
    produire: () =>
      diagnostiquer(
        [
          ligne('607', 'Achat', 1000, 0),
          ligne('6097', 'Remise obtenue', 0, 100),
          ligne('401', 'Roux', 0, 900),
        ],
        [ligne('607', 'Achat', 900, 0), ligne('401', 'Roux', 0, 900)],
      ),
  },
  {
    code: 'MT_PORT',
    intitule: 'le port facturé est ajouté aux achats',
    produire: () =>
      diagnostiquer(
        [ligne('607', 'Achat', 1000, 0), ligne('607', 'Port', 50, 0), ligne('401', 'Roux', 0, 1050)],
        [ligne('607', 'Achat', 1000, 0), ligne('6241', 'Transports sur achats', 50, 0), ligne('401', 'Roux', 0, 1050)],
      ),
  },
  {
    code: 'MT_EMBALLAGES_CONSIGNES',
    intitule: 'la consigne d’emballages est traitée comme un achat',
    produire: () =>
      diagnostiquer(
        [ligne('607', 'Achat', 1000, 0), ligne('401', 'Roux', 0, 1000)],
        [
          ligne('607', 'Achat', 940, 0),
          ligne('4096', 'Emballages à rendre', 60, 0),
          ligne('401', 'Roux', 0, 1000),
        ],
      ),
  },
  {
    code: 'MT_ECART_ARRONDI',
    intitule: 'un centime manque sur la ligne d’achat',
    produire: () =>
      diagnostiquer(
        [ligne('607', 'Achat', 999.99, 0), ligne('44566', 'TVA', 200, 0), ligne('401', 'Roux', 0, 1199.99)],
        ATTENDUE,
      ),
  },
  {
    code: 'MT_MONTANT_ERRONE',
    intitule: 'le montant est franchement faux',
    produire: () =>
      diagnostiquer(
        [ligne('607', 'Achat', 100, 0), ligne('44566', 'TVA', 200, 0), ligne('401', 'Roux', 0, 300)],
        ATTENDUE,
      ),
  },

  // ---- Inventaire --------------------------------------------------------------
  {
    code: 'INV_BASE_AMORTISSABLE',
    intitule: 'la valeur résiduelle est ignorée',
    produire: () =>
      controlerDotation(
        {
          ...immobilisation,
          valeurOrigine: euros(10000),
          valeurResiduelle: euros(1000),
          dureeAnnees: 5,
          dateAcquisition: '2025-01-01',
          dateMiseEnService: '2025-01-01',
        },
        EXERCICE,
        euros(2000),
      ),
  },
  {
    code: 'INV_PRORATA_TEMPORIS',
    intitule: 'l’annuité pleine est portée sur un exercice incomplet',
    produire: () => controlerDotation(immobilisation, EXERCICE, euros(4800)),
  },
  {
    code: 'INV_DEPRECIATION_SUR_BRUT',
    intitule: 'la dépréciation est calculée sur la valeur brute',
    produire: () =>
      controlerDepreciation(
        { valeurBrute: euros(30000), cumulAmortissements: euros(12000), valeurActuelle: euros(15000) },
        euros(15000),
      ),
  },
  {
    code: 'INV_RATTACHEMENT_EXERCICE',
    intitule: 'la charge d’avance n’est pas régularisée',
    produire: () =>
      controlerRattachement(
        {
          montant: euros(1200),
          periode: { debut: '2025-09-01', fin: '2026-08-31' },
          exercice: EXERCICE,
        },
        0,
      ),
  },

  // ---- Cohérence globale --------------------------------------------------------
  {
    code: 'GLOB_COMPTE_ATTENTE_NON_SOLDE',
    intitule: 'un virement reste en compte d’attente à la clôture',
    produire: () =>
      controlerDossier([
        ...ECRITURES,
        ecriture('att', 'BQ', '2025-06-01', 'BQ-050', 'Virement inexpliqué', [
          ligne('512', 'Banque', 500, 0),
          ligne('471', 'Compte d’attente', 0, 500),
        ]),
      ]),
  },
  {
    code: 'GLOB_BALANCE_DESEQUILIBREE',
    intitule: 'une écriture déséquilibrée a été enregistrée',
    produire: () =>
      controlerDossier([
        ...ECRITURES,
        ecriture('desq', 'OD', '2025-06-01', 'OD-50', 'Écriture fausse', [
          ligne('607', 'Achat', 500, 0),
          ligne('401', 'Roux', 0, 400),
        ]),
      ]),
  },
  {
    code: 'GLOB_TIERS_SOLDE_NON_LETTRE',
    intitule: 'le compte client est soldé mais rien n’est lettré',
    produire: () =>
      controlerDossier(
        ECRITURES.map((e) => ({
          ...e,
          lignes: e.lignes.map(({ lettrage, dateLettrage, ...reste }) => {
            void lettrage
            void dateLettrage
            return reste as LigneEcriture
          }),
        })),
      ),
  },
  {
    code: 'GLOB_RESULTAT_DISCORDANT',
    intitule: 'le résultat du bilan ne rejoint pas celui du compte de résultat',
    produire: () =>
      controlerConcordanceResultat({ resultatParDifference: euros(400) }, { resultatNet: euros(350) }),
  },
]

describe('catalogue des contrôles', () => {
  for (const scenario of SCENARIOS) {
    it(`${scenario.code} — ${scenario.intitule}`, () => {
      const ecarts = scenario.produire()
      expect(codes(ecarts), JSON.stringify(codes(ecarts))).toContain(scenario.code)
    })
  }

  it('produit au moins une fois chacun des codes du catalogue', () => {
    const produits = new Set(SCENARIOS.flatMap((s) => codes(s.produire())))
    const jamaisProduits = CODES_ECART.filter((code) => !produits.has(code))
    expect(jamaisProduits).toEqual([])
  })

  it('nomme l’écart et dit quoi corriger, sans message générique', () => {
    for (const scenario of SCENARIOS) {
      for (const ecart of scenario.produire()) {
        expect(ecart.explication.length, ecart.code).toBeGreaterThan(40)
        expect(ecart.explication, ecart.code).not.toMatch(/erreur de saisie|réessayez|incorrect\.$/i)
        expect(ecart.explication, ecart.code).not.toContain('undefined')
        expect(ecart.explication, ecart.code).not.toContain('NaN')
        expect(ecart.famille).toBeTruthy()
        expect(ecart.gravite).toBe(graviteEcart(ecart.code))
      }
    }
  })

  it('range les écarts du plus grave au moins grave', () => {
    const ecarts = controlerEcriture(
      {
        ...enTete,
        numeroPiece: '',
        lignes: [ligne('607', 'Achat', 1000, 0), ligne('401', 'Roux', 0, 900)],
      },
      CONTEXTE,
    )
    expect(ecarts[0]?.gravite).toBe('bloquant')
    expect(codes(ecarts)).toContain('STRUCT_PIECE_MANQUANTE')
  })

  it('ne relève aucun écart sur une écriture juste', () => {
    expect(
      controlerEcriture({ ...enTete, lignes: [...ATTENDUE] }, { ...CONTEXTE, piece: FACTURE }),
    ).toEqual([])
    expect(diagnostiquer(ATTENDUE, ATTENDUE, { piece: FACTURE })).toEqual([])
  })

  it('ne relève aucun écart sur le dossier de référence', () => {
    expect(controlerDossier(ECRITURES)).toEqual([])
  })
})
