import { somme, type Centimes } from '../core/montant'
import type { Dossier } from '../types/dossier'
import type { Ecriture } from '../types/ecriture'
import { balance, type Balance } from './balance'
import type { OptionsRestitution } from './grand-livre'

export type Systeme = 'abrege' | 'developpe'

export interface Poste {
  code: string
  libelle: string
  /** Valeur brute, pour les postes d'actif. */
  brut: Centimes
  /** Amortissements et dépréciations, présentés en déduction. */
  deduction: Centimes
  /** Montant net, seul chiffre du passif et du compte de résultat. */
  net: Centimes
  comptes: string[]
}

export interface Rubrique {
  code: string
  libelle: string
  postes: Poste[]
  totalBrut: Centimes
  totalDeduction: Centimes
  totalNet: Centimes
}

export interface Bilan {
  systeme: Systeme
  actif: Rubrique[]
  passif: Rubrique[]
  totalActif: Centimes
  totalPassif: Centimes
  equilibre: boolean
  /** Résultat lu dans les comptes de gestion. */
  resultat: Centimes
  /**
   * Résultat obtenu par différence entre l'actif et le passif hors résultat.
   * Il doit être identique au précédent ; l'écart signale un compte mal classé.
   */
  resultatParDifference: Centimes
}

export interface CompteDeResultat {
  systeme: Systeme
  charges: Rubrique[]
  produits: Rubrique[]
  totalCharges: Centimes
  totalProduits: Centimes
  resultatExploitation: Centimes
  resultatFinancier: Centimes
  resultatCourant: Centimes
  resultatExceptionnel: Centimes
  impotSurLesBenefices: Centimes
  resultatNet: Centimes
}

interface DefinitionPoste {
  code: string
  libelle: string
  /** Poste du système abrégé qui absorbe celui-ci. */
  abrege: string
  libelleAbrege: string
  rubrique: string
}

interface Regle {
  /** Préfixes de comptes, testés dans l'ordre de la table. */
  prefixes: readonly string[]
  /** Poste d'actif recevant un solde débiteur. */
  actif?: string
  /** Poste de passif recevant un solde créditeur. */
  passif?: string
  /** Le compte vient en déduction du poste d'actif indiqué. */
  deductionDe?: string
}

// ---------------------------------------------------------------------------
// Bilan
// ---------------------------------------------------------------------------

const RUBRIQUES_ACTIF = [
  { code: 'AI', libelle: 'Actif immobilisé' },
  { code: 'AC', libelle: 'Actif circulant' },
] as const

const RUBRIQUES_PASSIF = [
  { code: 'CP', libelle: 'Capitaux propres' },
  { code: 'PR', libelle: 'Provisions' },
  { code: 'DT', libelle: 'Dettes' },
] as const

