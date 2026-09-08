/**
 * États : balance, grand livre, bilan, compte de résultat, SIG, ratios.
 *
 * Tout part d'une liste de lignes validées. Aucune de ces fonctions ne lit la
 * base : on leur donne des lignes, elles rendent des chiffres. C'est ce qui les
 * rend testables et ce qui permet de les rejouer sur n'importe quel périmètre
 * (un compte, un journal, une section analytique, un exercice entier).
 */

import { accountClass, compareAccountNumbers, naturalSide } from './account'
import type { Cents } from './money'

export interface StatementLine {
  readonly accountNumero: string
  readonly accountLibelle: string
  readonly date: Date
  readonly journalCode: string
  readonly entryNumero: number
  readonly entryId: string
  readonly libelle: string
  readonly debit: Cents
  readonly credit: Cents
  readonly lettre: string | null
}

export interface AccountBalance {
  readonly numero: string
  readonly libelle: string
  readonly classe: number
  readonly debit: Cents
  readonly credit: Cents
  /** débit − crédit. Positif = solde débiteur. */
  readonly solde: Cents
  readonly sens: 'debit' | 'credit' | 'nul'
  readonly mouvements: number
}

export function computeBalance(lines: readonly StatementLine[]): AccountBalance[] {
  const map = new Map<string, { libelle: string; debit: Cents; credit: Cents; count: number }>()
  for (const line of lines) {
    const current = map.get(line.accountNumero) ?? {
      libelle: line.accountLibelle,
      debit: 0,
      credit: 0,
      count: 0,
    }
    current.debit += line.debit
    current.credit += line.credit
    current.count += 1
    map.set(line.accountNumero, current)
  }

  return [...map.entries()]
    .map(([numero, agg]) => {
      const solde = agg.debit - agg.credit
      return {
        numero,
        libelle: agg.libelle,
        classe: accountClass(numero),
        debit: agg.debit,
        credit: agg.credit,
        solde,
        sens: solde > 0 ? ('debit' as const) : solde < 0 ? ('credit' as const) : ('nul' as const),
        mouvements: agg.count,
      }
    })
    .sort((a, b) => compareAccountNumbers(a.numero, b.numero))
}

/** Contrôle global : la balance générale est équilibrée, ou la compta est fausse. */
export function balanceIsSquare(balance: readonly AccountBalance[]): boolean {
  let debit = 0
  let credit = 0
  for (const account of balance) {
    debit += account.debit
    credit += account.credit
  }
  return debit === credit
}

export interface LedgerRow extends StatementLine {
  /** Solde du compte après cette ligne. C'est ce que « Le Fil » colore. */
  readonly soldeProgressif: Cents
}

/**
 * Grand livre d'un compte, avec solde progressif. Les lignes sont triées par
 * date puis par numéro d'écriture : deux écritures du même jour restent dans
 * l'ordre où elles ont été validées.
 */
export function runningLedger(lines: readonly StatementLine[], soldeInitial: Cents = 0): LedgerRow[] {
  const ordered = [...lines].sort((a, b) => {
    const byDate = a.date.getTime() - b.date.getTime()
    if (byDate !== 0) return byDate
    return a.entryNumero - b.entryNumero
  })
  let solde = soldeInitial
  return ordered.map((line) => {
    solde += line.debit - line.credit
    return { ...line, soldeProgressif: solde }
  })
}

// ── Agrégats par préfixe de compte ──────────────────────────────────────────

type Balance = readonly AccountBalance[]

/** Somme des soldes (débit − crédit) des comptes commençant par l'un des préfixes. */
function byPrefix(balance: Balance, ...prefixes: string[]): Cents {
  let total = 0
  for (const account of balance) {
    if (prefixes.some((prefix) => account.numero.startsWith(prefix))) total += account.solde
  }
  return total
}

/** Montant d'un poste de charge : positif quand le compte est débiteur. */
const charge = (balance: Balance, ...prefixes: string[]): Cents => byPrefix(balance, ...prefixes)

/** Montant d'un poste de produit : positif quand le compte est créditeur. */
const produit = (balance: Balance, ...prefixes: string[]): Cents => -byPrefix(balance, ...prefixes)

// ── Compte de résultat ──────────────────────────────────────────────────────

export interface IncomeStatement {
  readonly produitsExploitation: Cents
  readonly chargesExploitation: Cents
  readonly resultatExploitation: Cents
  readonly produitsFinanciers: Cents
  readonly chargesFinancieres: Cents
  readonly resultatFinancier: Cents
  readonly resultatCourant: Cents
  readonly produitsExceptionnels: Cents
  readonly chargesExceptionnelles: Cents
  readonly resultatExceptionnel: Cents
  readonly participation: Cents
  readonly impotSurBenefices: Cents
  readonly resultatNet: Cents
}

