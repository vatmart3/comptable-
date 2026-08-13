/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  SOURCE UNIQUE DU SITE
 * ─────────────────────────────────────────────────────────────────────────────
 *  Tout ce qui change d'un cabinet à l'autre est ici : identité, coordonnées,
 *  couleurs, tarifs, textes, dossiers, objections.
 *
 *  Procédure de rebranding complète : voir README.md (§ Rebrander en 15 minutes).
 *  Les couleurs sont déclarées ici ET dans src/index.css (@theme) — les deux
 *  listes sont volontairement identiques et signalées dans le README.
 *
 *  ⚠ Cabinet de démonstration. Ferrand & Solère n'existe pas. Les dossiers du
 *    §05 illustrent des situations réelles du secteur et ne désignent personne.
 *    `demo: true` affiche les mentions d'honnêteté correspondantes. Passez-le à
 *    `false` une fois les contenus réels en place.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { computeProfile, type PlanRef, type Profile, type SimInput } from '../lib/simulator.ts'

export const demo = true

/* ── Identité ─────────────────────────────────────────────────────────────── */

export const identity = {
  name: 'Ferrand & Solère',
  legalName: 'Cabinet Ferrand & Solère',
  kind: 'Experts-comptables',
  city: 'Sète',
  area: 'Bassin de Thau et Montpellier',
  address: { street: '12 quai de la Résistance', postalCode: '34200', city: 'Sète' },
  phone: '04 67 00 00 00',
  phoneHref: '+33467000000',
  email: 'cabinet@ferrand-solere.fr',
  siren: '000 000 000',
  order: "Ordre des experts-comptables — Conseil régional d'Occitanie",
  url: 'https://ferrand-solere.fr',
  hours: 'Lundi au vendredi, 8 h 30 – 18 h 00',
  geo: { lat: 43.4033, lng: 3.6956 },
}

export const meta = {
  title: `Expert-comptable à Sète — ${identity.legalName}`,
  description:
    "Cabinet d'expertise comptable à Sète. Tenue, bilan, TVA, paie et pilotage pour TPE, restaurateurs, artisans, viticulteurs et professions libérales. Bassin de Thau et Montpellier. Premier rendez-vous sans engagement.",
  ogImage: '/og.png',
}

/* ── Couleurs (miroir de @theme dans src/index.css) ───────────────────────── */

export const palette = {
  paper: '#E9EDE6',
  paperHi: '#F7F8F5',
  ink: '#14201B',
  stamp: '#23347A',
  debit: '#A83A2C',
  rule: '#C3CCBE',
} as const

/* ── Honoraires ───────────────────────────────────────────────────────────── */
/*  Ordre volontaire : la formule la plus complète est présentée en premier.
 *  Elle sert de référence haute. `mid` porte `highlight`.                     */

export interface Plan extends PlanRef {
  tagline: string
  audience: string
  includes: string[]
  excludes?: string[]
  highlight?: boolean
  note?: string
}

export const plans: Plan[] = [
  {
    id: 'direction',
    name: 'Direction financière externalisée',
    monthly: 690,
    tagline: 'Vous avez un directeur financier. Il ne travaille pas à temps plein.',
    audience: 'Sociétés de plus de 700 000 € de chiffre d’affaires, ou plus de 10 salariés.',
    includes: [
      'Tout ce que contient Pilotage',
      'Tableau de bord mensuel, remis le 12',
      'Comité de gestion trimestriel, en présentiel',
      'Prévisionnel glissant à 12 mois et suivi des covenants bancaires',
      'Présence à vos côtés en cas de contrôle fiscal ou URSSAF',
    ],
  },
  {
    id: 'pilotage',
    name: 'Pilotage',
    monthly: 259,
    tagline: 'Vous savez où vous en êtes quatre fois par an, pas une.',
    audience: 'La formule de référence du cabinet. TPE de 100 000 à 700 000 € de chiffre d’affaires.',
    includes: [
      'Tenue, bilan, liasse fiscale, déclarations de TVA',
      'Situation comptable trimestrielle commentée en 20 minutes',
      'Arbitrage de votre rémunération une fois par an, en octobre',
      'Questions illimitées, réponse sous 48 heures ouvrées',
    ],
    highlight: true,
    note: '70 € de plus que Conformité. C’est la différence entre être en règle et savoir où vous allez.',
  },
  {
    id: 'conformite',
    name: 'Conformité',
    monthly: 189,
    tagline: 'Vous êtes en règle. Vous n’êtes pas accompagné.',
    audience: 'Structures simples, sans salarié, à activité stable.',
    includes: ['Tenue, bilan, liasse fiscale, déclarations de TVA'],
    excludes: [
      'Aucun point en cours d’année',
      'Aucun arbitrage de rémunération',
      'Les questions sont facturées à l’heure',
    ],
  },
]

