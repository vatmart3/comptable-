/**
 * Douze mois d'écritures crédibles pour l'Atelier Vaugirard, studio de design
 * parisien de trois personnes.
 *
 * Le générateur est PUR et DÉTERMINISTE : un générateur pseudo-aléatoire à
 * graine fixe produit toujours la même année. Une démo qui change à chaque
 * `db:seed` ne se teste pas, et un bug qui n'apparaît qu'une fois sur dix ne
 * se corrige pas.
 *
 * Les écritures produites ici passent ensuite par le service de validation
 * comme n'importe quelle saisie : équilibre, numérotation, chaînage. Aucune
 * n'est écrite directement en base.
 */

import { applyRate, baseFromInclusive, type Cents } from '../../lib/accounting/money'
import { TAUX } from '../../lib/accounting/vat'

export interface DemoLigne {
  readonly accountNumero: string
  readonly debit: Cents
  readonly credit: Cents
  readonly libelle: string
  readonly partnerCode?: string | null
}

export interface DemoEcriture {
  readonly journalCode: string
  readonly date: Date
  readonly libelle: string
  readonly pieceRef: string | null
  readonly lines: readonly DemoLigne[]
}

/** Générateur congruentiel linéaire : reproductible, sans dépendance. */
function generateur(graine: number): () => number {
  let etat = graine >>> 0
  return () => {
    etat = (etat * 1_664_525 + 1_013_904_223) >>> 0
    return etat / 4_294_967_296
  }
}

const jour = (annee: number, mois: number, jour: number): Date =>
  new Date(Date.UTC(annee, mois, jour))

/** Achat TTC réglé au comptant, ou porté au compte fournisseur. */
function achat(args: {
  date: Date
  libelle: string
  piece: string | null
  compte: string
  ttc: Cents
  taux: number
  contrepartie: string
  journal: string
  tiers?: string
}): DemoEcriture {
  const ht = baseFromInclusive(args.ttc, args.taux)
  const tva = args.ttc - ht
  const compteTva = args.compte.startsWith('2') ? '445620' : '445660'
  return {
    journalCode: args.journal,
    date: args.date,
    libelle: args.libelle,
    pieceRef: args.piece,
    lines: [
      { accountNumero: args.compte, debit: ht, credit: 0, libelle: args.libelle },
      ...(tva > 0 ? [{ accountNumero: compteTva, debit: tva, credit: 0, libelle: 'TVA déductible' }] : []),
      {
        accountNumero: args.contrepartie,
        debit: 0,
        credit: args.ttc,
        libelle: args.libelle,
        partnerCode: args.tiers ?? null,
      },
    ],
  }
}

/** Facture de vente : créance client au débit, produit et TVA au crédit. */
function vente(args: {
  date: Date
  libelle: string
  piece: string
  ht: Cents
  tiers: string
}): DemoEcriture {
  const tva = applyRate(args.ht, TAUX.NORMAL)
  return {
    journalCode: 'VE',
    date: args.date,
    libelle: args.libelle,
    pieceRef: args.piece,
    lines: [
      {
        accountNumero: '411000',
        debit: args.ht + tva,
        credit: 0,
        libelle: args.libelle,
        partnerCode: args.tiers,
      },
      { accountNumero: '706000', debit: 0, credit: args.ht, libelle: args.libelle },
      { accountNumero: '445711', debit: 0, credit: tva, libelle: 'TVA collectée 20 %' },
    ],
  }
}

/** Règlement reçu d'un client : la créance s'éteint. */
function encaissement(args: { date: Date; libelle: string; montant: Cents; tiers: string; piece: string }): DemoEcriture {
  return {
    journalCode: 'BQ',
    date: args.date,
    libelle: args.libelle,
    pieceRef: args.piece,
    lines: [
      { accountNumero: '512000', debit: args.montant, credit: 0, libelle: args.libelle },
      {
        accountNumero: '411000',
        debit: 0,
        credit: args.montant,
        libelle: args.libelle,
        partnerCode: args.tiers,
      },
    ],
  }
}

const CLIENTS = [
  { code: 'CLIMERIDIEN', nom: 'Méridien Studio' },
  { code: 'CLIBASTIDE', nom: 'Bastide & Fils' },
  { code: 'CLINOVEA', nom: 'Novéa Conseil' },
] as const

/**
 * Saisonnalité d'une activité de conseil : creux d'août, pointe de fin
 * d'année. Coefficient appliqué au chiffre d'affaires mensuel.
 */
const SAISONNALITE = [0.95, 1.0, 1.1, 1.05, 1.0, 1.05, 0.8, 0.45, 1.1, 1.15, 1.1, 1.25] as const

