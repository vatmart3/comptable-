import type { ClasseCompte, Compte, SensNormal, TypeCompte } from '../types/compte'

/**
 * Plan comptable général, subdivisions courantes du BTS CG.
 *
 * Chaque entrée est [numéro, libellé, drapeaux]. Les drapeaux :
 *   L lettrable   R rapprochable   X tient une comptabilité auxiliaire
 *   D sens débiteur   C sens créditeur   M sens mixte
 * Sans drapeau de sens, le sens normal est déduit de la classe.
 */
type Entree = readonly [numero: string, libelle: string, drapeaux?: string]

const TABLE: readonly Entree[] = [
  // ---- Classe 1 — Comptes de capitaux -------------------------------------
  ['101', 'Capital'],
  ['1013', 'Capital souscrit, appelé, versé'],
  ['104', 'Primes liées au capital social'],
  ['106', 'Réserves'],
  ['1061', 'Réserve légale'],
  ['1063', 'Réserves statutaires ou contractuelles'],
  ['1068', 'Autres réserves'],
  ['108', 'Compte de l’exploitant', 'M'],
  ['110', 'Report à nouveau (solde créditeur)'],
  ['119', 'Report à nouveau (solde débiteur)', 'D'],
  ['120', 'Résultat de l’exercice (bénéfice)'],
  ['129', 'Résultat de l’exercice (perte)', 'D'],
  ['131', 'Subventions d’équipement'],
  ['139', 'Subventions d’investissement inscrites au compte de résultat', 'D'],
  ['145', 'Amortissements dérogatoires'],
  ['1511', 'Provisions pour litiges'],
  ['1572', 'Provisions pour gros entretien ou grandes révisions'],
  ['164', 'Emprunts auprès des établissements de crédit'],
  ['1688', 'Intérêts courus sur emprunts'],

  // ---- Classe 2 — Immobilisations -----------------------------------------
  ['201', 'Frais d’établissement', 'D'],
  ['205', 'Concessions, brevets, licences, logiciels', 'D'],
  ['206', 'Droit au bail', 'D'],
  ['207', 'Fonds commercial', 'D'],
  ['211', 'Terrains', 'D'],
  ['213', 'Constructions', 'D'],
  ['2135', 'Installations générales, agencements des constructions', 'D'],
  ['215', 'Installations techniques, matériel et outillage industriels', 'D'],
  ['2154', 'Matériel industriel', 'D'],
  ['2155', 'Outillage industriel', 'D'],
  ['2181', 'Installations générales, agencements, aménagements divers', 'D'],
  ['2182', 'Matériel de transport', 'D'],
  ['2183', 'Matériel de bureau et matériel informatique', 'D'],
  ['2184', 'Mobilier', 'D'],
  ['231', 'Immobilisations corporelles en cours', 'D'],
  ['261', 'Titres de participation', 'D'],
  ['275', 'Dépôts et cautionnements versés', 'D'],
  ['2805', 'Amortissements des concessions, brevets, licences, logiciels', 'C'],
  ['2813', 'Amortissements des constructions', 'C'],
  ['28135', 'Amortissements des installations générales (constructions)', 'C'],
  ['2815', 'Amortissements des installations techniques, matériel et outillage', 'C'],
  ['28154', 'Amortissements du matériel industriel', 'C'],
  ['2818', 'Amortissements des autres immobilisations corporelles', 'C'],
  ['28181', 'Amortissements des installations générales, agencements divers', 'C'],
  ['28182', 'Amortissements du matériel de transport', 'C'],
  ['28183', 'Amortissements du matériel de bureau et informatique', 'C'],
  ['28184', 'Amortissements du mobilier', 'C'],
  ['2906', 'Dépréciations du droit au bail', 'C'],
  ['2911', 'Dépréciations des terrains', 'C'],
  ['2961', 'Dépréciations des titres de participation', 'C'],

  // ---- Classe 3 — Stocks ---------------------------------------------------
  ['31', 'Matières premières', 'D'],
  ['32', 'Autres approvisionnements', 'D'],
  ['33', 'En-cours de production de biens', 'D'],
  ['355', 'Produits finis', 'D'],
  ['37', 'Stocks de marchandises', 'D'],
  ['391', 'Dépréciations des matières premières', 'C'],
  ['397', 'Dépréciations des stocks de marchandises', 'C'],

  // ---- Classe 4 — Comptes de tiers ----------------------------------------
  ['401', 'Fournisseurs', 'LCX'],
  ['403', 'Fournisseurs — Effets à payer', 'LC'],
  ['404', 'Fournisseurs d’immobilisations', 'LCX'],
  ['405', 'Fournisseurs d’immobilisations — Effets à payer', 'LC'],
  ['408', 'Fournisseurs — Factures non parvenues', 'C'],
  ['4091', 'Fournisseurs — Avances et acomptes versés sur commandes', 'LD'],
  ['4096', 'Fournisseurs — Créances pour emballages et matériels à rendre', 'LD'],
  ['4097', 'Fournisseurs — Autres avoirs', 'LD'],
  ['4098', 'Rabais, remises, ristournes à obtenir et autres avoirs non reçus', 'D'],
  ['411', 'Clients', 'LDX'],
  ['413', 'Clients — Effets à recevoir', 'LD'],
  ['416', 'Clients douteux ou litigieux', 'LD'],
  ['418', 'Clients — Produits non encore facturés', 'D'],
  ['4191', 'Clients — Avances et acomptes reçus sur commandes', 'LC'],
  ['4196', 'Clients — Dettes sur emballages et matériels consignés', 'LC'],
  ['4198', 'Rabais, remises, ristournes à accorder et autres avoirs à établir', 'C'],
  ['421', 'Personnel — Rémunérations dues', 'C'],
  ['425', 'Personnel — Avances et acomptes', 'D'],
  ['427', 'Personnel — Oppositions', 'C'],
  ['4282', 'Dettes provisionnées pour congés à payer', 'C'],
  ['4286', 'Personnel — Autres charges à payer', 'C'],
  ['431', 'Sécurité sociale', 'C'],
  ['437', 'Autres organismes sociaux', 'C'],
  ['4386', 'Organismes sociaux — Autres charges à payer', 'C'],
  ['441', 'État — Subventions à recevoir', 'D'],
  ['4441', 'État — Impôt sur les bénéfices', 'C'],
  ['44551', 'TVA à décaisser', 'C'],
  ['44562', 'TVA déductible sur immobilisations', 'D'],
  ['44566', 'TVA déductible sur autres biens et services', 'D'],
  ['44567', 'Crédit de TVA à reporter', 'D'],
  ['44571', 'TVA collectée', 'C'],
  ['44583', 'Remboursement de TVA demandé', 'D'],
  ['44586', 'TVA sur factures non parvenues', 'D'],
  ['44587', 'TVA sur factures à établir', 'C'],
  ['447', 'Autres impôts, taxes et versements assimilés', 'C'],
  ['4486', 'État — Charges à payer', 'C'],
  ['455', 'Associés — Comptes courants', 'C'],
  ['457', 'Associés — Dividendes à payer', 'C'],
  ['462', 'Créances sur cessions d’immobilisations', 'LD'],
  ['464', 'Dettes sur acquisitions de valeurs mobilières de placement', 'C'],
  ['467', 'Autres comptes débiteurs ou créditeurs', 'LM'],
  ['471', 'Compte d’attente', 'M'],
  ['486', 'Charges constatées d’avance', 'D'],
  ['487', 'Produits constatés d’avance', 'C'],
  ['491', 'Dépréciations des comptes de clients', 'C'],

  // ---- Classe 5 — Comptes financiers --------------------------------------
  ['5113', 'Chèques à encaisser', 'D'],
  ['5114', 'Effets à l’encaissement', 'D'],
  ['512', 'Banques', 'RM'],
  ['514', 'Chèques postaux', 'RM'],
  ['5161', 'Effets escomptés non échus', 'C'],
  ['530', 'Caisse', 'D'],
  ['580', 'Virements internes', 'M'],

  // ---- Classe 6 — Charges ---------------------------------------------------
  ['601', 'Achats stockés — Matières premières', 'D'],
  ['602', 'Achats stockés — Autres approvisionnements', 'D'],
  ['6031', 'Variation des stocks de matières premières', 'M'],
  ['6037', 'Variation des stocks de marchandises', 'M'],
  ['606', 'Achats non stockés de matières et fournitures', 'D'],
  ['6061', 'Fournitures non stockables (eau, énergie)', 'D'],
  ['6063', 'Fournitures d’entretien et de petit équipement', 'D'],
  ['6064', 'Fournitures administratives', 'D'],
  ['607', 'Achats de marchandises', 'D'],
  ['608', 'Frais accessoires d’achat', 'D'],
  ['6097', 'Rabais, remises et ristournes obtenus sur achats de marchandises', 'C'],
  ['611', 'Sous-traitance générale', 'D'],
  ['613', 'Locations', 'D'],
  ['6132', 'Locations immobilières', 'D'],
  ['6135', 'Locations mobilières', 'D'],
  ['615', 'Entretien et réparations', 'D'],
  ['6152', 'Entretien et réparations sur biens immobiliers', 'D'],
  ['6155', 'Entretien et réparations sur biens mobiliers', 'D'],
  ['616', 'Primes d’assurances', 'D'],
  ['618', 'Divers services extérieurs', 'D'],
  ['6181', 'Documentation générale', 'D'],
  ['622', 'Rémunérations d’intermédiaires et honoraires', 'D'],
  ['6226', 'Honoraires', 'D'],
  ['623', 'Publicité, publications, relations publiques', 'D'],
  ['6231', 'Annonces et insertions', 'D'],
  ['624', 'Transports de biens et transports collectifs du personnel', 'D'],
  ['6241', 'Transports sur achats', 'D'],
  ['6242', 'Transports sur ventes', 'D'],
  ['625', 'Déplacements, missions et réceptions', 'D'],
  ['6251', 'Voyages et déplacements', 'D'],
  ['626', 'Frais postaux et de télécommunications', 'D'],
  ['627', 'Services bancaires et assimilés', 'D'],
  ['631', 'Impôts, taxes et versements assimilés sur rémunérations', 'D'],
  ['6312', 'Taxe d’apprentissage', 'D'],
  ['635', 'Autres impôts, taxes et versements assimilés', 'D'],
  ['63512', 'Taxes foncières', 'D'],
  ['6354', 'Droits d’enregistrement et de timbre', 'D'],
  ['641', 'Rémunérations du personnel', 'D'],
  ['6411', 'Salaires et appointements', 'D'],
  ['6413', 'Primes et gratifications', 'D'],
  ['645', 'Charges de sécurité sociale et de prévoyance', 'D'],
  ['6451', 'Cotisations à l’URSSAF', 'D'],
  ['6453', 'Cotisations aux caisses de retraite', 'D'],
  ['6454', 'Cotisations aux ASSEDIC', 'D'],
  ['654', 'Pertes sur créances irrécouvrables', 'D'],
  ['661', 'Charges d’intérêts', 'D'],
  ['6616', 'Intérêts bancaires et sur opérations de financement', 'D'],
  ['665', 'Escomptes accordés', 'D'],
  ['666', 'Pertes de change', 'D'],
  ['671', 'Charges exceptionnelles sur opérations de gestion', 'D'],
  ['675', 'Valeurs comptables des éléments d’actif cédés', 'D'],
  ['681', 'Dotations aux amortissements, dépréciations et provisions — charges d’exploitation', 'D'],
  ['6811', 'Dotations aux amortissements sur immobilisations', 'D'],
  ['6815', 'Dotations aux provisions pour risques et charges d’exploitation', 'D'],
  ['6816', 'Dotations aux dépréciations des immobilisations', 'D'],
  ['6817', 'Dotations aux dépréciations des actifs circulants', 'D'],
  ['686', 'Dotations aux amortissements, dépréciations et provisions — charges financières', 'D'],
  ['6866', 'Dotations aux dépréciations des éléments financiers', 'D'],
  ['687', 'Dotations aux amortissements, dépréciations et provisions — charges exceptionnelles', 'D'],
  ['68725', 'Dotations aux amortissements dérogatoires', 'D'],
  ['695', 'Impôts sur les bénéfices', 'D'],

  // ---- Classe 7 — Produits --------------------------------------------------
  ['701', 'Ventes de produits finis', 'C'],
  ['706', 'Prestations de services', 'C'],
  ['707', 'Ventes de marchandises', 'C'],
  ['708', 'Produits des activités annexes', 'C'],
  ['7085', 'Ports et frais accessoires facturés', 'C'],
  ['7097', 'Rabais, remises et ristournes accordés sur ventes de marchandises', 'D'],
  ['713', 'Variation des stocks (en-cours de production, produits)', 'M'],
  ['721', 'Production immobilisée — Immobilisations incorporelles', 'C'],
  ['722', 'Production immobilisée — Immobilisations corporelles', 'C'],
  ['740', 'Subventions d’exploitation', 'C'],
  ['758', 'Produits divers de gestion courante', 'C'],
  ['761', 'Produits de participations', 'C'],
  ['765', 'Escomptes obtenus', 'C'],
  ['766', 'Gains de change', 'C'],
  ['771', 'Produits exceptionnels sur opérations de gestion', 'C'],
  ['775', 'Produits des cessions d’éléments d’actif', 'C'],
  ['777', 'Quote-part des subventions d’investissement virée au résultat', 'C'],
  ['781', 'Reprises sur amortissements, dépréciations et provisions — exploitation', 'C'],
  ['7815', 'Reprises sur provisions pour risques et charges d’exploitation', 'C'],
  ['7817', 'Reprises sur dépréciations des actifs circulants', 'C'],
  ['78725', 'Reprises sur amortissements dérogatoires', 'C'],
]