export const pricingFootnotes = [
  'Prix hors taxes, par mois, sans frais de dossier.',
  'Paie : 15 € par bulletin. Reprise du dossier en cours d’année : 0 €.',
  'Engagement de 12 mois, révisable à la date anniversaire. Pas d’astérisque, pas de « à partir de ».',
]

/* ── Profil de référence ──────────────────────────────────────────────────── */
/*  Les chiffres par défaut de la page ne sont pas écrits en dur : ils sortent
 *  du modèle de calcul (src/lib/simulator.ts), avec ce profil en entrée.
 *  Le simulateur utilise la même fonction. Le site ne peut pas se contredire.  */

export const referenceInput: SimInput = {
  statut: 'sarl',
  ca: 'ca2',
  salaries: 's2',
  keeper: 'moi',
  hours: 'h2',
}

export const referenceProfile: Profile = computeProfile(referenceInput, plans)

export const referenceLabel =
  'SARL, 270 000 € de chiffre d’affaires, 5 salariés, comptabilité tenue en interne, 7 heures par mois.'

/* ── Navigation — sommaire de registre ────────────────────────────────────── */

/*  Le dernier folio n'est pas une entrée de liste : c'est le bouton d'action.
 *  Un sommaire de registre se termine par l'écriture qu'il reste à passer.     */
export const nav = [
  { id: 'cout', folio: '01', label: 'Coût' },
  { id: 'metier', folio: '02', label: 'Métier' },
  { id: 'simulation', folio: '03', label: 'Simulation' },
  { id: 'cabinet', folio: '04', label: 'Cabinet' },
  { id: 'dossiers', folio: '05', label: 'Dossiers' },
  { id: 'honoraires', folio: '06', label: 'Honoraires' },
  { id: 'objections', folio: '07', label: 'Objections' },
  { id: 'rendez-vous', folio: '08', label: 'Rendez-vous' },
]

/* ── Grand livre ──────────────────────────────────────────────────────────── */
/*  Une écriture par section franchie. Les dates parcourent un exercice civil :
 *  la dernière écriture est datée du 31/12 — c'est celle qui solde l'exercice,
 *  et elle ne se solde que si le visiteur prend rendez-vous.                   */

export type LedgerSide = 'debit' | 'credit'

export interface LedgerLineDef {
  id: string
  date: string
  label: string
  side: LedgerSide
  /** Montant lu dans le profil courant — profil de référence, ou celui du visiteur. */
  amount: (p: Profile) => number
}

export const ledgerLines: LedgerLineDef[] = [
  { id: 'cost-time', date: '31/01', label: 'Temps de gestion', side: 'debit', amount: (p) => p.costTime },
  { id: 'cost-deductions', date: '28/02', label: 'Déductions non réclamées', side: 'debit', amount: (p) => p.costDeductions },
  { id: 'cost-penalties', date: '15/03', label: 'Majorations et intérêts', side: 'debit', amount: (p) => p.costPenalties },
  { id: 'credit-arbitrage', date: '30/04', label: 'Arbitrage de rémunération', side: 'credit', amount: (p) => p.creditArbitrage },
  { id: 'credit-time', date: '31/05', label: 'Temps repris', side: 'credit', amount: (p) => p.creditTime },
  { id: 'credit-penalties', date: '30/06', label: 'Régularité déclarative', side: 'credit', amount: (p) => p.creditPenalties },
  { id: 'credit-deductions', date: '30/09', label: 'Déductions récupérées', side: 'credit', amount: (p) => p.creditDeductions },
  { id: 'debit-fees', date: '31/10', label: 'Honoraires', side: 'debit', amount: (p) => p.fees },
  { id: 'debit-reprise', date: '30/11', label: 'Reprise du dossier', side: 'debit', amount: () => 0 },
]

