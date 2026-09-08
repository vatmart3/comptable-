/**
 * La Ligne — analyse d'une saisie en langage naturel.
 *
 * « payé 240€ gasoil Total CB hier » doit devenir une écriture équilibrée,
 * sans qu'aucune main ne quitte le clavier et sans qu'aucun formulaire ne
 * s'ouvre.
 *
 * Ce module est DÉTERMINISTE et PUR : aucune dépendance réseau, aucun appel
 * à un modèle. Deux raisons, et la seconde est la vraie :
 *   1. le § 2 impose une saisie possible hors réseau — une saisie qui attend
 *      une réponse d'API n'est pas une saisie en quatre secondes ;
 *   2. l'utilisateur doit pouvoir prévoir ce que la ligne va produire. Une
 *      grammaire se apprend, un modèle se devine.
 *
 * La couche IA (§ 5.1) viendra en Phase 5 se brancher EN AVAL : elle reprendra
 * la main sur les seules phrases que cette grammaire n'a pas su lire, et ses
 * propositions passeront par le même type `LigneParse`.
 */

import { applyRate, baseFromInclusive, parseAmount, type Cents, type RateMilliPct } from './money'
import { accountClass } from './account'
import { isTauxValide, TAUX } from './vat'

// ── Types ───────────────────────────────────────────────────────────────────

export type ChipKind = 'sens' | 'date' | 'montant' | 'compte' | 'tva' | 'journal' | 'tiers' | 'libelle'

export interface Chip {
  readonly kind: ChipKind
  /** Ce qui s'affiche dans la puce. */
  readonly label: string
  /** Valeur exploitable : numéro de compte, code journal, centimes, ISO… */
  readonly value: string
  /** Portion de la saisie d'où vient la puce, pour la surligner. */
  readonly source: string | null
  /** Confiance en millièmes. 1000 = lu littéralement dans la phrase. */
  readonly confiance: number
}

export interface ProposedLine {
  readonly accountNumero: string
  readonly debit: Cents
  readonly credit: Cents
  readonly libelle: string
}

export interface ProposedEntry {
  readonly journalCode: string
  readonly date: Date
  readonly libelle: string
  readonly pieceRef: string | null
  readonly lines: readonly ProposedLine[]
}

/**
 * L'état intermédiaire entre la phrase et l'écriture.
 *
 * C'est LUI que les puces éditent : chaque puce est la vue d'un champ du
 * brouillon, et l'écriture se recalcule à chaque frappe. Une puce ne modifie
 * donc jamais des lignes comptables directement — ce qui garantit qu'une
 * écriture issue de La Ligne est équilibrée par construction.
 */
export interface Brouillon {
  readonly sens: 'achat' | 'vente'
  readonly date: Date
  /** Toujours un TTC : c'est ce qu'un humain annonce. */
  readonly montantTtc: Cents
  readonly compteNumero: string
  readonly tauxTva: RateMilliPct
  readonly journalCode: string
  readonly contrepartieNumero: string
  readonly tiersCode: string | null
  readonly libelle: string
}

export type LigneManque = 'montant' | 'compte' | 'date'

export interface LigneParse {
  readonly chips: readonly Chip[]
  /** Null tant qu'il manque de quoi équilibrer une écriture. */
  readonly ecriture: ProposedEntry | null
  /** Null pour les mêmes raisons ; sinon, l'état éditable de la saisie. */
  readonly brouillon: Brouillon | null
  /**
   * Ce qui est déjà pesable, même incomplet : c'est ce que La Balance affiche
   * pendant la frappe. Un montant sans compte penche à fond ; dès que le compte
   * arrive, les deux plateaux s'égalisent et la balance se pose.
   */
  readonly pesee: { readonly debit: Cents; readonly credit: Cents }
  readonly manque: readonly LigneManque[]
  /** Le « pourquoi » en une phrase, affiché sous la ligne. */
  readonly raison: string
}

export interface LigneCompte {
  readonly numero: string
  readonly libelle: string
  readonly tauxTvaAttendu?: number | null
}

export interface LigneTiers {
  readonly code: string
  readonly nom: string
  /** "client" | "fournisseur" | "les_deux" */
  readonly type: string
}

export interface LigneContexte {
  readonly comptes: readonly LigneCompte[]
  readonly tiers: readonly LigneTiers[]
  readonly aujourdHui: Date
}

// ── Normalisation ───────────────────────────────────────────────────────────