const POSTES_BILAN: readonly DefinitionPoste[] = [
  { code: 'AA', libelle: 'Frais d’établissement', abrege: 'AX', libelleAbrege: 'Immobilisations incorporelles', rubrique: 'AI' },
  { code: 'AB', libelle: 'Concessions, brevets, licences, logiciels', abrege: 'AX', libelleAbrege: 'Immobilisations incorporelles', rubrique: 'AI' },
  { code: 'AC', libelle: 'Fonds commercial', abrege: 'AX', libelleAbrege: 'Immobilisations incorporelles', rubrique: 'AI' },
  { code: 'AD', libelle: 'Terrains', abrege: 'AY', libelleAbrege: 'Immobilisations corporelles', rubrique: 'AI' },
  { code: 'AE', libelle: 'Constructions', abrege: 'AY', libelleAbrege: 'Immobilisations corporelles', rubrique: 'AI' },
  { code: 'AF', libelle: 'Installations techniques, matériel et outillage industriels', abrege: 'AY', libelleAbrege: 'Immobilisations corporelles', rubrique: 'AI' },
  { code: 'AG', libelle: 'Autres immobilisations corporelles', abrege: 'AY', libelleAbrege: 'Immobilisations corporelles', rubrique: 'AI' },
  { code: 'AH', libelle: 'Immobilisations en cours', abrege: 'AY', libelleAbrege: 'Immobilisations corporelles', rubrique: 'AI' },
  { code: 'AJ', libelle: 'Participations et créances rattachées', abrege: 'AZ', libelleAbrege: 'Immobilisations financières', rubrique: 'AI' },
  { code: 'AK', libelle: 'Autres immobilisations financières', abrege: 'AZ', libelleAbrege: 'Immobilisations financières', rubrique: 'AI' },
  { code: 'BA', libelle: 'Matières premières et autres approvisionnements', abrege: 'BX', libelleAbrege: 'Stocks', rubrique: 'AC' },
  { code: 'BB', libelle: 'En-cours de production', abrege: 'BX', libelleAbrege: 'Stocks', rubrique: 'AC' },
  { code: 'BC', libelle: 'Produits intermédiaires et finis', abrege: 'BX', libelleAbrege: 'Stocks', rubrique: 'AC' },
  { code: 'BD', libelle: 'Marchandises', abrege: 'BX', libelleAbrege: 'Stocks', rubrique: 'AC' },
  { code: 'BE', libelle: 'Avances et acomptes versés sur commandes', abrege: 'BY', libelleAbrege: 'Créances', rubrique: 'AC' },
  { code: 'BF', libelle: 'Clients et comptes rattachés', abrege: 'BY', libelleAbrege: 'Créances', rubrique: 'AC' },
  { code: 'BG', libelle: 'Autres créances', abrege: 'BY', libelleAbrege: 'Créances', rubrique: 'AC' },
  { code: 'BH', libelle: 'Valeurs mobilières de placement', abrege: 'BZ', libelleAbrege: 'Disponibilités', rubrique: 'AC' },
  { code: 'BJ', libelle: 'Disponibilités', abrege: 'BZ', libelleAbrege: 'Disponibilités', rubrique: 'AC' },
  { code: 'BK', libelle: 'Charges constatées d’avance', abrege: 'BK', libelleAbrege: 'Charges constatées d’avance', rubrique: 'AC' },

  { code: 'CA', libelle: 'Capital', abrege: 'CX', libelleAbrege: 'Capital et réserves', rubrique: 'CP' },
  { code: 'CB', libelle: 'Primes d’émission, de fusion, d’apport', abrege: 'CX', libelleAbrege: 'Capital et réserves', rubrique: 'CP' },
  { code: 'CC', libelle: 'Réserves', abrege: 'CX', libelleAbrege: 'Capital et réserves', rubrique: 'CP' },
  { code: 'CD', libelle: 'Report à nouveau', abrege: 'CX', libelleAbrege: 'Capital et réserves', rubrique: 'CP' },
  { code: 'CE', libelle: 'Résultat de l’exercice', abrege: 'CE', libelleAbrege: 'Résultat de l’exercice', rubrique: 'CP' },
  { code: 'CF', libelle: 'Subventions d’investissement', abrege: 'CX', libelleAbrege: 'Capital et réserves', rubrique: 'CP' },
  { code: 'CG', libelle: 'Provisions réglementées', abrege: 'CX', libelleAbrege: 'Capital et réserves', rubrique: 'CP' },
  { code: 'DA', libelle: 'Provisions pour risques et charges', abrege: 'DA', libelleAbrege: 'Provisions pour risques et charges', rubrique: 'PR' },
  { code: 'DB', libelle: 'Emprunts et dettes auprès des établissements de crédit', abrege: 'DX', libelleAbrege: 'Dettes financières', rubrique: 'DT' },
  { code: 'DC', libelle: 'Emprunts et dettes financières divers', abrege: 'DX', libelleAbrege: 'Dettes financières', rubrique: 'DT' },
  { code: 'DD', libelle: 'Avances et acomptes reçus sur commandes', abrege: 'DY', libelleAbrege: 'Dettes d’exploitation', rubrique: 'DT' },
  { code: 'DE', libelle: 'Dettes fournisseurs et comptes rattachés', abrege: 'DY', libelleAbrege: 'Dettes d’exploitation', rubrique: 'DT' },
  { code: 'DF', libelle: 'Dettes fiscales et sociales', abrege: 'DY', libelleAbrege: 'Dettes d’exploitation', rubrique: 'DT' },
  { code: 'DG', libelle: 'Dettes sur immobilisations et comptes rattachés', abrege: 'DZ', libelleAbrege: 'Autres dettes', rubrique: 'DT' },
  { code: 'DH', libelle: 'Autres dettes', abrege: 'DZ', libelleAbrege: 'Autres dettes', rubrique: 'DT' },
  { code: 'DI', libelle: 'Produits constatés d’avance', abrege: 'DI', libelleAbrege: 'Produits constatés d’avance', rubrique: 'DT' },
]

