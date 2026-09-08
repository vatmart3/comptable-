/**
 * Bilan et compte de résultat en présentation française (système de base).
 *
 * Le moteur sait déjà calculer un résultat (`statements.ts`). Ce module fait
 * autre chose : il RANGE les comptes dans les rubriques du modèle officiel,
 * celles que l'étudiant doit savoir restituer en épreuve — actif immobilisé,
 * actif circulant, capitaux propres, dettes ; charges et produits par nature.
 *
 * Deux règles de présentation à ne pas perdre de vue :
 *   - au bilan, l'actif se présente en trois colonnes : brut, amortissements
 *     et dépréciations, net. Les comptes 28, 29, 39 et 49 ne sont jamais au
 *     passif : ils viennent EN DÉDUCTION de l'actif ;
 *   - le résultat figure au passif, dans les capitaux propres. C'est lui qui
 *     ferme l'égalité actif = passif.
 */

import type { Cents } from './money'
import type { AccountBalance } from './statements'

export interface Rubrique {
  readonly code: string
  readonly libelle: string
  /** Préfixes de comptes qui alimentent la rubrique. */
  readonly prefixes: readonly string[]
  /** Préfixes à exclure (un préfixe plus long qui appartient à une autre rubrique). */
  readonly sauf?: readonly string[]
  /** Amortissements et dépréciations à déduire, pour l'actif. */
  readonly contre?: readonly string[]
}

export interface LigneEtat {
  readonly code: string
  readonly libelle: string
  readonly brut: Cents
  readonly amortissements: Cents
  readonly net: Cents
  /** Comptes qui ont alimenté la ligne — pour montrer d'où vient le chiffre. */
  readonly comptes: readonly { readonly numero: string; readonly libelle: string; readonly montant: Cents }[]
}

export interface BlocEtat {
  readonly titre: string
  readonly lignes: readonly LigneEtat[]
  readonly total: Cents
}

function correspond(numero: string, rubrique: Rubrique): boolean {
  if (rubrique.sauf?.some((prefixe) => numero.startsWith(prefixe))) return false
  return rubrique.prefixes.some((prefixe) => numero.startsWith(prefixe))
}

/** Somme signée des soldes des comptes d'une rubrique (débit − crédit). */
function sommer(
  balance: readonly AccountBalance[],
  prefixes: readonly string[],
  sauf: readonly string[] = [],
): { total: Cents; comptes: LigneEtat['comptes'] } {
  let total = 0
  const comptes: { numero: string; libelle: string; montant: Cents }[] = []
  for (const compte of balance) {
    if (sauf.some((prefixe) => compte.numero.startsWith(prefixe))) continue
    if (!prefixes.some((prefixe) => compte.numero.startsWith(prefixe))) continue
    if (compte.solde === 0) continue
    total += compte.solde
    comptes.push({ numero: compte.numero, libelle: compte.libelle, montant: compte.solde })
  }
  return { total, comptes }
}

// ── BILAN ───────────────────────────────────────────────────────────────────

const ACTIF_IMMOBILISE: readonly Rubrique[] = [
  {
    code: 'AI1',
    libelle: 'Immobilisations incorporelles',
    prefixes: ['20'],
    contre: ['280', '290'],
  },
  {
    code: 'AI2',
    libelle: 'Immobilisations corporelles',
    prefixes: ['21', '22', '23'],
    contre: ['281', '282', '291', '293'],
  },
  {
    code: 'AI3',
    libelle: 'Immobilisations financières',
    prefixes: ['26', '27'],
    contre: ['296', '297'],
  },
]

const ACTIF_CIRCULANT: readonly Rubrique[] = [
  {
    code: 'AC1',
    libelle: 'Stocks',
    prefixes: ['31', '32', '33', '34', '35', '37'],
    contre: ['39'],
  },
  {
    code: 'AC2',
    libelle: 'Créances clients et comptes rattachés',
    prefixes: ['41'],
    sauf: ['419'],
    contre: ['491'],
  },
  {
    code: 'AC3',
    libelle: 'Autres créances',
    prefixes: ['409', '425', '4456', '4458', '441', '444', '46', '47'],
    sauf: ['4457', '4455'],
  },
  {
    code: 'AC4',
    libelle: 'Disponibilités',
    prefixes: ['50', '51', '53', '58'],
    sauf: ['519'],
  },
  { code: 'AC5', libelle: 'Charges constatées d’avance', prefixes: ['486'] },
]

const CAPITAUX_PROPRES: readonly Rubrique[] = [
  { code: 'CP1', libelle: 'Capital', prefixes: ['101', '108'] },
  { code: 'CP2', libelle: 'Réserves', prefixes: ['104', '105', '106'] },
  { code: 'CP3', libelle: 'Report à nouveau', prefixes: ['110', '119'] },
  { code: 'CP4', libelle: 'Subventions d’investissement', prefixes: ['13'] },
]