export const ledgerPending = {
  date: '31/12',
  label: '— écriture en attente —',
  settledLabel: 'Premier rendez-vous',
}

export const ledgerCopy = {
  title: 'Grand livre',
  balance: 'Solde',
  hint: 'Chaque section franchie écrit une ligne. L’exercice se clôt au 31/12.',
  hide: 'Masquer',
  hideLong: 'Masquer le grand livre',
  show: 'Afficher le grand livre',
  reference: 'Profil de référence',
  yours: 'Votre profil',
}

/* ── §00 — Hero ───────────────────────────────────────────────────────────── */

export const hero = {
  line: 'Vous pilotez à vue.',
  sub: 'Vous saurez en mai ce que votre entreprise a gagné l’an dernier. Sept mois après le moment où il fallait décider.',
  eyebrow: `${identity.kind} — ${identity.city}, ${identity.area}`,
  scroll: 'Descendez : la balance se redresse',
  /* Sous `prefers-reduced-motion`, la balance est déjà droite : lui promettre
     un mouvement qui n'aura pas lieu serait faux. */
  scrollReduced: 'La balance est à l’équilibre. Le registre commence ici.',
  alt: "Une balance à deux plateaux : le plateau de gauche s'effondre sous une pile de documents en désordre.",
}

/* ── §01 — Ce que le désordre vous coûte ──────────────────────────────────── */

export const cost = {
  folio: '01',
  title: 'Ce que le désordre vous coûte',
  intro:
    'Trois lignes, chiffrées sur un profil de référence. Vous les remplacerez par les vôtres en §03.',
  reference: referenceLabel,
  items: [
    {
      id: 'cost-time',
      label: 'Le temps que vous y passez',
      body: (p: Profile) =>
        `${p.hoursPerMonth} heures par mois à classer, ressaisir et chercher un justificatif. ${p.hoursPerYear} heures par an. Ces heures ne sont ni facturées, ni vendues, ni déléguées.`,
      foot: (p: Profile) =>
        `Valorisées à ${p.hourlyValue} € de l’heure. Hypothèse basse : c’est un coût d’opportunité, pas votre taux de facturation.`,
    },
    {
      id: 'cost-deductions',
      label: 'Ce que personne ne réclame',
      body: () =>
        'Frais de véhicule sous-évalués, TVA oubliée sur des notes, amortissements non pratiqués, cotisations facultatives non déduites. Une déduction non prise sur l’exercice ne se rattrape pas l’exercice suivant. Elle est perdue.',
      foot: () => 'Estimation en pourcentage du chiffre d’affaires, selon qui tient les comptes.',
    },
    {
      id: 'cost-penalties',
      label: 'Les retards',
      body: () =>
        'Une déclaration de TVA déposée hors délai : 10 % de majoration. Un paiement en retard : 5 % de plus. Et 0,20 % d’intérêt par mois qui court sur le solde. Personne ne le fait exprès. Tout le monde le paie.',
      foot: () => 'Articles 1727, 1728 et 1731 du Code général des impôts.',
    },
  ],
  totalLabel: 'Coût annuel de la situation actuelle',
  outro:
    'Ce total n’est pas une facture. C’est ce qui sort de votre entreprise sans qu’aucune ligne ne le nomme.',
}

/* ── §02 — Le métier ──────────────────────────────────────────────────────── */