/**
 * Affectation des comptes aux postes du bilan.
 * La table est parcourue dans l'ordre : les amortissements et dépréciations
 * viennent en tête, sans quoi 2813 serait pris pour une immobilisation.
 */
const REGLES_BILAN: readonly Regle[] = [
  { prefixes: ['2801'], deductionDe: 'AA' },
  { prefixes: ['2805', '2806', '2808', '2905', '2908'], deductionDe: 'AB' },
  { prefixes: ['2807', '2907'], deductionDe: 'AC' },
  { prefixes: ['2811', '2911'], deductionDe: 'AD' },
  { prefixes: ['2813', '2814', '2913'], deductionDe: 'AE' },
  { prefixes: ['2815', '2915'], deductionDe: 'AF' },
  { prefixes: ['2818', '2918'], deductionDe: 'AG' },
  { prefixes: ['293'], deductionDe: 'AH' },
  { prefixes: ['296'], deductionDe: 'AJ' },
  { prefixes: ['297'], deductionDe: 'AK' },
  { prefixes: ['391', '392'], deductionDe: 'BA' },
  { prefixes: ['393', '394'], deductionDe: 'BB' },
  { prefixes: ['395'], deductionDe: 'BC' },
  { prefixes: ['397'], deductionDe: 'BD' },
  { prefixes: ['491'], deductionDe: 'BF' },
  { prefixes: ['495', '496'], deductionDe: 'BG' },
  { prefixes: ['590'], deductionDe: 'BH' },

  { prefixes: ['201'], actif: 'AA' },
  { prefixes: ['205', '206', '208'], actif: 'AB' },
  { prefixes: ['207'], actif: 'AC' },
  { prefixes: ['211', '212'], actif: 'AD' },
  { prefixes: ['213', '214'], actif: 'AE' },
  { prefixes: ['215'], actif: 'AF' },
  { prefixes: ['218'], actif: 'AG' },
  { prefixes: ['23'], actif: 'AH' },
  { prefixes: ['26'], actif: 'AJ' },
  { prefixes: ['27'], actif: 'AK' },
  { prefixes: ['31', '32'], actif: 'BA' },
  { prefixes: ['33', '34'], actif: 'BB' },
  { prefixes: ['35'], actif: 'BC' },
  { prefixes: ['37'], actif: 'BD' },

  { prefixes: ['101', '108', '109'], passif: 'CA' },
  { prefixes: ['104'], passif: 'CB' },
  { prefixes: ['106'], passif: 'CC' },
  { prefixes: ['11'], passif: 'CD' },
  { prefixes: ['12'], passif: 'CE' },
  { prefixes: ['13'], passif: 'CF' },
  { prefixes: ['14'], passif: 'CG' },
  { prefixes: ['15'], passif: 'DA' },
  { prefixes: ['16'], passif: 'DB' },
  { prefixes: ['17'], passif: 'DC' },
  { prefixes: ['45'], passif: 'DC', actif: 'BG' },

  { prefixes: ['4091'], actif: 'BE' },
  { prefixes: ['4191'], passif: 'DD' },
  { prefixes: ['411', '413', '416', '418'], actif: 'BF', passif: 'DH' },
  { prefixes: ['401', '403', '408'], passif: 'DE', actif: 'BG' },
  { prefixes: ['404', '405'], passif: 'DG', actif: 'BG' },
  { prefixes: ['409'], actif: 'BG' },
  { prefixes: ['419'], passif: 'DH' },
  { prefixes: ['42', '43', '44'], passif: 'DF', actif: 'BG' },
  { prefixes: ['46'], actif: 'BG', passif: 'DH' },
  { prefixes: ['47'], actif: 'BG', passif: 'DH' },
  { prefixes: ['486'], actif: 'BK' },
  { prefixes: ['487'], passif: 'DI' },
  { prefixes: ['48'], actif: 'BG', passif: 'DH' },
  { prefixes: ['50'], actif: 'BH' },
  { prefixes: ['51', '53', '54', '58'], actif: 'BJ', passif: 'DB' },
]