/**
 * @param annee   exercice à peupler
 * @param jusqua  dernière date à produire. Par défaut, l'année entière ; le
 *                seed passe la date du jour pour qu'une démo lancée en mars
 *                n'affiche pas des écritures de novembre — une compta qui
 *                anticipe le futur ne ressemble à rien.
 */
export function genererDemo(annee: number, jusqua?: Date): DemoEcriture[] {
  const alea = generateur(20_250_101)
  const ecritures: DemoEcriture[] = []

  // ── À-nouveaux : la situation au 1er janvier ──────────────────────────────
  ecritures.push({
    journalCode: 'AN',
    date: jour(annee, 0, 1),
    libelle: 'À-nouveaux',
    pieceRef: null,
    lines: [
      { accountNumero: '218300', debit: 480_000, credit: 0, libelle: 'Matériel informatique' },
      { accountNumero: '218400', debit: 260_000, credit: 0, libelle: 'Mobilier' },
      { accountNumero: '281830', debit: 0, credit: 192_000, libelle: 'Amortissements matériel' },
      { accountNumero: '281840', debit: 0, credit: 52_000, libelle: 'Amortissements mobilier' },
      { accountNumero: '512000', debit: 1_850_000, credit: 0, libelle: 'Banque' },
      { accountNumero: '530000', debit: 24_000, credit: 0, libelle: 'Caisse' },
      { accountNumero: '411000', debit: 936_000, credit: 0, libelle: 'Clients', partnerCode: 'CLIBASTIDE' },
      { accountNumero: '401000', debit: 0, credit: 318_000, libelle: 'Fournisseurs', partnerCode: 'FOUSCI' },
      { accountNumero: '101000', debit: 0, credit: 1_000_000, libelle: 'Capital' },
      { accountNumero: '106100', debit: 0, credit: 100_000, libelle: 'Réserve légale' },
      { accountNumero: '110000', debit: 0, credit: 1_888_000, libelle: 'Report à nouveau' },
    ],
  })

  for (let mois = 0; mois < 12; mois += 1) {
    const coefficient = SAISONNALITE[mois] ?? 1

    // ── Charges récurrentes ────────────────────────────────────────────────
    ecritures.push(
      achat({
        date: jour(annee, mois, 5),
        libelle: 'Loyer du bureau',
        piece: `SCI-${annee}-${String(mois + 1).padStart(2, '0')}`,
        compte: '613200',
        ttc: 168_000,
        taux: TAUX.NORMAL,
        contrepartie: '512000',
        journal: 'BQ',
        tiers: 'FOUSCI',
      }),
      achat({
        date: jour(annee, mois, 8),
        libelle: 'Abonnement fibre et mobiles',
        piece: `OR-${annee}${String(mois + 1).padStart(2, '0')}`,
        compte: '626000',
        ttc: 9_600,
        taux: TAUX.NORMAL,
        contrepartie: '401000',
        journal: 'AC',
        tiers: 'FOUORANGE',
      }),
      achat({
        date: jour(annee, mois, 12),
        libelle: 'Prime d’assurance multirisque',
        piece: `ASS-${annee}-${String(mois + 1).padStart(2, '0')}`,
        compte: '616000',
        ttc: 7_800,
        taux: TAUX.EXONERE,
        contrepartie: '512000',
        journal: 'BQ',
      }),
    )

    // Salaires et charges sociales : le poids d'un studio de trois personnes.
    const brut = 780_000
    const cotisations = 320_000
    ecritures.push({
      journalCode: 'OD',
      date: jour(annee, mois, 28),
      libelle: 'Paie du mois',
      pieceRef: `PAIE-${annee}-${String(mois + 1).padStart(2, '0')}`,
      lines: [
        { accountNumero: '641100', debit: brut, credit: 0, libelle: 'Salaires et appointements' },
        { accountNumero: '645100', debit: cotisations, credit: 0, libelle: 'Cotisations URSSAF' },
        { accountNumero: '421000', debit: 0, credit: 608_000, libelle: 'Rémunérations dues' },
        { accountNumero: '431000', debit: 0, credit: 492_000, libelle: 'Sécurité sociale' },
      ],
    })
    ecritures.push({
      journalCode: 'BQ',
      date: jour(annee, mois === 11 ? 11 : mois + 1, 2),
      libelle: 'Virement des salaires',
      pieceRef: null,
      lines: [
        { accountNumero: '421000', debit: 608_000, credit: 0, libelle: 'Rémunérations dues' },
        { accountNumero: '512000', debit: 0, credit: 608_000, libelle: 'Virement des salaires' },
      ],
    })

    // ── Achats variables ───────────────────────────────────────────────────
    const carburant = 6_000 + Math.round(alea() * 6_000)
    ecritures.push(
      achat({
        date: jour(annee, mois, 3 + Math.floor(alea() * 6)),
        libelle: 'Carburant',
        piece: null,
        compte: '606100',
        ttc: carburant,
        taux: TAUX.NORMAL,
        contrepartie: '512000',
        journal: 'BQ',
        tiers: 'FOUTOTAL',
      }),
      achat({
        date: jour(annee, mois, 14 + Math.floor(alea() * 8)),
        libelle: 'Fournitures de bureau',
        piece: `PAP-${annee}-${String(mois + 1).padStart(2, '0')}`,
        compte: '606400',
        ttc: 3_000 + Math.round(alea() * 5_000),
        taux: TAUX.NORMAL,
        contrepartie: '401000',
        journal: 'AC',
        tiers: 'FOUPAPETERIE',
      }),
      achat({
        date: jour(annee, mois, 9 + Math.floor(alea() * 12)),
        libelle: 'Déjeuner client',
        piece: null,
        compte: '625700',
        ttc: 4_200 + Math.round(alea() * 4_000),
        taux: TAUX.NORMAL,
        contrepartie: '512000',
        journal: 'BQ',
      }),
    )

    // Sous-traitance : plus fréquente quand l'activité est forte.
    if (coefficient > 1) {
      ecritures.push(
        achat({
          date: jour(annee, mois, 18),
          libelle: 'Sous-traitance — développement',
          piece: `ST-${annee}-${String(mois + 1).padStart(2, '0')}`,
          compte: '611000',
          ttc: 180_000 + Math.round(alea() * 240_000),
          taux: TAUX.NORMAL,
          contrepartie: '401000',
          journal: 'AC',
        }),
      )
    }

    // ── Ventes ─────────────────────────────────────────────────────────────
    const nombreFactures = coefficient < 0.6 ? 1 : coefficient > 1.1 ? 3 : 2
    for (let index = 0; index < nombreFactures; index += 1) {
      const client = CLIENTS[(mois + index) % CLIENTS.length]
      if (!client) continue
      // Une mission de studio se facture entre 5 600 et 11 200 € HT.
      const base = 560_000 + Math.round(alea() * 560_000)
      const ht = Math.round((base * coefficient) / 100) * 100
      const numero = `FA-${annee}-${String(ecritures.length).padStart(4, '0')}`
      ecritures.push(
        vente({
          date: jour(annee, mois, 20 + index * 3),
          libelle: `Mission ${client.nom}`,
          piece: numero,
          ht,
          tiers: client.code,
        }),
      )
      // Règlement à trente jours, en retard une fois sur quatre : c'est ce
      // décalage qui rend le lettrage et la prévision de trésorerie
      // intéressants à regarder. Les factures de décembre restent ouvertes au
      // 31/12 — comme dans la vraie vie, et comme il le faut pour que le
      // compte 411 ne soit pas vide à la clôture.
      const enRetard = alea() < 0.25
      const moisReglement = mois + 1
      if (moisReglement < 12) {
        ecritures.push(
          encaissement({
            date: jour(annee, moisReglement, enRetard ? 24 : 6),
            libelle: `Règlement ${client.nom}`,
            montant: ht + applyRate(ht, TAUX.NORMAL),
            tiers: client.code,
            piece: numero,
          }),
        )
      }
    }

    // ── Règlements fournisseurs ────────────────────────────────────────────
    if (mois > 0) {
      ecritures.push({
        journalCode: 'BQ',
        date: jour(annee, mois, 15),
        libelle: 'Règlements fournisseurs',
        pieceRef: null,
        lines: [
          {
            accountNumero: '401000',
            debit: 120_000,
            credit: 0,
            libelle: 'Règlements fournisseurs',
            partnerCode: 'FOUORANGE',
          },
          { accountNumero: '512000', debit: 0, credit: 120_000, libelle: 'Règlements fournisseurs' },
        ],
      })
    }
  }

  // ── Une immobilisation en cours d'année ───────────────────────────────────
  ecritures.push(
    achat({
      date: jour(annee, 1, 17),
      libelle: 'Poste de travail — station graphique',
      piece: `IMMO-${annee}-01`,
      compte: '218300',
      ttc: 384_000,
      taux: TAUX.NORMAL,
      contrepartie: '404000',
      journal: 'AC',
    }),
  )

  const limite = jusqua ? jusqua.getTime() : Number.POSITIVE_INFINITY
  return ecritures
    .filter((ecriture) => ecriture.date.getTime() <= limite)
    .sort((a, b) => a.date.getTime() - b.date.getTime())
}