export const craft = {
  folio: '02',
  title: 'Ce que vous croyez acheter, ce que vous achetez',
  lead: 'La saisie est le prix d’entrée. Ce n’est pas le métier.',
  believedTitle: 'Ce que vous croyez acheter',
  realTitle: 'Ce que vous achetez',
  believed: [
    'La saisie des factures',
    'Le bilan et la liasse fiscale',
    'Les déclarations de TVA',
    'Un classeur, une fois par an',
  ],
  real: [
    {
      label: 'Le calibrage de votre rémunération',
      body: 'Entre salaire et dividendes, l’écart de coût global se joue au millier d’euros. Il se décide en octobre, sur des chiffres provisoires. En mai, il n’y a plus rien à décider.',
    },
    {
      label: 'L’arbitrage fiscal',
      body: 'Amortir ou passer en charge. Étaler ou constater. Chaque option a une conséquence de trésorerie, et elle vous appartient. Notre travail est de vous la poser en français.',
    },
    {
      label: 'Un prévisionnel qui tient devant un banquier',
      body: 'Pas un tableau optimiste. Un document dont chaque hypothèse est défendable ligne à ligne, parce qu’on vous demandera de la défendre.',
    },
    {
      label: 'Votre défense en cas de contrôle',
      body: 'Un contrôle se gagne avec les pièces de l’exercice concerné, classées à l’époque. Pas avec des explications données trois ans plus tard.',
    },
  ],
  outro:
    'La colonne de droite est la raison d’être d’un cabinet. La colonne de gauche est ce qu’on facture au même prix partout.',
}

/* ── §03 — Simulateur ─────────────────────────────────────────────────────── */

export const sim = {
  folio: '03',
  title: 'Ouvrons votre dossier',
  intro:
    'Cinq questions. Aucune coordonnée demandée avant le résultat. Vous pouvez repartir avec le chiffre sans rien nous laisser.',
  start: 'Ouvrir le dossier',
  restart: 'Refaire la simulation',
  of: 'sur',
  back: 'Question précédente',
  questions: [
    {
      id: 'statut' as const,
      short: 'Forme juridique',
      title: 'Votre entreprise, aujourd’hui, c’est quoi ?',
      hint: 'La question facile. On monte progressivement.',
      options: [
        { value: 'micro', label: 'Micro-entreprise' },
        { value: 'ei', label: 'Entreprise individuelle au réel' },
        { value: 'eurl', label: 'EURL' },
        { value: 'sarl', label: 'SARL' },
        { value: 'sas', label: 'SAS ou SASU' },
      ],
    },
    {
      id: 'ca' as const,
      short: 'Chiffre d’affaires',
      title: 'Chiffre d’affaires annuel, à la louche.',
      hint: 'Une tranche suffit. On ne vous demande pas d’être exact.',
      options: [
        { value: 'ca0', label: 'Moins de 50 000 €' },
        { value: 'ca1', label: 'De 50 000 à 150 000 €' },
        { value: 'ca2', label: 'De 150 000 à 400 000 €' },
        { value: 'ca3', label: 'De 400 000 € à 1 million' },
        { value: 'ca4', label: 'Plus d’un million' },
      ],
    },
    {
      id: 'salaries' as const,
      short: 'Effectif',
      title: 'Combien de salariés ?',
      hint: 'Vous compris si vous êtes salarié de votre société.',
      options: [
        { value: 's0', label: 'Aucun' },
        { value: 's1', label: '1 ou 2' },
        { value: 's2', label: 'De 3 à 9' },
        { value: 's3', label: '10 et plus' },
      ],
    },
    {
      id: 'keeper' as const,
      short: 'Tenue actuelle',
      title: 'Qui tient la comptabilité aujourd’hui ?',
      hint: 'Répondez franchement, le calcul en dépend beaucoup.',
      options: [
        { value: 'moi', label: 'Moi' },
        { value: 'salarie', label: 'Un salarié, en interne' },
        { value: 'cabinet', label: 'Un cabinet' },
        { value: 'personne', label: 'Personne, pour l’instant' },
      ],
    },
    {
      id: 'hours' as const,
      short: 'Temps passé',
      title: 'Combien d’heures par mois y passez-vous, vous ?',
      hint: 'Classement, recherche de pièces, relances, allers-retours compris.',
      options: [
        { value: 'h0', label: 'Moins d’une heure' },
        { value: 'h1', label: 'De 2 à 4 heures' },
        { value: 'h2', label: 'De 5 à 9 heures' },
        { value: 'h3', label: 'De 10 à 20 heures' },
        { value: 'h4', label: 'Plus de 20 heures' },
      ],
    },
  ],
  result: {
    eyebrow: 'Dossier ouvert',
    costLabel: 'Coût annuel de votre gestion actuelle',
    recoverableLabel: 'Postes récupérables',
    feesLabel: 'Honoraires de la formule adaptée',
    soldeLabel: 'Solde annuel estimé',
    hoursLabel: 'Heures rendues par an',
    assumptionsLabel: 'Hypothèses du calcul',
    ledgerNote: 'Le grand livre affiche désormais vos chiffres, pas les nôtres.',
    verdicts: {
      gain: {
        title: 'Le calcul penche de notre côté.',
        body: 'Le solde est volontairement modeste. Un cabinet qui vous annonce dix mille euros d’économies vous ment ou ne connaît pas votre dossier. Ce qui compte autant que le solde, ce sont les heures.',
      },
      serre: {
        title: 'C’est serré.',
        body: 'Le gain financier ne justifie pas à lui seul de changer. Le temps rendu, peut-être. Regardez la ligne des heures avant de décider, et venez-en parler sans engagement.',
      },
      inutile: {
        title: 'Vous n’avez pas besoin de nous.',
        body: 'À ce niveau, nos honoraires coûteraient plus cher que ce qu’ils vous rapporteraient. Nous préférons vous le dire ici plutôt qu’en rendez-vous. Revenez quand votre activité aura changé de dimension, ou si vous embauchez.',
      },
    },
  },
  capture: {
    title: 'Le détail par écrit ?',
    body: 'Nous vous envoyons le calcul poste par poste, avec les hypothèses. Rien d’autre : pas de newsletter, pas de relance commerciale.',
    label: 'Votre adresse e-mail',
    submit: 'Recevoir le détail',
    decline: 'Non merci, je garde le chiffre',
    declined: 'Entendu. Le résultat reste affiché, il ne disparaîtra pas.',
    done: 'C’est noté.',
  },
}