function trouverRegle(numero: string, regles: readonly Regle[]): Regle | undefined {
  let meilleure: Regle | undefined
  let longueur = -1
  for (const regle of regles) {
    for (const prefixe of regle.prefixes) {
      if (numero.startsWith(prefixe) && prefixe.length > longueur) {
        meilleure = regle
        longueur = prefixe.length
      }
    }
  }
  return meilleure
}

function creerPostes(definitions: readonly DefinitionPoste[], systeme: Systeme) {
  const postes = new Map<string, Poste>()
  const versPoste = new Map<string, string>()
  for (const definition of definitions) {
    const code = systeme === 'abrege' ? definition.abrege : definition.code
    const libelle = systeme === 'abrege' ? definition.libelleAbrege : definition.libelle
    versPoste.set(definition.code, code)
    if (!postes.has(code)) {
      postes.set(code, { code, libelle, brut: 0, deduction: 0, net: 0, comptes: [] })
    }
  }
  return { postes, versPoste }
}

function assembler(
  definitions: readonly DefinitionPoste[],
  postes: Map<string, Poste>,
  rubriques: readonly { code: string; libelle: string }[],
  systeme: Systeme,
): Rubrique[] {
  return rubriques.map((rubrique) => {
    const codes: string[] = []
    for (const definition of definitions) {
      if (definition.rubrique !== rubrique.code) continue
      const code = systeme === 'abrege' ? definition.abrege : definition.code
      if (!codes.includes(code)) codes.push(code)
    }
    const retenus = codes
      .map((code) => postes.get(code)!)
      .filter((poste) => poste.brut !== 0 || poste.deduction !== 0 || poste.net !== 0)
    return {
      code: rubrique.code,
      libelle: rubrique.libelle,
      postes: retenus,
      totalBrut: somme(retenus.map((p) => p.brut)),
      totalDeduction: somme(retenus.map((p) => p.deduction)),
      totalNet: somme(retenus.map((p) => p.net)),
    }
  })
}

export function bilan(
  ecritures: readonly Ecriture[],
  options: OptionsRestitution & { systeme?: Systeme } = {},
): Bilan {
  const systeme = options.systeme ?? 'developpe'
  const balanceCalculee = balance(ecritures, options)
  const { postes, versPoste } = creerPostes(POSTES_BILAN, systeme)

  const ajouter = (codeDefinition: string, champ: 'brut' | 'deduction', montant: Centimes, compte: string) => {
    const code = versPoste.get(codeDefinition)
    if (!code) return
    const poste = postes.get(code)!
    poste[champ] += montant
    if (!poste.comptes.includes(compte)) poste.comptes.push(compte)
  }

  for (const ligne of balanceCalculee.lignes) {
    const solde = ligne.soldeDebiteur - ligne.soldeCrediteur
    if (solde === 0) continue
    const classe = Number(ligne.numero[0])
    if (classe >= 6) continue

    const regle = trouverRegle(ligne.numero, REGLES_BILAN)
    if (!regle) continue

    if (regle.deductionDe) {
      ajouter(regle.deductionDe, 'deduction', -solde, ligne.numero)
      continue
    }
    // Un compte de passif au solde débiteur reste au passif, en négatif :
    // c'est la seule façon de conserver l'égalité de l'actif et du passif.
    if (solde > 0) {
      if (regle.actif) ajouter(regle.actif, 'brut', solde, ligne.numero)
      else if (regle.passif) ajouter(regle.passif, 'brut', -solde, ligne.numero)
    } else {
      if (regle.passif) ajouter(regle.passif, 'brut', -solde, ligne.numero)
      else if (regle.actif) ajouter(regle.actif, 'brut', solde, ligne.numero)
    }
  }

  const resultat = resultatDesComptesDeGestion(balanceCalculee)
  ajouter('CE', 'brut', resultat, 'Résultat')

  for (const poste of postes.values()) {
    poste.net = poste.brut - poste.deduction
    poste.comptes.sort()
  }

  const definitionsActif = POSTES_BILAN.filter((d) => d.rubrique === 'AI' || d.rubrique === 'AC')
  const definitionsPassif = POSTES_BILAN.filter((d) => !['AI', 'AC'].includes(d.rubrique))

  const actif = assembler(definitionsActif, postes, RUBRIQUES_ACTIF, systeme)
  const passif = assembler(definitionsPassif, postes, RUBRIQUES_PASSIF, systeme)
  const totalActif = somme(actif.map((r) => r.totalNet))
  const totalPassif = somme(passif.map((r) => r.totalNet))
  const resultatAuPassif = postes.get('CE')?.net ?? 0

  return {
    systeme,
    actif,
    passif,
    totalActif,
    totalPassif,
    equilibre: totalActif === totalPassif,
    resultat,
    resultatParDifference: totalActif - (totalPassif - resultatAuPassif),
  }
}

