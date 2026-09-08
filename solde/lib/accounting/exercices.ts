/**
 * Banque d'exercices — programme de BTS Comptabilité et Gestion.
 *
 * Chaque exercice porte son corrigé sous forme d'écriture attendue, et une
 * explication rédigée. L'atelier ne se contente pas de dire « faux » : il dit
 * ce qui est faux et pourquoi, parce que c'est le pourquoi qu'on redemandera
 * en épreuve.
 *
 * Les montants sont en centimes, comme partout dans le moteur.
 */

import type { Cents } from './money'

export type Theme =
  | 'achats'
  | 'ventes'
  | 'reglements'
  | 'tva'
  | 'paie'
  | 'immobilisations'
  | 'regularisations'

export type Niveau = 1 | 2 | 3

export interface MouvementAttendu {
  readonly compte: string
  readonly sens: 'debit' | 'credit'
  readonly montant: Cents
}

export interface EcritureAttendue {
  readonly libelle: string
  readonly mouvements: readonly MouvementAttendu[]
}

export interface Exercice {
  readonly id: string
  readonly titre: string
  readonly theme: Theme
  readonly niveau: Niveau
  readonly enonce: string
  readonly date: string
  readonly journal: string
  /** Une ou plusieurs écritures : une cession en demande deux. */
  readonly attendu: readonly EcritureAttendue[]
  readonly corrige: string
  readonly indice?: string
}

export const THEMES: Record<Theme, string> = {
  achats: 'Achats',
  ventes: 'Ventes',
  reglements: 'Règlements',
  tva: 'TVA',
  paie: 'Paie',
  immobilisations: 'Immobilisations',
  regularisations: 'Régularisations',
}

const d = (compte: string, montant: Cents): MouvementAttendu => ({ compte, sens: 'debit', montant })
const c = (compte: string, montant: Cents): MouvementAttendu => ({ compte, sens: 'credit', montant })