/* ── §04 — Le cabinet ─────────────────────────────────────────────────────── */

export const expert = {
  folio: '04',
  title: 'Qui signe vos comptes',
  person: {
    name: 'Camille Ferrand',
    role: 'Expert-comptable, associée',
    registration: 'Inscrite au tableau de l’Ordre des experts-comptables, Conseil régional d’Occitanie',
    number: 'n° 14 25 073',
    since: 'Inscrite depuis 2011',
    /**
     * Chemin d'une vraie photographie, ou `null`.
     *
     * `null` — ce qui est le cas sur cette démonstration — affiche à la place
     * la fiche d'inscription au tableau de l'Ordre, composée en typographie du
     * site. Ce n'est pas un pis-aller : publier le visage d'une personne réelle
     * sous un faux nom et un faux numéro d'inscription n'était pas envisageable,
     * et une photo de banque d'images est interdite par le cahier des charges.
     *
     * Pour un cabinet réel : posez le fichier dans `public/media/` et indiquez
     * son chemin ici. Le traitement en niveaux d'encre s'applique tout seul.
     */
    portrait: null as string | null,
    portraitAlt: 'Portrait de Camille Ferrand, expert-comptable associée du cabinet.',
    diploma: 'Diplôme d’expertise comptable (DEC)',
  },
  partner: {
    name: 'Yann Solère',
    role: 'Expert-comptable, associé — social et paie',
    number: 'n° 14 31 480',
    since: 'Inscrit depuis 2016',
  },
  statement:
    'Un expert-comptable inscrit à l’Ordre engage sa responsabilité personnelle sur les comptes qu’il signe, et son inscription est vérifiable en ligne. C’est une garantie institutionnelle, pas un argument commercial.',
  verifyLabel: 'L’inscription au tableau se vérifie sur experts-comptables.fr',
  fieldsTitle: 'Ce que nous traitons tous les jours',
  fields: [
    'Restauration et commerce de bouche',
    'Viticulture et caves particulières',
    'Artisans du bâtiment',
    'Professions libérales',
    'Commerçants et TPE de services',
  ],
  areaTitle: 'Où nous intervenons',
  towns: [
    'Sète',
    'Balaruc-les-Bains',
    'Frontignan',
    'Mèze',
    'Marseillan',
    'Bouzigues',
    'Poussan',
    'Gigean',
    'Villeveyrac',
    'Montpellier',
  ],
  areaNote: 'Deux rendez-vous par an en présentiel. Le reste à distance, quand ça vous arrange.',
}