/** Résultat lu dans les comptes de gestion : produits moins charges. */
export function resultatDesComptesDeGestion(balanceCalculee: Balance): Centimes {
  let charges = 0
  let produits = 0
  for (const ligne of balanceCalculee.lignes) {
    const solde = ligne.soldeDebiteur - ligne.soldeCrediteur
    if (ligne.numero.startsWith('6')) charges += solde
    else if (ligne.numero.startsWith('7')) produits -= solde
  }
  return produits - charges
}

// ---------------------------------------------------------------------------
// Compte de résultat
// ---------------------------------------------------------------------------

const RUBRIQUES_CHARGES = [
  { code: 'CHE', libelle: 'Charges d’exploitation' },
  { code: 'CHF', libelle: 'Charges financières' },
  { code: 'CHX', libelle: 'Charges exceptionnelles' },
  { code: 'CHI', libelle: 'Impôts sur les bénéfices' },
] as const

const RUBRIQUES_PRODUITS = [
  { code: 'PRE', libelle: 'Produits d’exploitation' },
  { code: 'PRF', libelle: 'Produits financiers' },
  { code: 'PRX', libelle: 'Produits exceptionnels' },
] as const

const POSTES_CHARGES: readonly DefinitionPoste[] = [
  { code: 'FA', libelle: 'Achats de marchandises', abrege: 'FX', libelleAbrege: 'Achats et variations de stocks', rubrique: 'CHE' },
  { code: 'FB', libelle: 'Variation des stocks de marchandises', abrege: 'FX', libelleAbrege: 'Achats et variations de stocks', rubrique: 'CHE' },
  { code: 'FC', libelle: 'Achats de matières premières et autres approvisionnements', abrege: 'FX', libelleAbrege: 'Achats et variations de stocks', rubrique: 'CHE' },
  { code: 'FD', libelle: 'Variation des stocks d’approvisionnements', abrege: 'FX', libelleAbrege: 'Achats et variations de stocks', rubrique: 'CHE' },
  { code: 'FE', libelle: 'Autres achats et charges externes', abrege: 'FE', libelleAbrege: 'Autres achats et charges externes', rubrique: 'CHE' },
  { code: 'FF', libelle: 'Impôts, taxes et versements assimilés', abrege: 'FF', libelleAbrege: 'Impôts, taxes et versements assimilés', rubrique: 'CHE' },
  { code: 'FG', libelle: 'Salaires et traitements', abrege: 'FY', libelleAbrege: 'Charges de personnel', rubrique: 'CHE' },
  { code: 'FH', libelle: 'Charges sociales', abrege: 'FY', libelleAbrege: 'Charges de personnel', rubrique: 'CHE' },
  { code: 'FJ', libelle: 'Dotations aux amortissements', abrege: 'FZ', libelleAbrege: 'Dotations d’exploitation', rubrique: 'CHE' },
  { code: 'FK', libelle: 'Dotations aux dépréciations', abrege: 'FZ', libelleAbrege: 'Dotations d’exploitation', rubrique: 'CHE' },
  { code: 'FL', libelle: 'Dotations aux provisions', abrege: 'FZ', libelleAbrege: 'Dotations d’exploitation', rubrique: 'CHE' },
  { code: 'FM', libelle: 'Autres charges', abrege: 'FM', libelleAbrege: 'Autres charges', rubrique: 'CHE' },
  { code: 'GA', libelle: 'Dotations financières', abrege: 'GX', libelleAbrege: 'Charges financières', rubrique: 'CHF' },
  { code: 'GB', libelle: 'Intérêts et charges assimilées', abrege: 'GX', libelleAbrege: 'Charges financières', rubrique: 'CHF' },
  { code: 'HA', libelle: 'Charges exceptionnelles sur opérations de gestion', abrege: 'HX', libelleAbrege: 'Charges exceptionnelles', rubrique: 'CHX' },
  { code: 'HB', libelle: 'Valeurs comptables des éléments d’actif cédés', abrege: 'HX', libelleAbrege: 'Charges exceptionnelles', rubrique: 'CHX' },
  { code: 'HC', libelle: 'Dotations exceptionnelles', abrege: 'HX', libelleAbrege: 'Charges exceptionnelles', rubrique: 'CHX' },
  { code: 'HK', libelle: 'Impôts sur les bénéfices', abrege: 'HK', libelleAbrege: 'Impôts sur les bénéfices', rubrique: 'CHI' },
]