const DETTES: readonly Rubrique[] = [
  { code: 'DE0', libelle: 'Provisions pour risques et charges', prefixes: ['15'] },
  { code: 'DE1', libelle: 'Emprunts et dettes financières', prefixes: ['16', '17', '519'] },
  { code: 'DE2', libelle: 'Dettes fournisseurs et comptes rattachés', prefixes: ['40'], sauf: ['409'] },
  {
    code: 'DE3',
    libelle: 'Dettes fiscales et sociales',
    prefixes: ['42', '43', '44'],
    sauf: ['425', '4456', '4458', '441', '444'],
  },
  { code: 'DE4', libelle: 'Autres dettes', prefixes: ['419', '46', '47'] },
  { code: 'DE5', libelle: 'Produits constatés d’avance', prefixes: ['487'] },
]

export interface Bilan {
  readonly actif: readonly BlocEtat[]
  readonly passif: readonly BlocEtat[]
  readonly totalActif: Cents
  readonly totalPassif: Cents
  readonly resultat: Cents
  /** Actif − passif. Doit valoir zéro. */
  readonly ecart: Cents
}

function ligneActif(balance: readonly AccountBalance[], rubrique: Rubrique): LigneEtat {
  const brut = sommer(balance, rubrique.prefixes, rubrique.sauf ?? [])
  const contre = rubrique.contre ? sommer(balance, rubrique.contre) : { total: 0, comptes: [] }
  // Les comptes 28/29/39/49 sont créditeurs : leur solde est négatif, on le
  // présente en positif dans la colonne « amortissements ».
  const amortissements = -contre.total
  return {
    code: rubrique.code,
    libelle: rubrique.libelle,
    brut: brut.total,
    amortissements,
    net: brut.total - amortissements,
    comptes: [...brut.comptes, ...contre.comptes],
  }
}

function ligneP2000(balance: readonly AccountBalance[], rubrique: Rubrique): LigneEtat {
  const bloc = sommer(balance, rubrique.prefixes, rubrique.sauf ?? [])
  // Les comptes de passif sont créditeurs : on les présente en positif.
  const montant = -bloc.total
  return {
    code: rubrique.code,
    libelle: rubrique.libelle,
    brut: montant,
    amortissements: 0,
    net: montant,
    comptes: bloc.comptes,
  }
}

function bloc(titre: string, lignes: readonly LigneEtat[]): BlocEtat {
  return { titre, lignes, total: lignes.reduce((somme, ligne) => somme + ligne.net, 0) }
}

/**
 * Dresse le bilan. Le résultat de l'exercice est calculé depuis les classes 6
 * et 7 et porté dans les capitaux propres : c'est ce qui referme l'égalité
 * sans avoir à passer les écritures de clôture.
 */
export function bilan(balance: readonly AccountBalance[]): Bilan {
  const resultat = -sommer(balance, ['6', '7']).total

  const immobilise = bloc('Actif immobilisé', ACTIF_IMMOBILISE.map((r) => ligneActif(balance, r)))
  const circulant = bloc('Actif circulant', ACTIF_CIRCULANT.map((r) => ligneActif(balance, r)))

  const propres = CAPITAUX_PROPRES.map((r) => ligneP2000(balance, r))
  const avecResultat: LigneEtat[] = [
    ...propres,
    {
      code: 'CP5',
      libelle: resultat >= 0 ? 'Résultat de l’exercice (bénéfice)' : 'Résultat de l’exercice (perte)',
      brut: resultat,
      amortissements: 0,
      net: resultat,
      comptes: [],
    },
  ]
  const capitaux = bloc('Capitaux propres', avecResultat)
  const dettes = bloc('Dettes', DETTES.map((r) => ligneP2000(balance, r)))

  const totalActif = immobilise.total + circulant.total
  const totalPassif = capitaux.total + dettes.total

  return {
    actif: [immobilise, circulant],
    passif: [capitaux, dettes],
    totalActif,
    totalPassif,
    resultat,
    ecart: totalActif - totalPassif,
  }
}

// ── COMPTE DE RÉSULTAT ──────────────────────────────────────────────────────

const CHARGES: readonly Rubrique[] = [
  { code: 'CH1', libelle: 'Achats de marchandises', prefixes: ['607', '6037', '6097'] },
  { code: 'CH2', libelle: 'Achats de matières premières et approvisionnements', prefixes: ['601', '602', '6031', '6032'] },
  {
    code: 'CH3',
    libelle: 'Autres achats et charges externes',
    prefixes: ['604', '605', '606', '608', '609', '61', '62'],
    sauf: ['6097'],
  },
  { code: 'CH4', libelle: 'Impôts, taxes et versements assimilés', prefixes: ['63'] },
  { code: 'CH5', libelle: 'Charges de personnel', prefixes: ['64'] },
  { code: 'CH6', libelle: 'Dotations aux amortissements et dépréciations', prefixes: ['681'] },
  { code: 'CH7', libelle: 'Autres charges de gestion courante', prefixes: ['65'] },
  { code: 'CH8', libelle: 'Charges financières', prefixes: ['66', '686'] },
  { code: 'CH9', libelle: 'Charges exceptionnelles', prefixes: ['67', '687'] },
  { code: 'CH10', libelle: 'Impôt sur les bénéfices', prefixes: ['69'] },
]