/* ── §05 — Dossiers ───────────────────────────────────────────────────────── */

export const cases = {
  folio: '05',
  title: 'Trois dossiers',
  intro: 'Situation d’entrée, intervention, résultat. Dans cet ordre, comme une écriture.',
  items: [
    {
      sector: 'Restaurant',
      town: 'Sète',
      size: '6 salariés — 480 000 € de chiffre d’affaires',
      entry:
        'Taux de TVA à 10 % et 20 % mélangés sur la même caisse depuis l’ouverture. Deux relances de la DGFiP restées sans réponse.',
      action:
        'Reparamétrage des taux en caisse, régularisation des trois exercices encore ouverts, réclamation motivée, calendrier déclaratif tenu par le cabinet.',
      result: 'Rappel ramené à 4 200 € après réclamation, contre 11 800 € notifiés.',
      metric: { label: 'Rappel évité', value: 7600 },
      since: 'Aucune relance depuis 26 mois.',
    },
    {
      sector: 'Couvreur',
      town: 'Frontignan',
      size: '2 salariés — 310 000 € de chiffre d’affaires',
      entry:
        'Facturation avec TVA sur des chantiers réalisés en sous-traitance, où l’autoliquidation était obligatoire.',
      action:
        'Mise en conformité de la facturation, régularisation des factures de l’exercice, une demi-journée de formation au bureau, avec les documents du chantier en cours.',
      result: 'Risque de rappel éteint avant tout contrôle. Trésorerie remise à plat.',
      metric: { label: 'Risque éteint', value: 18000 },
      since: 'Article 283-2 nonies du Code général des impôts.',
    },
    {
      sector: 'Cave particulière',
      town: 'Pinet',
      size: '4 hectares — 1 salarié',
      entry:
        'Résultat en dents de scie d’une année sur l’autre. Une bonne récolte imposée plein pot, une mauvaise sans rien à déduire.',
      action:
        'Passage à la moyenne triennale, calage de la déduction pour épargne de précaution sur les deux exercices suivants.',
      result: 'Imposition lissée sur trois exercices, et une trésorerie mobilisable en année basse.',
      metric: { label: 'Impôt définitivement économisé', value: 3100 },
      since: 'Articles 73 et 75-0 B du Code général des impôts.',
    },
  ],
  disclaimer:
    'Site de démonstration : ces trois dossiers illustrent des situations courantes du secteur et ne désignent aucun client réel.',
}

/* ── §06 — Honoraires ─────────────────────────────────────────────────────── */

export const pricing = {
  folio: '06',
  title: 'Honoraires',
  intro:
    'Trois formules, trois prix, affichés. La plus complète en premier, pour que vous sachiez où s’arrête l’échelle.',
  cta: 'Prendre rendez-vous',
  recommended: 'Formule de référence',
}

/* ── §07 — Objections ─────────────────────────────────────────────────────── */