const POSTES_PRODUITS: readonly DefinitionPoste[] = [
  { code: 'PA', libelle: 'Ventes de marchandises', abrege: 'PX', libelleAbrege: 'Chiffre d’affaires net', rubrique: 'PRE' },
  { code: 'PB', libelle: 'Production vendue — biens', abrege: 'PX', libelleAbrege: 'Chiffre d’affaires net', rubrique: 'PRE' },
  { code: 'PC', libelle: 'Production vendue — services', abrege: 'PX', libelleAbrege: 'Chiffre d’affaires net', rubrique: 'PRE' },
  { code: 'PD', libelle: 'Production stockée', abrege: 'PY', libelleAbrege: 'Autres produits d’exploitation', rubrique: 'PRE' },
  { code: 'PE', libelle: 'Production immobilisée', abrege: 'PY', libelleAbrege: 'Autres produits d’exploitation', rubrique: 'PRE' },
  { code: 'PF', libelle: 'Subventions d’exploitation', abrege: 'PY', libelleAbrege: 'Autres produits d’exploitation', rubrique: 'PRE' },
  { code: 'PG', libelle: 'Reprises sur amortissements, dépréciations et provisions', abrege: 'PY', libelleAbrege: 'Autres produits d’exploitation', rubrique: 'PRE' },
  { code: 'PH', libelle: 'Autres produits', abrege: 'PY', libelleAbrege: 'Autres produits d’exploitation', rubrique: 'PRE' },
  { code: 'QA', libelle: 'Produits financiers', abrege: 'QA', libelleAbrege: 'Produits financiers', rubrique: 'PRF' },
  { code: 'RA', libelle: 'Produits exceptionnels sur opérations de gestion', abrege: 'RX', libelleAbrege: 'Produits exceptionnels', rubrique: 'PRX' },
  { code: 'RB', libelle: 'Produits des cessions d’éléments d’actif', abrege: 'RX', libelleAbrege: 'Produits exceptionnels', rubrique: 'PRX' },
  { code: 'RC', libelle: 'Reprises et quotes-parts exceptionnelles', abrege: 'RX', libelleAbrege: 'Produits exceptionnels', rubrique: 'PRX' },
]

const REGLES_CHARGES: readonly Regle[] = [
  { prefixes: ['607', '6087', '6097'], actif: 'FA' },
  { prefixes: ['6037'], actif: 'FB' },
  { prefixes: ['601', '602', '6081', '6082', '6091', '6092'], actif: 'FC' },
  { prefixes: ['6031', '6032'], actif: 'FD' },
  { prefixes: ['604', '605', '606', '608', '609', '61', '62'], actif: 'FE' },
  { prefixes: ['63'], actif: 'FF' },
  { prefixes: ['641', '642', '643', '644', '648'], actif: 'FG' },
  { prefixes: ['645', '646', '647'], actif: 'FH' },
  { prefixes: ['681', '6811', '6812'], actif: 'FJ' },
  { prefixes: ['6816', '6817'], actif: 'FK' },
  { prefixes: ['6815'], actif: 'FL' },
  { prefixes: ['65'], actif: 'FM' },
  { prefixes: ['686'], actif: 'GA' },
  { prefixes: ['66'], actif: 'GB' },
  { prefixes: ['671', '672', '678'], actif: 'HA' },
  { prefixes: ['675'], actif: 'HB' },
  { prefixes: ['687'], actif: 'HC' },
  { prefixes: ['69'], actif: 'HK' },
  { prefixes: ['6'], actif: 'FM' },
]