const PRODUITS: readonly Rubrique[] = [
  { code: 'PR1', libelle: 'Ventes de marchandises', prefixes: ['707', '7097'] },
  {
    code: 'PR2',
    libelle: 'Production vendue (biens et services)',
    prefixes: ['701', '702', '703', '704', '705', '706', '708', '709'],
    sauf: ['7097'],
  },
  { code: 'PR3', libelle: 'Production stockée et immobilisée', prefixes: ['71', '72'] },
  { code: 'PR4', libelle: 'Subventions d’exploitation', prefixes: ['74'] },
  { code: 'PR5', libelle: 'Autres produits de gestion courante', prefixes: ['75'] },
  { code: 'PR6', libelle: 'Reprises et transferts de charges', prefixes: ['781', '791'] },
  { code: 'PR7', libelle: 'Produits financiers', prefixes: ['76', '786', '796'] },
  { code: 'PR8', libelle: 'Produits exceptionnels', prefixes: ['77', '787', '797'] },
]

export interface CompteDeResultat {
  readonly charges: readonly LigneEtat[]
  readonly produits: readonly LigneEtat[]
  readonly totalCharges: Cents
  readonly totalProduits: Cents
  readonly resultat: Cents
  readonly beneficiaire: boolean
}

/**
 * Dresse le compte de résultat par nature.
 *
 * Les charges sont débitrices, les produits créditeurs : on les présente tous
 * deux en positif. Les 609 (rabais obtenus) et 709 (rabais accordés) viennent
 * naturellement en déduction de leur rubrique, puisque leur solde est de sens
 * inverse — c'est pour cela qu'ils y sont rangés plutôt qu'isolés.
 */
export function compteDeResultat(balance: readonly AccountBalance[]): CompteDeResultat {
  const charges = CHARGES.map((rubrique) => {
    const bloc = sommer(balance, rubrique.prefixes, rubrique.sauf ?? [])
    return {
      code: rubrique.code,
      libelle: rubrique.libelle,
      brut: bloc.total,
      amortissements: 0,
      net: bloc.total,
      comptes: bloc.comptes,
    }
  })

  const produits = PRODUITS.map((rubrique) => {
    const bloc = sommer(balance, rubrique.prefixes, rubrique.sauf ?? [])
    return {
      code: rubrique.code,
      libelle: rubrique.libelle,
      brut: -bloc.total,
      amortissements: 0,
      net: -bloc.total,
      comptes: bloc.comptes,
    }
  })

  const totalCharges = charges.reduce((somme, ligne) => somme + ligne.net, 0)
  const totalProduits = produits.reduce((somme, ligne) => somme + ligne.net, 0)
  const resultat = totalProduits - totalCharges

  return { charges, produits, totalCharges, totalProduits, resultat, beneficiaire: resultat >= 0 }
}

// ── BALANCE À QUATRE COLONNES ───────────────────────────────────────────────

export interface LigneBalance {
  readonly numero: string
  readonly libelle: string
  readonly mouvementDebit: Cents
  readonly mouvementCredit: Cents
  readonly soldeDebiteur: Cents
  readonly soldeCrediteur: Cents
}

export interface BalanceQuatreColonnes {
  readonly lignes: readonly LigneBalance[]
  readonly totalMouvementDebit: Cents
  readonly totalMouvementCredit: Cents
  readonly totalSoldeDebiteur: Cents
  readonly totalSoldeCrediteur: Cents
  /** Les quatre totaux doivent s'égaler deux à deux. */
  readonly equilibree: boolean
}

/**
 * La balance telle qu'on la dresse en épreuve : mouvements puis soldes.
 * Un compte n'a jamais un solde des deux côtés — c'est l'un ou l'autre.
 */
export function balanceQuatreColonnes(balance: readonly AccountBalance[]): BalanceQuatreColonnes {
  const lignes: LigneBalance[] = balance
    .filter((compte) => compte.debit !== 0 || compte.credit !== 0)
    .map((compte) => ({
      numero: compte.numero,
      libelle: compte.libelle,
      mouvementDebit: compte.debit,
      mouvementCredit: compte.credit,
      soldeDebiteur: compte.solde > 0 ? compte.solde : 0,
      soldeCrediteur: compte.solde < 0 ? -compte.solde : 0,
    }))

  const somme = (choix: (ligne: LigneBalance) => Cents): Cents =>
    lignes.reduce((total, ligne) => total + choix(ligne), 0)

  const totalMouvementDebit = somme((l) => l.mouvementDebit)
  const totalMouvementCredit = somme((l) => l.mouvementCredit)
  const totalSoldeDebiteur = somme((l) => l.soldeDebiteur)
  const totalSoldeCrediteur = somme((l) => l.soldeCrediteur)

  return {
    lignes,
    totalMouvementDebit,
    totalMouvementCredit,
    totalSoldeDebiteur,
    totalSoldeCrediteur,
    equilibree:
      totalMouvementDebit === totalMouvementCredit && totalSoldeDebiteur === totalSoldeCrediteur,
  }
}