export const objections = {
  folio: '07',
  title: 'Ce que vous êtes en train de vous dire',
  intro: 'Formulé comme vous le pensez, pas comme nous aimerions l’entendre.',
  items: [
    {
      q: 'Mon comptable actuel me coûte moins cher.',
      a: 'C’est possible. Comparez la ligne complète : honoraires, plus les heures que vous y passez, plus ce qui n’est pas réclamé. Si le total reste en sa faveur, restez chez lui. Nous vous le dirons en rendez-vous, c’est arrivé.',
    },
    {
      q: 'Changer de cabinet en cours d’année, c’est compliqué.',
      a: 'Quatre étapes. Vous signez une lettre de mission. Nous écrivons à votre confrère — c’est une obligation déontologique, pas une faveur à lui demander. Il transmet le dossier. Nous reprenons la saisie au premier jour de l’exercice en cours. Délai constaté : trois semaines. Ce que ça vous coûte : une signature.',
    },
    {
      q: 'Je fais déjà tout sur un logiciel.',
      a: 'Un logiciel enregistre. Il n’arbitre pas. Il ne vous dira pas que votre rémunération est mal calibrée, il ne signera pas votre liasse, et il ne se déplacera pas si l’administration vous écrit.',
    },
    {
      q: 'Je n’ai pas le temps de m’en occuper maintenant.',
      a: 'Le bon moment est le début d’exercice. Le deuxième meilleur est aujourd’hui : la reprise se fait sur l’exercice en cours, et c’est nous qui portons les allers-retours.',
    },
    {
      q: 'Vous êtes à Sète, je suis à Montpellier.',
      a: 'Deux rendez-vous par an en présentiel, le reste à distance. Vingt-cinq minutes par l’A9, et nous nous déplaçons chez vous, pas l’inverse.',
    },
  ],
}

/* ── §08 — Rendez-vous ────────────────────────────────────────────────────── */

export const contact = {
  folio: '08',
  title: 'Solder l’écriture',
  intro:
    'Un premier rendez-vous de 45 minutes. On regarde vos chiffres, on vous dit ce qu’on ferait. Vous repartez avec, que vous signiez ou non.',
  fields: {
    name: { label: 'Votre nom', placeholder: 'Camille Ferrand' },
    activity: { label: 'Votre activité', placeholder: 'Restaurant, 6 salariés' },
    slot: { label: 'Quand êtes-vous disponible ?' },
    contactLabel: 'Téléphone ou e-mail',
    contactPlaceholder: '06 00 00 00 00',
  },
  slots: [
    'Cette semaine, le matin',
    'Cette semaine, l’après-midi',
    'La semaine prochaine',
    'Après la clôture, appelez-moi',
  ],
  submit: 'Demander le rendez-vous',
  reassurance: [
    { label: 'Premier rendez-vous sans engagement', body: 'Ni frais de dossier, ni devis payant.' },
    { label: 'La reprise, c’est notre travail', body: 'Nous écrivons au confrère et récupérons le dossier.' },
    { label: 'Réponse sous 48 heures ouvrées', body: 'Par la personne qui suivra votre dossier.' },
  ],
  capacity:
    'Nous ouvrons un nombre limité de dossiers par trimestre pour tenir ce délai de 48 heures. Quand c’est complet, nous le disons — nous ne faisons pas patienter.',
  success: {
    title: 'Écriture soldée.',
    body: 'Votre demande est enregistrée. Vous êtes rappelé sous 48 heures ouvrées par la personne qui suivra votre dossier.',
  },
  demoNotice: 'Démonstration : le formulaire ne transmet aucune donnée. Rien n’est envoyé, rien n’est stocké.',
  privacy:
    'Les informations saisies servent à vous rappeler. Elles ne sont ni revendues, ni utilisées pour autre chose.',
}

/* ── Pied de registre ─────────────────────────────────────────────────────── */

export const footer = {
  totals: { debit: 'Total débit', credit: 'Total crédit', solde: 'Solde de l’exercice' },
  legalTitle: 'Mentions',
  legal: [
    `${identity.legalName} — société d’expertise comptable inscrite au tableau de l’${identity.order}.`,
    `${identity.address.street}, ${identity.address.postalCode} ${identity.address.city} — SIREN ${identity.siren}.`,
    'Assurance de responsabilité civile professionnelle souscrite conformément à l’article 17 de l’ordonnance du 19 septembre 1945.',
  ],
  demoLine:
    'Site de démonstration réalisé par MJAGENCY. Le cabinet Ferrand & Solère est fictif : nom, numéros d’inscription, dossiers et coordonnées sont inventés pour les besoins de la démonstration.',
  credit: 'Conception et développement — MJAGENCY',
}

/* ── Réglages d'interface ─────────────────────────────────────────────────── */

export const ui = {
  cursorLabel: 'Réticule de lecture',
  cursorOn: 'Activer le réticule',
  cursorOff: 'Désactiver le réticule',
  skipLink: 'Aller au contenu',
  loading: 'Chargement de la scène',
}