const REGLES_PRODUITS: readonly Regle[] = [
  { prefixes: ['707', '7087', '7097'], actif: 'PA' },
  { prefixes: ['701', '702', '703', '704', '705'], actif: 'PB' },
  { prefixes: ['706', '708', '709'], actif: 'PC' },
  { prefixes: ['713'], actif: 'PD' },
  { prefixes: ['72'], actif: 'PE' },
  { prefixes: ['74'], actif: 'PF' },
  { prefixes: ['781', '791'], actif: 'PG' },
  { prefixes: ['75'], actif: 'PH' },
  { prefixes: ['76', '786', '796'], actif: 'QA' },
  { prefixes: ['771', '778'], actif: 'RA' },
  { prefixes: ['775'], actif: 'RB' },
  { prefixes: ['777', '787', '797'], actif: 'RC' },
  { prefixes: ['7'], actif: 'PH' },
]

export function compteDeResultat(
  ecritures: readonly Ecriture[],
  options: OptionsRestitution & { systeme?: Systeme } = {},
): CompteDeResultat {
  const systeme = options.systeme ?? 'developpe'
  const balanceCalculee = balance(ecritures, options)

  const cotes = [
    { definitions: POSTES_CHARGES, regles: REGLES_CHARGES, classe: '6', signe: 1 },
    { definitions: POSTES_PRODUITS, regles: REGLES_PRODUITS, classe: '7', signe: -1 },
  ] as const

  const resultats = cotes.map(({ definitions, regles, classe, signe }) => {
    const { postes, versPoste } = creerPostes(definitions, systeme)
    for (const ligne of balanceCalculee.lignes) {
      if (!ligne.numero.startsWith(classe)) continue
      const montant = (ligne.soldeDebiteur - ligne.soldeCrediteur) * signe
      if (montant === 0) continue
      const regle = trouverRegle(ligne.numero, regles)
      const code = regle?.actif ? versPoste.get(regle.actif) : undefined
      if (!code) continue
      const poste = postes.get(code)!
      poste.brut += montant
      poste.net += montant
      if (!poste.comptes.includes(ligne.numero)) poste.comptes.push(ligne.numero)
    }
    return { definitions, postes }
  })

  const charges = assembler(resultats[0]!.definitions, resultats[0]!.postes, RUBRIQUES_CHARGES, systeme)
  const produits = assembler(resultats[1]!.definitions, resultats[1]!.postes, RUBRIQUES_PRODUITS, systeme)

  const total = (rubriques: Rubrique[], code: string): Centimes =>
    rubriques.find((r) => r.code === code)?.totalNet ?? 0

  const chargesExploitation = total(charges, 'CHE')
  const produitsExploitation = total(produits, 'PRE')
  const chargesFinancieres = total(charges, 'CHF')
  const produitsFinanciers = total(produits, 'PRF')
  const chargesExceptionnelles = total(charges, 'CHX')
  const produitsExceptionnels = total(produits, 'PRX')
  const impot = total(charges, 'CHI')

  const resultatExploitation = produitsExploitation - chargesExploitation
  const resultatFinancier = produitsFinanciers - chargesFinancieres
  const resultatExceptionnel = produitsExceptionnels - chargesExceptionnelles
  const totalCharges = somme(charges.map((r) => r.totalNet))
  const totalProduits = somme(produits.map((r) => r.totalNet))

  return {
    systeme,
    charges,
    produits,
    totalCharges,
    totalProduits,
    resultatExploitation,
    resultatFinancier,
    resultatCourant: resultatExploitation + resultatFinancier,
    resultatExceptionnel,
    impotSurLesBenefices: impot,
    resultatNet: totalProduits - totalCharges,
  }
}

/** En-tête des états : raison sociale et exercice du dossier. */
export function enTeteEtat(dossier: Dossier): string {
  return `${dossier.raisonSociale} — exercice du ${dossier.exerciceDebut} au ${dossier.exerciceFin}`
}