export const EXERCICES: readonly Exercice[] = [
  {
    id: 'ach-1',
    titre: 'Achat de marchandises à crédit',
    theme: 'achats',
    niveau: 1,
    date: '2025-03-04',
    journal: 'AC',
    enonce:
      'Le 4 mars, l’entreprise reçoit la facture n° 412 du fournisseur Delmas : marchandises pour 1 200 € HT, TVA au taux normal. Règlement à 30 jours.',
    attendu: [
      {
        libelle: 'Facture Delmas n° 412',
        mouvements: [d('607000', 120_000), d('445660', 24_000), c('401000', 144_000)],
      },
    ],
    corrige:
      'La marchandise est achetée pour être revendue : compte 607. La TVA payée au fournisseur est récupérable auprès de l’État, c’est une créance : elle se DÉBITE en 445660. Le fournisseur n’étant pas payé, on constate une dette pour le montant TTC : 401 au crédit, 1 440 €.',
    indice: 'La TVA se calcule sur le HT : 1 200 × 20 % = 240 €.',
  },
  {
    id: 'ach-2',
    titre: 'Facture avec remise',
    theme: 'achats',
    niveau: 2,
    date: '2025-03-11',
    journal: 'AC',
    enonce:
      'Le 11 mars, réception de la facture n° 87 : marchandises pour 2 000 € HT, sur lesquelles le fournisseur accorde une remise de 10 % figurant sur la facture. TVA au taux normal, règlement à crédit.',
    attendu: [
      {
        libelle: 'Facture n° 87',
        mouvements: [d('607000', 180_000), d('445660', 36_000), c('401000', 216_000)],
      },
    ],
    corrige:
      'Une réduction qui figure SUR la facture ne se comptabilise pas : on enregistre directement le net commercial, soit 2 000 − 200 = 1 800 € HT. La TVA se calcule sur ce net : 360 €. Seule une réduction accordée APRÈS la facture (avoir) passerait par le compte 609.',
    indice: 'Aucun compte de remise n’apparaît dans cette écriture.',
  },
  {
    id: 'ach-3',
    titre: 'Achat avec frais de port',
    theme: 'achats',
    niveau: 2,
    date: '2025-03-18',
    journal: 'AC',
    enonce:
      'Le 18 mars, facture fournisseur comprenant des marchandises pour 800 € HT et des frais de port facturés par le transporteur pour 50 € HT. TVA au taux normal sur l’ensemble, à crédit.',
    attendu: [
      {
        libelle: 'Achat et transport',
        mouvements: [d('607000', 80_000), d('624100', 5_000), d('445660', 17_000), c('401000', 102_000)],
      },
    ],
    corrige:
      'Le port facturé par un transporteur est un service distinct : compte 6241, Transports sur achats. La TVA porte sur l’ensemble : (800 + 50) × 20 % = 170 €. La dette totale est de 1 020 € TTC.',
  },
  {
    id: 'ach-4',
    titre: 'Prime d’assurance',
    theme: 'achats',
    niveau: 1,
    date: '2025-04-02',
    journal: 'BQ',
    enonce:
      'Le 2 avril, la compagnie d’assurance prélève sur le compte bancaire la prime annuelle d’assurance incendie du local commercial : 480 €. Enregistrer l’opération.',
    attendu: [
      { libelle: 'Assurance incendie', mouvements: [d('616000', 48_000), c('512000', 48_000)] },
    ],
    corrige:
      'Les opérations d’assurance sont EXONÉRÉES de TVA (art. 261 C du CGI). Il n’y a donc aucune TVA à récupérer : l’écriture ne comporte que deux lignes. C’est le piège classique de l’épreuve — on est tenté de reconstituer une TVA qui n’existe pas.',
    indice: 'Combien de lignes cette écriture comporte-t-elle ?',
  },
  {
    id: 'ach-5',
    titre: 'Achat de timbres',
    theme: 'achats',
    niveau: 1,
    date: '2025-04-05',
    journal: 'CA',
    enonce:
      'Le 5 avril, l’entreprise achète pour 60 € de timbres postaux au bureau de poste et les règle immédiatement en espèces. Enregistrer l’opération au journal de caisse.',
    attendu: [{ libelle: 'Achat de timbres', mouvements: [d('626000', 6_000), c('530000', 6_000)] }],
    corrige:
      'Les envois postaux relevant du service universel sont exonérés de TVA : pas de 445660 ici. Le paiement en espèces crédite la caisse, compte 530. Attention : le solde d’une caisse ne peut jamais être créditeur.',
  },
  {
    id: 'ven-1',
    titre: 'Vente de marchandises',
    theme: 'ventes',
    niveau: 1,
    date: '2025-03-20',
    journal: 'VE',
    enonce:
      'Facture n° F-2025-118 au client Rivière : marchandises 3 000 € HT, TVA 20 %, payable à 30 jours.',
    attendu: [
      {
        libelle: 'Facture F-2025-118 — Rivière',
        mouvements: [d('411000', 360_000), c('707000', 300_000), c('445711', 60_000)],
      },
    ],
    corrige:
      'Miroir de l’achat. La créance sur le client est débitée pour le TTC (3 600 €). Le produit est crédité pour le HT. La TVA collectée est encaissée pour le compte de l’État : c’est une dette, donc au crédit du 445711.',
  },
  {
    id: 'ven-2',
    titre: 'Prestation de services',
    theme: 'ventes',
    niveau: 2,
    date: '2025-04-15',
    journal: 'VE',
    enonce:
      'Le 15 avril, l’entreprise facture au client Novéa une mission de conseil de 2 500 € HT, TVA au taux normal, payable à 30 jours. Enregistrer la facture.',
    attendu: [
      {
        libelle: 'Mission de conseil',
        mouvements: [d('411000', 300_000), c('706000', 250_000), c('445711', 50_000)],
      },
    ],
    corrige:
      'Une prestation de services se crédite en 706, jamais en 707 qui est réservé aux marchandises. À retenir pour la déclaration : sur les prestations, la TVA est exigible à l’ENCAISSEMENT et non à la facturation — sauf option pour les débits.',
  },
  {
    id: 'reg-1',
    titre: 'Règlement d’un fournisseur',
    theme: 'reglements',
    niveau: 1,
    date: '2025-04-03',
    journal: 'BQ',
    enonce: 'Virement au fournisseur Delmas pour solde de la facture n° 412 : 1 440 €.',
    attendu: [
      { libelle: 'Virement Delmas', mouvements: [d('401000', 144_000), c('512000', 144_000)] },
    ],
    corrige:
      'Le règlement solde la dette : on débite le 401 pour l’annuler, et on crédite la banque qui diminue. Aucune TVA n’apparaît : elle a déjà été enregistrée lors de la facture.',
    indice: 'La TVA a-t-elle sa place dans une écriture de règlement ?',
  },
  {
    id: 'reg-2',
    titre: 'Encaissement d’un client',
    theme: 'reglements',
    niveau: 1,
    date: '2025-04-20',
    journal: 'BQ',
    enonce:
      'Le 20 avril, l’extrait bancaire fait apparaître un virement reçu du client Rivière pour 3 600 €, en règlement de la facture F-2025-118. Enregistrer l’encaissement.',
    attendu: [
      { libelle: 'Virement Rivière', mouvements: [d('512000', 360_000), c('411000', 360_000)] },
    ],
    corrige:
      'La banque augmente donc elle se débite ; la créance disparaît donc le 411 se crédite. C’est la contrepartie exacte de la facture de vente.',
  },
  {
    id: 'imm-1',
    titre: 'Acquisition d’une immobilisation',
    theme: 'immobilisations',
    niveau: 2,
    date: '2025-02-17',
    journal: 'AC',
    enonce:
      'Le 17 février, l’entreprise acquiert un poste informatique pour 1 500 € HT, TVA au taux normal, réglable à 60 jours. La durée d’utilisation prévue est de trois ans. Enregistrer l’acquisition.',
    attendu: [
      {
        libelle: 'Poste informatique',
        mouvements: [d('218300', 150_000), d('445620', 30_000), c('404000', 180_000)],
      },
    ],
    corrige:
      'Deux pièges dans la même écriture. Un : la TVA d’une immobilisation va en 445620, pas en 445660 — elle se déclare en case 19 de la CA3. Deux : la dette née d’un achat d’immobilisation se met en 404, Fournisseurs d’immobilisations, et non en 401.',
    indice: 'Ni 445660 ni 401 n’ont leur place ici.',
  },
  {
    id: 'imm-2',
    titre: 'Dotation aux amortissements',
    theme: 'immobilisations',
    niveau: 2,
    date: '2025-12-31',
    journal: 'OD',
    enonce:
      'Au 31 décembre, matériel informatique acquis 6 000 € HT, amorti en linéaire sur 5 ans. Passer la dotation de l’exercice, année pleine.',
    attendu: [
      {
        libelle: 'Dotation aux amortissements',
        mouvements: [d('681120', 120_000), c('281830', 120_000)],
      },
    ],
    corrige:
      '6 000 / 5 = 1 200 € par an. La charge se débite en 681. La contrepartie se crédite en 28 — jamais au crédit du compte d’immobilisation lui-même, qui doit rester à sa valeur brute au bilan. C’est ce qui permet de présenter l’actif en brut, amortissements, net.',
  },
  {
    id: 'imm-3',
    titre: 'Cession d’une immobilisation',
    theme: 'immobilisations',
    niveau: 3,
    date: '2025-09-30',
    journal: 'OD',
    enonce:
      'Cession d’un matériel acquis 6 000 € HT, amorti pour 4 800 € au jour de la vente. Prix de cession : 1 500 € HT, TVA 20 %, à encaisser. Passer les DEUX écritures.',
    attendu: [
      {
        libelle: 'Prix de cession',
        mouvements: [d('462000', 180_000), c('775000', 150_000), c('445711', 30_000)],
      },
      {
        libelle: 'Sortie du bien de l’actif',
        mouvements: [d('281830', 480_000), d('675000', 120_000), c('218300', 600_000)],
      },
    ],
    corrige:
      'Une cession se décompose toujours en deux écritures. La première constate le PRIX : créance en 462 pour le TTC, produit exceptionnel en 775 pour le HT, TVA collectée en 445711. La seconde SORT le bien de l’actif : on solde les amortissements (281 au débit), on constate la valeur nette restante en 675 (6 000 − 4 800 = 1 200), et on crédite le compte d’immobilisation pour sa valeur brute. La plus-value, 1 500 − 1 200 = 300 €, apparaît d’elle-même au résultat.',
    indice: 'Deux écritures : le prix d’abord, la sortie du bien ensuite.',
  },
  {
    id: 'pai-1',
    titre: 'Écriture de paie',
    theme: 'paie',
    niveau: 3,
    date: '2025-05-31',
    journal: 'OD',
    enonce:
      'Paie du mois : salaires bruts 3 000 €, cotisations salariales 600 €, cotisations patronales 1 200 €. Enregistrer la paie (hors versement).',
    attendu: [
      {
        libelle: 'Paie du mois',
        mouvements: [
          d('641100', 300_000),
          d('645100', 120_000),
          c('421000', 240_000),
          c('431000', 180_000),
        ],
      },
    ],
    corrige:
      'On débite le BRUT en 641, jamais le net. La part patronale est une charge supplémentaire pour l’entreprise : 645 au débit. Le net à payer au salarié (3 000 − 600 = 2 400) se crédite en 421. Les organismes sociaux reçoivent la somme des deux parts (600 + 1 200 = 1 800) : 431 au crédit. La part salariale n’est pas une charge — elle est retenue sur le brut, elle ne s’ajoute pas.',
    indice: 'Charge de l’entreprise = brut + part patronale. Le reste n’est que ventilation.',
  },
  {
    id: 'tva-1',
    titre: 'Déclaration de TVA',
    theme: 'tva',
    niveau: 2,
    date: '2025-04-30',
    journal: 'OD',
    enonce:
      'Au 30 avril, la TVA collectée du mois s’élève à 4 200 €, la TVA déductible sur biens et services à 1 500 €, la TVA déductible sur immobilisations à 300 €. Établir l’écriture de déclaration.',
    attendu: [
      {
        libelle: 'Déclaration de TVA d’avril',
        mouvements: [
          d('445711', 420_000),
          c('445660', 150_000),
          c('445620', 30_000),
          c('445510', 240_000),
        ],
      },
    ],
    corrige:
      'On solde les comptes de TVA du mois : la collectée était créditrice, on la débite ; les déductibles étaient débitrices, on les crédite. Le solde, 4 200 − 1 500 − 300 = 2 400 €, est ce que l’entreprise doit à l’État : compte 445510, TVA à décaisser, au crédit. Si les déductibles avaient dépassé la collectée, on aurait constaté un crédit de TVA en 445670, au débit.',
  },
  {
    id: 'reg-3',
    titre: 'Client douteux et dépréciation',
    theme: 'regularisations',
    niveau: 3,
    date: '2025-12-31',
    journal: 'OD',
    enonce:
      'Le client Marchand doit 2 400 € TTC (2 000 € HT). Au 31 décembre, on estime le risque de non-recouvrement à 40 %. Passer les DEUX écritures.',
    attendu: [
      {
        libelle: 'Transfert en client douteux',
        mouvements: [d('416000', 240_000), c('411000', 240_000)],
      },
      {
        libelle: 'Dépréciation de la créance',
        mouvements: [d('681740', 80_000), c('491000', 80_000)],
      },
    ],
    corrige:
      'D’abord on isole la créance : elle quitte le 411 pour le 416, pour son montant TTC. Ensuite on constate le risque : la dépréciation se calcule sur le montant HORS TAXE, car la TVA sera récupérée si la créance devient irrécouvrable. 2 000 × 40 % = 800 €. Calculer sur le TTC est l’erreur la plus fréquente de cet exercice.',
    indice: 'Sur quelle base calcule-t-on une dépréciation : HT ou TTC ?',
  },
  {
    id: 'reg-4',
    titre: 'Charge constatée d’avance',
    theme: 'regularisations',
    niveau: 3,
    date: '2025-12-31',
    journal: 'OD',
    enonce:
      'Une prime d’assurance de 1 200 € a été payée le 1er octobre et couvre les douze mois suivants. À la clôture du 31 décembre, régulariser la part qui concerne l’exercice suivant.',
    attendu: [
      {
        libelle: 'Charge constatée d’avance — assurance',
        mouvements: [d('486000', 90_000), c('616000', 90_000)],
      },
    ],
    corrige:
      'Sur les douze mois couverts, trois seulement concernent l’exercice (octobre à décembre). Les neuf autres appartiennent à N+1 : 1 200 × 9/12 = 900 €. On les sort du résultat en créditant la charge, et on les porte à l’actif en 486. Le principe est celui de l’indépendance des exercices : chaque exercice supporte ses charges, pas celles du suivant.',
    indice: 'Combien de mois de cette prime concernent l’exercice suivant ?',
  },
  {
    id: 'reg-5',
    titre: 'Échéance d’emprunt',
    theme: 'reglements',
    niveau: 2,
    date: '2025-06-30',
    journal: 'BQ',
    enonce:
      'Le 30 juin, la banque prélève l’échéance semestrielle de l’emprunt : 5 000 € au total, dont 800 € d’intérêts et le reste en remboursement du capital.',
    attendu: [
      {
        libelle: 'Échéance d’emprunt',
        mouvements: [d('164000', 420_000), d('661100', 80_000), c('512000', 500_000)],
      },
    ],
    corrige:
      'Seuls les intérêts sont une charge : 800 € en 661. Le remboursement du capital, 4 200 €, n’appauvrit pas l’entreprise — il diminue une dette : on débite le 164. Passer l’annuité entière en charge est une erreur qui fausse à la fois le résultat et le bilan.',
    indice: 'Le remboursement du capital est-il une charge ?',
  },
]