export function incomeStatement(balance: Balance): IncomeStatement {
  const produitsExploitation = produit(balance, '70', '71', '72', '74', '75', '781', '791')
  const chargesExploitation = charge(balance, '60', '61', '62', '63', '64', '65', '681')
  const produitsFinanciers = produit(balance, '76', '786', '796')
  const chargesFinancieres = charge(balance, '66', '686')
  const produitsExceptionnels = produit(balance, '77', '787', '797')
  const chargesExceptionnelles = charge(balance, '67', '687')
  const participation = charge(balance, '691')
  const impotSurBenefices = charge(balance, '695', '698')

  const resultatExploitation = produitsExploitation - chargesExploitation
  const resultatFinancier = produitsFinanciers - chargesFinancieres
  const resultatExceptionnel = produitsExceptionnels - chargesExceptionnelles
  const resultatCourant = resultatExploitation + resultatFinancier

  return {
    produitsExploitation,
    chargesExploitation,
    resultatExploitation,
    produitsFinanciers,
    chargesFinancieres,
    resultatFinancier,
    resultatCourant,
    produitsExceptionnels,
    chargesExceptionnelles,
    resultatExceptionnel,
    participation,
    impotSurBenefices,
    resultatNet:
      resultatCourant + resultatExceptionnel - participation - impotSurBenefices,
  }
}

/** Résultat de l'exercice : produits (classe 7) − charges (classe 6). */
export function resultatExercice(balance: Balance): Cents {
  return -byPrefix(balance, '7') - byPrefix(balance, '6')
}

// ── Soldes intermédiaires de gestion ────────────────────────────────────────

export interface Sig {
  readonly margeCommerciale: Cents
  readonly productionExercice: Cents
  readonly valeurAjoutee: Cents
  readonly excedentBrutExploitation: Cents
  readonly resultatExploitation: Cents
  readonly resultatCourant: Cents
  readonly resultatExceptionnel: Cents
  readonly resultatNet: Cents
  readonly capaciteAutofinancement: Cents
}

export function sig(balance: Balance): Sig {
  // Marge commerciale = ventes de marchandises − coût d'achat des marchandises
  // vendues (achats + variation de stock de marchandises).
  const ventesMarchandises = produit(balance, '707')
  const coutAchatMarchandises = charge(balance, '607', '6037')
  const margeCommerciale = ventesMarchandises - coutAchatMarchandises

  // Production de l'exercice = vendue + stockée + immobilisée.
  const productionVendue = produit(balance, '701', '702', '703', '704', '705', '706', '708')
  const productionStockee = produit(balance, '713')
  const productionImmobilisee = produit(balance, '72')
  const productionExercice = productionVendue + productionStockee + productionImmobilisee

  // Consommations en provenance de tiers.
  const consommations =
    charge(balance, '601', '602', '604', '605', '606', '6031', '6032') +
    charge(balance, '61', '62')

  const valeurAjoutee = margeCommerciale + productionExercice - consommations

  const subventions = produit(balance, '74')
  const impotsTaxes = charge(balance, '63')
  const chargesPersonnel = charge(balance, '64')
  const excedentBrutExploitation = valeurAjoutee + subventions - impotsTaxes - chargesPersonnel

  const cr = incomeStatement(balance)

  // CAF (méthode additive depuis le résultat net) : on neutralise les charges
  // et produits calculés, sans mouvement de trésorerie.
  const dotations = charge(balance, '681', '686', '687')
  const reprises = produit(balance, '781', '786', '787')
  const vncCedee = charge(balance, '675')
  const produitsCession = produit(balance, '775')
  const quotePartSubventions = produit(balance, '777')
  const capaciteAutofinancement =
    cr.resultatNet + dotations - reprises + vncCedee - produitsCession - quotePartSubventions

  return {
    margeCommerciale,
    productionExercice,
    valeurAjoutee,
    excedentBrutExploitation,
    resultatExploitation: cr.resultatExploitation,
    resultatCourant: cr.resultatCourant,
    resultatExceptionnel: cr.resultatExceptionnel,
    resultatNet: cr.resultatNet,
    capaciteAutofinancement,
  }
}

// ── Bilan ───────────────────────────────────────────────────────────────────