const SENS_PAR_CLASSE: Record<ClasseCompte, SensNormal> = {
  1: 'credit',
  2: 'debit',
  3: 'debit',
  4: 'mixte',
  5: 'debit',
  6: 'debit',
  7: 'credit',
}

export function classeDe(numero: string): ClasseCompte | null {
  const premier = Number(numero[0])
  return premier >= 1 && premier <= 7 ? (premier as ClasseCompte) : null
}

export function typeDe(classe: ClasseCompte): TypeCompte {
  return classe >= 6 ? 'gestion' : 'bilan'
}

function construire([numero, libelle, drapeaux = '']: Entree): Compte {
  const classe = classeDe(numero)
  if (classe === null) throw new Error(`Numéro de compte hors classes 1 à 7 : ${numero}`)
  const sensNormal: SensNormal = drapeaux.includes('D')
    ? 'debit'
    : drapeaux.includes('C')
      ? 'credit'
      : drapeaux.includes('M')
        ? 'mixte'
        : SENS_PAR_CLASSE[classe]
  const compte: Compte = {
    numero,
    libelle,
    classe,
    type: typeDe(classe),
    lettrable: drapeaux.includes('L'),
    rapprochable: drapeaux.includes('R'),
    sensNormal,
  }
  return drapeaux.includes('X') ? { ...compte, auxiliaire: true } : compte
}