// ── Correction ──────────────────────────────────────────────────────────────

export interface MouvementSaisi {
  readonly compte: string
  readonly debit: Cents
  readonly credit: Cents
}

export type EcartCode =
  | 'compte_absent'
  | 'compte_en_trop'
  | 'sens_inverse'
  | 'montant_faux'
  | 'desequilibre'

export interface Ecart {
  readonly code: EcartCode
  readonly compte: string
  readonly message: string
}

export interface Correction {
  readonly juste: boolean
  readonly ecarts: readonly Ecart[]
  /** Part de mouvements exacts, en pourcentage. */
  readonly score: number
}

function cle(compte: string, sens: 'debit' | 'credit'): string {
  return `${compte}|${sens}`
}

/**
 * Compare une écriture saisie à l'écriture attendue.
 *
 * La correction ne dit pas seulement « faux » : elle distingue le compte
 * oublié, le compte en trop, le sens inversé et le montant erroné — ce sont
 * quatre erreurs différentes, qui appellent quatre explications différentes.
 */
export function corriger(
  saisie: readonly MouvementSaisi[],
  attendu: EcritureAttendue,
): Correction {
  const ecarts: Ecart[] = []

  const mouvementsSaisis = saisie
    .filter((mouvement) => mouvement.debit > 0 || mouvement.credit > 0)
    .map((mouvement) => ({
      compte: mouvement.compte,
      sens: mouvement.debit > 0 ? ('debit' as const) : ('credit' as const),
      montant: mouvement.debit > 0 ? mouvement.debit : mouvement.credit,
    }))

  const totalDebit = saisie.reduce((total, mouvement) => total + mouvement.debit, 0)
  const totalCredit = saisie.reduce((total, mouvement) => total + mouvement.credit, 0)
  if (totalDebit !== totalCredit) {
    ecarts.push({
      code: 'desequilibre',
      compte: '',
      message: `L’écriture n’est pas équilibrée : ${(totalDebit - totalCredit) / 100} € d’écart.`,
    })
  }

  const parCle = new Map(mouvementsSaisis.map((mouvement) => [cle(mouvement.compte, mouvement.sens), mouvement]))
  const attendues = new Set(attendu.mouvements.map((mouvement) => cle(mouvement.compte, mouvement.sens)))
  let exacts = 0

  for (const cible of attendu.mouvements) {
    const trouve = parCle.get(cle(cible.compte, cible.sens))
    if (trouve) {
      if (trouve.montant === cible.montant) {
        exacts += 1
      } else {
        ecarts.push({
          code: 'montant_faux',
          compte: cible.compte,
          message: `Compte ${cible.compte} : ${trouve.montant / 100} € au lieu de ${cible.montant / 100} €.`,
        })
      }
      continue
    }

    const sensInverse = parCle.get(cle(cible.compte, cible.sens === 'debit' ? 'credit' : 'debit'))
    if (sensInverse) {
      ecarts.push({
        code: 'sens_inverse',
        compte: cible.compte,
        message: `Compte ${cible.compte} : il devait être au ${cible.sens === 'debit' ? 'débit' : 'crédit'}, il est au ${cible.sens === 'debit' ? 'crédit' : 'débit'}.`,
      })
      continue
    }

    ecarts.push({
      code: 'compte_absent',
      compte: cible.compte,
      message: `Le compte ${cible.compte} manque.`,
    })
  }

  for (const mouvement of mouvementsSaisis) {
    const cleSaisie = cle(mouvement.compte, mouvement.sens)
    const cleInverse = cle(mouvement.compte, mouvement.sens === 'debit' ? 'credit' : 'debit')
    if (!attendues.has(cleSaisie) && !attendues.has(cleInverse)) {
      ecarts.push({
        code: 'compte_en_trop',
        compte: mouvement.compte,
        message: `Le compte ${mouvement.compte} n’a rien à faire dans cette écriture.`,
      })
    }
  }

  return {
    juste: ecarts.length === 0,
    ecarts,
    score: attendu.mouvements.length === 0 ? 0 : Math.round((exacts / attendu.mouvements.length) * 100),
  }
}

export function parTheme(theme: Theme): readonly Exercice[] {
  return EXERCICES.filter((exercice) => exercice.theme === theme)
}