export interface BalanceSheet {
  readonly actif: {
    readonly immobilisationsBrutes: Cents
    readonly amortissements: Cents
    readonly immobilisationsNettes: Cents
    readonly stocks: Cents
    readonly creances: Cents
    readonly disponibilites: Cents
    readonly total: Cents
  }
  readonly passif: {
    readonly capitauxPropres: Cents
    readonly resultat: Cents
    readonly provisions: Cents
    readonly dettesFinancieres: Cents
    readonly dettesExploitation: Cents
    readonly total: Cents
  }
  /** Actif − passif. Doit valoir 0 : c'est l'équation du bilan. */
  readonly ecart: Cents
}

/**
 * Bilan après affectation implicite du résultat : le résultat de l'exercice
 * (classes 6 et 7) est porté au passif, ce qui referme l'équation
 * actif = passif sans passer par les écritures de clôture.
 */
export function balanceSheet(balance: Balance): BalanceSheet {
  const immobilisationsBrutes = byPrefix(balance, '20', '21', '22', '23', '25', '26', '27')
  const amortissements = -byPrefix(balance, '28', '29')
  const stocks = byPrefix(balance, '31', '32', '33', '34', '35', '37') + byPrefix(balance, '39')
  const creances =
    byPrefix(balance, '41', '409', '425', '4456', '4487', '486') + byPrefix(balance, '46', '47')
  const disponibilites = byPrefix(balance, '50', '51', '53', '58')

  const capitauxPropres = -byPrefix(balance, '10', '11', '13', '14')
  const resultat = resultatExercice(balance)
  const provisions = -byPrefix(balance, '15')
  const dettesFinancieres = -byPrefix(balance, '16', '17')
  const dettesExploitation = -(
    byPrefix(balance, '40', '419', '42', '43', '44', '487') -
    byPrefix(balance, '409', '425', '4456', '4487')
  )

  const totalActif =
    immobilisationsBrutes - amortissements + stocks + creances + disponibilites
  const totalPassif =
    capitauxPropres + resultat + provisions + dettesFinancieres + dettesExploitation

  return {
    actif: {
      immobilisationsBrutes,
      amortissements,
      immobilisationsNettes: immobilisationsBrutes - amortissements,
      stocks,
      creances,
      disponibilites,
      total: totalActif,
    },
    passif: {
      capitauxPropres,
      resultat,
      provisions,
      dettesFinancieres,
      dettesExploitation,
      total: totalPassif,
    },
    ecart: totalActif - totalPassif,
  }
}

// ── Ratios ──────────────────────────────────────────────────────────────────

export interface Ratios {
  /** Marge nette : résultat net / chiffre d'affaires, en millièmes. */
  readonly margeNette: number | null
  /** Taux de marge brute (EBE / CA), en millièmes. */
  readonly tauxEbe: number | null
  /** Fonds de roulement, besoin en fonds de roulement, trésorerie nette. */
  readonly fondsRoulement: Cents
  readonly besoinFondsRoulement: Cents
  readonly tresorerieNette: Cents
  /** Délai moyen de règlement client, en jours. */
  readonly delaiClients: number | null
}

export function ratios(balance: Balance, joursPeriode = 365): Ratios {
  const ca = produit(balance, '70')
  const indicateurs = sig(balance)
  const bilan = balanceSheet(balance)

  const ressourcesStables =
    bilan.passif.capitauxPropres + bilan.passif.resultat + bilan.passif.provisions + bilan.passif.dettesFinancieres
  const fondsRoulement = ressourcesStables - bilan.actif.immobilisationsNettes
  const besoinFondsRoulement = bilan.actif.stocks + bilan.actif.creances - bilan.passif.dettesExploitation
  const creancesClients = byPrefix(balance, '41')
  const caTtc = ca + -byPrefix(balance, '4457')

  return {
    margeNette: ca > 0 ? Math.round((indicateurs.resultatNet / ca) * 1000) : null,
    tauxEbe: ca > 0 ? Math.round((indicateurs.excedentBrutExploitation / ca) * 1000) : null,
    fondsRoulement,
    besoinFondsRoulement,
    tresorerieNette: fondsRoulement - besoinFondsRoulement,
    delaiClients: caTtc > 0 ? Math.round((creancesClients / caTtc) * joursPeriode) : null,
  }
}

/** Sens attendu du solde d'un compte, pour signaler les soldes « à l'envers ». */
export function soldeInattendu(account: AccountBalance): boolean {
  const attendu = naturalSide(account.numero)
  if (attendu === 'mixte' || account.sens === 'nul') return false
  return attendu !== account.sens
}