export const PLAN_COMPTABLE: readonly Compte[] = TABLE.map(construire)

const PAR_NUMERO = new Map<string, Compte>(PLAN_COMPTABLE.map((c) => [c.numero, c]))

/** Comptes collectifs pouvant être subdivisés en auxiliaires (401VIDAL, 411MARTIN). */
const RACINES_AUXILIAIRES = PLAN_COMPTABLE.filter((c) => c.auxiliaire).map((c) => c.numero)

export function trouverCompte(numero: string): Compte | undefined {
  return PAR_NUMERO.get(numero)
}

/**
 * Résout un numéro saisi, y compris une subdivision non listée.
 * 6068 se rattache à 606 ; 401VIDAL se rattache à 401 ; 9999 n'existe pas.
 * Le compte rendu porte le numéro saisi mais hérite des propriétés de sa racine.
 */
export function resoudreCompte(numero: string): Compte | undefined {
  const exact = PAR_NUMERO.get(numero)
  if (exact) return exact
  if (numero.length < 3) return undefined

  const racineAuxiliaire = RACINES_AUXILIAIRES.find(
    (racine) => numero.startsWith(racine) && numero.length > racine.length,
  )
  if (racineAuxiliaire) {
    const parent = PAR_NUMERO.get(racineAuxiliaire)!
    return { ...parent, numero, libelle: `${parent.libelle} — ${numero.slice(racineAuxiliaire.length)}` }
  }

  if (!/^\d+$/.test(numero)) return undefined
  for (let longueur = numero.length - 1; longueur >= 3; longueur -= 1) {
    const parent = PAR_NUMERO.get(numero.slice(0, longueur))
    if (parent) return { ...parent, numero, libelle: parent.libelle }
  }
  return undefined
}

export function existeAuPlan(numero: string): boolean {
  return resoudreCompte(numero) !== undefined
}

/** Recherche par numéro ou par libellé, pour la saisie au clavier. */
export function rechercherComptes(requete: string, limite = 12): Compte[] {
  const q = requete.trim().toLowerCase()
  if (q === '') return []
  const sansAccent = (texte: string) => texte.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const cible = sansAccent(q)
  const resultats = PLAN_COMPTABLE.map((compte) => {
    const numero = compte.numero.toLowerCase()
    const libelle = sansAccent(compte.libelle.toLowerCase())
    if (numero.startsWith(cible)) return { compte, rang: 0 }
    if (libelle.startsWith(cible)) return { compte, rang: 1 }
    if (libelle.includes(cible)) return { compte, rang: 2 }
    return null
  }).filter((r): r is { compte: Compte; rang: number } => r !== null)
  resultats.sort((a, b) => a.rang - b.rang || a.compte.numero.localeCompare(b.compte.numero))
  return resultats.slice(0, limite).map((r) => r.compte)
}

/** Racine du numéro sur n caractères. racine('44566', 3) → '445'. */
export function racine(numero: string, longueur: number): string {
  return numero.slice(0, longueur)
}