/**
 * Échappe une chaîne destinée à une RegExp. Indispensable : les motifs sont
 * construits à partir de données (libellés du PCG, noms de tiers), et
 * « Report à nouveau (solde créditeur) » contient une parenthèse ouvrante.
 */
export function echapper(valeur: string): string {
  return valeur.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Minuscules sans accents : « Réglé » et « regle » doivent se lire pareil. */
export function fold(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

// ── Lexique métier ──────────────────────────────────────────────────────────

/**
 * Mots du quotidien → compte du PCG. C'est le cœur de la vitesse de saisie :
 * personne ne tape « 606100 », tout le monde tape « gasoil ».
 * L'ordre compte : la première entrée qui matche gagne.
 */
const LEXIQUE: readonly { readonly motifs: readonly string[]; readonly compte: string }[] = [
  { motifs: ['gasoil', 'gazole', 'essence', 'carburant', 'diesel', 'sp95', 'sp98'], compte: '606100' },
  { motifs: ['electricite', 'edf', 'gaz', 'engie', 'eau', 'veolia'], compte: '606100' },
  { motifs: ['loyer', 'location bureau', 'bail'], compte: '613200' },
  { motifs: ['charges locatives', 'copropriete', 'syndic'], compte: '614000' },
  { motifs: ['telephone', 'mobile', 'forfait', 'internet', 'fibre', 'orange', 'sfr', 'bouygues', 'free'], compte: '626000' },
  { motifs: ['timbre', 'affranchissement', 'courrier', 'la poste'], compte: '626000' },
  { motifs: ['honoraires', 'avocat', 'expert-comptable', 'comptable', 'notaire', 'conseil'], compte: '622600' },
  { motifs: ['assurance', 'mutuelle', 'axa', 'maif', 'allianz'], compte: '616000' },
  { motifs: ['fournitures', 'papeterie', 'cartouche', 'ramette', 'stylo'], compte: '606400' },
  { motifs: ['entretien', 'menage', 'nettoyage', 'reparation'], compte: '615500' },
  { motifs: ['restaurant', 'repas', 'dejeuner', 'brasserie', 'traiteur'], compte: '625700' },
  { motifs: ['hotel', 'train', 'sncf', 'billet', 'avion', 'taxi', 'uber', 'peage', 'parking'], compte: '625100' },
  { motifs: ['publicite', 'pub', 'annonce', 'google ads', 'facebook ads', 'flyer'], compte: '623000' },
  { motifs: ['sous-traitance', 'sous traitance', 'freelance', 'prestataire'], compte: '611000' },
  { motifs: ['logiciel', 'abonnement saas', 'licence', 'saas'], compte: '651000' },
  { motifs: ['frais bancaires', 'agios', 'commission bancaire', 'cotisation carte'], compte: '627000' },
  { motifs: ['cotisation', 'adhesion', 'syndicat'], compte: '628100' },
  { motifs: ['salaire', 'paie', 'appointements'], compte: '641100' },
  { motifs: ['urssaf'], compte: '645100' },
  { motifs: ['marchandises', 'achat revente', 'stock'], compte: '607000' },
  { motifs: ['ordinateur', 'macbook', 'imprimante', 'ecran', 'serveur'], compte: '218300' },
  { motifs: ['mobilier', 'bureau', 'chaise', 'etagere'], compte: '218400' },
  { motifs: ['vehicule', 'voiture', 'utilitaire', 'camionnette'], compte: '218200' },
  { motifs: ['prestation', 'mission', 'facture client', 'honoraire client'], compte: '706000' },
  { motifs: ['vente', 'vendu'], compte: '707000' },
]

const MODES: readonly {
  readonly motifs: readonly string[]
  readonly label: string
  readonly journal: string
  readonly compte: string
}[] = [
  { motifs: ['cb', 'carte', 'carte bancaire', 'cartebleue', 'carte bleue'], label: 'Carte bancaire', journal: 'BQ', compte: '512000' },
  { motifs: ['virement', 'vir', 'vrt', 'sepa'], label: 'Virement', journal: 'BQ', compte: '512000' },
  { motifs: ['prelevement', 'prlv', 'debit automatique'], label: 'Prélèvement', journal: 'BQ', compte: '512000' },
  { motifs: ['cheque', 'chq'], label: 'Chèque', journal: 'BQ', compte: '512000' },
  { motifs: ['especes', 'cash', 'liquide', 'caisse'], label: 'Espèces', journal: 'CA', compte: '530000' },
]

/**
 * Sens de l'opération, par précédence décroissante — la première règle qui
 * matche tranche. L'ordre porte une ambiguïté réelle du français comptable :
 * « facture DE Total » est un achat, « facturé à Méridien » est une vente,
 * et « payé la facture Orange » reste un achat malgré le mot « facture ».
 */
const MARQUEURS_SENS: readonly { readonly re: RegExp; readonly sens: 'achat' | 'vente' }[] = [
  { re: /\b(?:facture|note|avoir) d[eu]\b/, sens: 'achat' },
  { re: /\b(?:paye|payee|payé|regle|reglee|achete|achat|achats|depense|depenses)\b/, sens: 'achat' },
  { re: /\b(?:encaisse|encaissee|facture|facturee|factures|vendu|vendue|vente|ventes|client)\b/, sens: 'vente' },
]

const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']
const MOIS = [
  'janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre',
]

// ── Extractions ─────────────────────────────────────────────────────────────

interface Extraction<T> {
  readonly valeur: T
  readonly source: string
}

/**
 * Les quatre écritures d'un montant, de la plus spécifique à la plus générale.
 * L'ordre est le sens : une alternance regex retient la première qui matche,
 * donc « 1 234,56 » doit être tenté avant « 1234 ».
 */
const MONTANT_RE = new RegExp(
  [
    '(?:^|[\\s(])(',
    '-?\\d{1,3}(?:[\\s\u202f\u00a0]\\d{3})+(?:[.,]\\d{1,2})?', // 1 234,56
    '|-?\\d{1,3}(?:\\.\\d{3})+(?:,\\d{1,2})?', //                     1.234,56
    '|-?\\d{1,3}(?:,\\d{3})+(?:\\.\\d{1,2})?', //                     1,234.56
    '|-?\\d+(?:[.,]\\d{1,2})?', //                                    1234.56
    ')\\s*(€|eur|euros?)?',
  ].join(''),
  'gi',
)

/**
 * Un montant marqué d'une devise gagne toujours. À défaut, le dernier nombre
 * l'emporte : « 240 € gasoil » comme « gasoil 240 » disent la même chose.
 *
 * Le texte reçu ici est DÉJÀ masqué de la date et du taux de TVA — sans quoi
 * « le 3 mars » ferait un montant de 3 €, et « tva 5,5 » un montant de 5,50 €.
 */
function extraireMontant(texte: string): Extraction<Cents> | null {
  const candidats: (Extraction<Cents> & { readonly devise: boolean })[] = []
  for (const match of texte.matchAll(MONTANT_RE)) {
    const brut = match[1]
    if (brut === undefined) continue
    const montant = parseAmount(brut)
    if (montant == null || montant === 0) continue
    candidats.push({ valeur: montant, source: match[0].trim(), devise: match[2] != null })
  }
  const marques = candidats.filter((candidat) => candidat.devise)
  const retenus = marques.length > 0 ? marques : candidats
  return retenus[retenus.length - 1] ?? null
}

/** Remplace un fragment par des espaces, en conservant les positions. */
function masquer(texte: string, fragment: string | null): string {
  if (!fragment) return texte
  const index = texte.indexOf(fragment)
  if (index < 0) return texte
  return texte.slice(0, index) + ' '.repeat(fragment.length) + texte.slice(index + fragment.length)
}

function jourUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

function extraireDate(folded: string, aujourdHui: Date): Extraction<Date> | null {
  const base = jourUtc(aujourdHui)
  const decale = (jours: number): Date => new Date(base.getTime() + jours * 86_400_000)

  if (/\bavant-?hier\b/.test(folded)) return { valeur: decale(-2), source: 'avant-hier' }
  if (/\bhier\b/.test(folded)) return { valeur: decale(-1), source: 'hier' }
  if (/\baujourd'?hui\b/.test(folded)) return { valeur: base, source: "aujourd'hui" }

  // « 12/03 », « 12/03/2025 », « 12-03-25 »
  const numerique = folded.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/)
  if (numerique) {
    const jour = Number(numerique[1])
    const mois = Number(numerique[2])
    const anneeBrute = numerique[3]
    let annee = base.getUTCFullYear()
    if (anneeBrute !== undefined) {
      const valeur = Number(anneeBrute)
      annee = valeur < 100 ? 2000 + valeur : valeur
    }
    if (jour >= 1 && jour <= 31 && mois >= 1 && mois <= 12) {
      const date = new Date(Date.UTC(annee, mois - 1, jour))
      // Sans année, une date future est forcément l'an dernier.
      if (anneeBrute === undefined && date > base) date.setUTCFullYear(annee - 1)
      return { valeur: date, source: numerique[0] }
    }
  }

  // « 12 mars », « 3 janvier 2025 »
  const litteral = folded.match(new RegExp(`\\b(\\d{1,2})\\s+(${MOIS.join('|')})(?:\\s+(\\d{4}))?\\b`))
  if (litteral) {
    const jour = Number(litteral[1])
    const mois = MOIS.indexOf(litteral[2] ?? '')
    const annee = litteral[3] ? Number(litteral[3]) : base.getUTCFullYear()
    const date = new Date(Date.UTC(annee, mois, jour))
    if (!litteral[3] && date > base) date.setUTCFullYear(annee - 1)
    return { valeur: date, source: litteral[0] }
  }

  // « lundi » : le plus récent dans le passé.
  const jourSemaine = folded.match(new RegExp(`\\b(${JOURS.join('|')})\\b`))
  if (jourSemaine) {
    const cible = JOURS.indexOf(jourSemaine[1] ?? '')
    let recul = (base.getUTCDay() - cible + 7) % 7
    if (recul === 0) recul = 7
    return { valeur: decale(-recul), source: jourSemaine[0] }
  }

  return null
}

function extraireMode(folded: string): (typeof MODES)[number] | null {
  for (const mode of MODES) {
    for (const motif of mode.motifs) {
      if (new RegExp(`\\b${echapper(motif)}\\b`).test(folded)) return mode
    }
  }
  return null
}

interface CompteTrouve {
  readonly numero: string
  readonly source: string
  readonly confiance: number
}

/** Un compte désigné par son numéro exact : aucune ambiguïté, confiance maximale. */
function extraireCompteExact(
  numeros: readonly string[],
  contexte: LigneContexte,
): CompteTrouve | null {
  for (const numero of numeros) {
    const compte = contexte.comptes.find((item) => item.numero === numero)
    if (compte) return { numero: compte.numero, source: numero, confiance: 1000 }
  }
  return null
}

function extraireCompte(
  folded: string,
  contexte: LigneContexte,
  ignorer: readonly string[] = [],
): CompteTrouve | null {
  // 1. Un numéro de compte tapé directement gagne toujours. On examine tous
  //    les nombres de la phrase, pas seulement le premier : « payé 100 gasoil
  //    606300 CB » commence par un montant, qui n'est pas un compte. Les
  //    fragments déjà lus comme montant sont écartés d'office.
  const candidats = [...folded.matchAll(/\b([1-8]\d{2,5})\b/g)]
    .map((match) => match[1])
    .filter((numero): numero is string => numero != null && !ignorer.includes(numero))
    .sort((a, b) => b.length - a.length)
  for (const numero of candidats) {
    const exact = contexte.comptes.find((compte) => compte.numero === numero)
    if (exact) return { numero: exact.numero, source: numero, confiance: 1000 }
    const prefixe = contexte.comptes.find((compte) => compte.numero.startsWith(numero))
    if (prefixe) return { numero: prefixe.numero, source: numero, confiance: 950 }
  }

  // 2. Le lexique métier.
  for (const entree of LEXIQUE) {
    for (const motif of entree.motifs) {
      if (new RegExp(`\\b${echapper(motif)}\\b`).test(folded)) {
        const existe = contexte.comptes.find((compte) => compte.numero === entree.compte)
        if (existe) return { numero: existe.numero, source: motif, confiance: 900 }
      }
    }
  }

  // 3. Le libellé du plan comptable lui-même : « fournitures administratives ».
  for (const compte of contexte.comptes) {
    const libelle = fold(compte.libelle)
    const mots = libelle.split(/[\s,'’—-]+/).filter((mot) => mot.length >= 5)
    for (const mot of mots) {
      if (new RegExp(`\\b${echapper(mot)}\\b`).test(folded)) {
        return { numero: compte.numero, source: mot, confiance: 650 }
      }
    }
  }

  return null
}

function extraireTiers(folded: string, contexte: LigneContexte): LigneTiers | null {
  let meilleur: { tiers: LigneTiers; longueur: number } | null = null
  for (const tiers of contexte.tiers) {
    const nom = fold(tiers.nom)
    // On teste le nom entier, puis son premier mot s'il est assez distinctif.
    const candidats = [nom, ...nom.split(/\s+/).filter((mot) => mot.length >= 4)]
    for (const candidat of candidats) {
      if (new RegExp(`\\b${echapper(candidat)}\\b`).test(folded)) {
        if (!meilleur || candidat.length > meilleur.longueur) {
          meilleur = { tiers, longueur: candidat.length }
        }
      }
    }
  }
  return meilleur?.tiers ?? null
}

function extraireTaux(folded: string): Extraction<RateMilliPct> | null {
  const exonere = folded.match(/\b(sans tva|hors tva|non assujetti|exonere)\b/)
  if (exonere) return { valeur: TAUX.EXONERE, source: exonere[0] }
  const explicite = folded.match(/\btva\s*(?:a\s*)?(\d{1,2}(?:[.,]\d)?)\s*%?/)
  if (explicite?.[1]) {
    const valeur = Number(explicite[1].replace(',', '.'))
    const enMillieme = Math.round(valeur * 1000)
    if (isTauxValide(enMillieme)) return { valeur: enMillieme, source: explicite[0] }
  }
  return null
}

// ── Analyse ─────────────────────────────────────────────────────────────────

/** Compte de TVA collectée à utiliser pour un taux donné. */
function compteTvaCollectee(taux: RateMilliPct): string {
  switch (taux) {
    case TAUX.INTERMEDIAIRE:
      return '445712'
    case TAUX.REDUIT:
      return '445713'
    case TAUX.PARTICULIER:
      return '445714'
    default:
      return '445711'
  }
}

/**
 * Construit les lignes comptables d'un brouillon. Pure et déterministe :
 * c'est le seul endroit où une écriture prend forme, que le brouillon vienne
 * d'une phrase analysée ou d'une puce éditée à la main.
 *
 * Sens des écritures, pour mémoire :
 *   achat  — la charge et sa TVA déductible au débit, la contrepartie au crédit ;
 *   vente  — la contrepartie au débit, le produit et sa TVA collectée au crédit.
 */
export function construireLignes(brouillon: Brouillon): ProposedLine[] {
  const { montantTtc, tauxTva, libelle } = brouillon
  const ht = baseFromInclusive(montantTtc, tauxTva)
  const tva = montantTtc - ht

  if (brouillon.sens === 'vente') {
    return [
      { accountNumero: brouillon.contrepartieNumero, debit: montantTtc, credit: 0, libelle },
      { accountNumero: brouillon.compteNumero, debit: 0, credit: ht, libelle },
      ...(tva > 0
        ? [{ accountNumero: compteTvaCollectee(tauxTva), debit: 0, credit: tva, libelle }]
        : []),
    ]
  }

  return [
    { accountNumero: brouillon.compteNumero, debit: ht, credit: 0, libelle },
    ...(tva > 0
      ? [
          {
            accountNumero: accountClass(brouillon.compteNumero) === 2 ? '445620' : '445660',
            debit: tva,
            credit: 0,
            libelle,
          },
        ]
      : []),
    { accountNumero: brouillon.contrepartieNumero, debit: 0, credit: montantTtc, libelle },
  ]
}

/** L'écriture complète issue d'un brouillon. */
export function construireEcriture(brouillon: Brouillon): ProposedEntry {
  return {
    journalCode: brouillon.journalCode,
    date: brouillon.date,
    libelle: brouillon.libelle,
    pieceRef: null,
    lines: construireLignes(brouillon),
  }
}

export function parseLigne(saisie: string, contexte: LigneContexte): LigneParse {
  const texte = saisie.trim()
  const folded = fold(texte)
  const chips: Chip[] = []
  const manque: LigneManque[] = []

  if (texte.length === 0) {
    return {
      chips: [],
      ecriture: null,
      brouillon: null,
      pesee: { debit: 0, credit: 0 },
      manque: ['montant', 'compte'],
      raison: 'Décrivez l’opération : « payé 240 € gasoil Total CB hier ».',
    }
  }

  // Sens de l'opération.
  const marqueur = MARQUEURS_SENS.map((regle) => {
    const trouve = folded.match(regle.re)
    return trouve ? { sens: regle.sens, source: trouve[0] } : null
  }).find((resultat) => resultat != null)
  const sens: 'achat' | 'vente' = marqueur?.sens ?? 'achat'
  chips.push({
    kind: 'sens',
    label: sens === 'vente' ? 'Vente' : 'Achat',
    value: sens,
    source: marqueur?.source ?? null,
    confiance: marqueur ? 950 : 600,
  })

  // Date.
  const date = extraireDate(folded, contexte.aujourdHui)
  const dateRetenue = date?.valeur ?? jourUtc(contexte.aujourdHui)
  chips.push({
    kind: 'date',
    label: dateRetenue.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }),
    value: dateRetenue.toISOString().slice(0, 10),
    source: date?.source ?? null,
    confiance: date ? 1000 : 500,
  })

  // Numéros de compte tapés en toutes lettres : six chiffres qui correspondent
  // exactement à un compte existant et que ne suit aucune devise. « payé 100
  // gasoil 606300 CB » contient un montant ET un compte ; sans cette
  // distinction, 606300 deviendrait un montant de 6 063 €.
  const comptesTapes = [...folded.matchAll(/\b([1-8]\d{5})\b(?!\s*(?:€|eur))/g)]
    .map((match) => match[1])
    .filter(
      (numero): numero is string =>
        numero != null && contexte.comptes.some((compte) => compte.numero === numero),
    )

  // TVA : lue avant le montant, pour que « tva 5,5 » ne devienne pas 5,50 €.
  const tauxExplicite = extraireTaux(folded)

  // Montant, cherché sur un texte masqué de la date et du taux : sans cela,
  // « le 3 mars » vaudrait 3 € et « tva 5,5 » vaudrait 5,50 €.
  let texteMontant = masquer(masquer(folded, date?.source ?? null), tauxExplicite?.source ?? null)
  for (const numero of comptesTapes) texteMontant = masquer(texteMontant, numero)
  const montant = extraireMontant(texteMontant)
  if (!montant) manque.push('montant')
  else {
    chips.push({
      kind: 'montant',
      label: montant.source,
      value: String(montant.valeur),
      source: montant.source,
      confiance: 1000,
    })
  }

  // Tiers.
  const tiers = extraireTiers(folded, contexte)
  if (tiers) {
    chips.push({ kind: 'tiers', label: tiers.nom, value: tiers.code, source: tiers.nom, confiance: 900 })
  }

  // Compte de charge ou de produit.
  // Les chiffres déjà consommés par le montant ne peuvent pas être un compte.
  const chiffresDuMontant = montant
    ? (montant.source.match(/\d+/g) ?? [])
    : []
  const compte =
    extraireCompteExact(comptesTapes, contexte) ?? extraireCompte(folded, contexte, chiffresDuMontant)
  if (!compte) manque.push('compte')
  const compteDetail = compte
    ? contexte.comptes.find((item) => item.numero === compte.numero)
    : undefined
  if (compte && compteDetail) {
    chips.push({
      kind: 'compte',
      label: `${compteDetail.numero} ${compteDetail.libelle}`,
      value: compteDetail.numero,
      source: compte.source,
      confiance: compte.confiance,
    })
  }

  // Mode de règlement → journal et contrepartie.
  const mode = extraireMode(folded)
  const journalCode = mode ? mode.journal : sens === 'vente' ? 'VE' : 'AC'
  const contrepartie = mode ? mode.compte : sens === 'vente' ? '411000' : '401000'
  chips.push({
    kind: 'journal',
    label: mode ? `${mode.label} · ${mode.journal}` : journalCode === 'VE' ? 'Ventes · VE' : 'Achats · AC',
    value: journalCode,
    source: mode ? mode.motifs[0] ?? null : null,
    confiance: mode ? 950 : 700,
  })

  // TVA : le taux explicite prime sur le taux attendu du compte.
  const tauxCompte = compteDetail?.tauxTvaAttendu ?? null
  const taux = tauxExplicite?.valeur ?? tauxCompte ?? (compte ? TAUX.NORMAL : TAUX.EXONERE)
  const montantEstHt = /\bht\b/.test(folded)

  if (manque.length > 0 || !compteDetail || !montant) {
    // Saisie incomplète : la balance pèse tout de même ce qu'elle sait. Un
    // montant sans imputation, c'est un plateau chargé et l'autre vide — la
    // balance penche à fond, et la validation reste fermée. Rien à écrire :
    // le déséquilibre se voit.
    const pesee = montant
      ? sens === 'vente'
        ? { debit: montant.valeur, credit: 0 }
        : { debit: 0, credit: montant.valeur }
      : { debit: 0, credit: 0 }
    return {
      chips,
      ecriture: null,
      brouillon: null,
      pesee,
      manque,
      raison: raisonManque(manque),
    }
  }

  const ttc = montantEstHt ? montant.valeur + applyRate(montant.valeur, taux) : montant.valeur

  chips.push({
    kind: 'tva',
    label: taux === 0 ? 'Sans TVA' : `TVA ${(taux / 1000).toString().replace('.', ',')} %`,
    value: String(taux),
    source: tauxExplicite?.source ?? null,
    confiance: tauxExplicite != null ? 1000 : tauxCompte != null ? 850 : 600,
  })

  const libelle = construireLibelle(tiers, compteDetail, compte?.source ?? null)
  chips.push({ kind: 'libelle', label: libelle, value: libelle, source: null, confiance: 700 })

  const brouillon: Brouillon = {
    sens,
    date: dateRetenue,
    montantTtc: ttc,
    compteNumero: compteDetail.numero,
    tauxTva: taux,
    journalCode,
    contrepartieNumero: contrepartie,
    tiersCode: tiers?.code ?? null,
    libelle,
  }

  const ecriture = construireEcriture(brouillon)
  const debit = ecriture.lines.reduce((acc, ligne) => acc + ligne.debit, 0)
  const credit = ecriture.lines.reduce((acc, ligne) => acc + ligne.credit, 0)

  return {
    chips,
    ecriture,
    brouillon,
    pesee: { debit, credit },
    manque: [],
    raison: construireRaison(sens, compteDetail, taux, mode?.label ?? null),
  }
}

/**
 * Le libellé d'une écriture, tel qu'un humain l'écrirait.
 *
 * On préfère le mot réellement lu dans la phrase au libellé du compte :
 * « Total Énergies — gasoil » se relit dans un grand livre, pas
 * « Total Énergies — Fournitures non stockables (eau, énergie) ». Le compte
 * dit l'imputation, le libellé dit l'opération. Ce ne sont pas les mêmes
 * informations, et le grand livre a besoin des deux.
 */
function construireLibelle(
  tiers: LigneTiers | null,
  compte: LigneCompte,
  motLu: string | null,
): string {
  // Un numéro de compte n'est pas un libellé : « 606300 » ne dit rien à qui
  // relira le grand livre, le libellé du compte si.
  const motUtilisable = motLu != null && motLu.length >= 3 && !/^\d+$/.test(motLu)
  const objet = motUtilisable ? motLu : compte.libelle
  if (tiers) return `${tiers.nom} — ${objet}`
  return objet.charAt(0).toUpperCase() + objet.slice(1)
}

function construireRaison(
  sens: 'achat' | 'vente',
  compte: LigneCompte,
  taux: RateMilliPct,
  mode: string | null,
): string {
  const tva = taux === 0 ? 'sans TVA' : `TVA ${(taux / 1000).toString().replace('.', ',')} %`
  const reglement = mode ? `réglé par ${mode.toLowerCase()}` : sens === 'vente' ? 'à encaisser' : 'à régler'
  return `${sens === 'vente' ? 'Vente' : 'Achat'} imputé en ${compte.numero}, ${tva}, ${reglement}.`
}

function raisonManque(manque: readonly LigneManque[]): string {
  if (manque.includes('montant') && manque.includes('compte')) {
    return 'Il manque le montant et la nature de l’opération.'
  }
  if (manque.includes('montant')) return 'Il manque le montant.'
  return 'Je ne reconnais pas la nature de l’opération — précisez ou tapez un numéro de compte.'
}

/**
 * Autocomplétion du plan comptable, pour l'édition d'une puce au clavier.
 * Le numéro prime sur le libellé : quelqu'un qui tape « 606 » cherche un compte,
 * pas un mot.
 */
export function chercherComptes(
  requete: string,
  comptes: readonly LigneCompte[],
  limite = 8,
): LigneCompte[] {
  const q = fold(requete.trim())
  if (q.length === 0) return comptes.slice(0, limite)

  const parNumero = comptes.filter((compte) => compte.numero.startsWith(q))
  const parLibelle = comptes.filter(
    (compte) => !compte.numero.startsWith(q) && fold(compte.libelle).includes(q),
  )
  return [...parNumero, ...parLibelle].slice(0, limite)
}
