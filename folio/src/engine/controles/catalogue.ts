import { formatMontant, type Centimes, type PointsDeBase } from '../core/montant'
import { formatDateFr } from '../core/dates'
import { formatTaux } from '../referentiel/tva'
import { trouverCompte } from '../referentiel/plan-comptable'
import { familleDe, type CodeEcart, type FamilleEcart, type Gravite } from './codes'

export interface DetailsEcart {
  /** Index de la ligne d'écriture concernée, à partir de 0. */
  ligne?: number
  compteConstate?: string
  compteAttendu?: string
  montantConstate?: Centimes
  montantAttendu?: Centimes
  tauxConstate?: PointsDeBase
  tauxAttendu?: PointsDeBase
  journalConstate?: string
  journalAttendu?: string
  date?: string
  dateAttendue?: string
  exerciceDebut?: string
  exerciceFin?: string
  numeroPiece?: string
  /** Complément rédigé à l'avance par l'auteur du dossier. */
  precision?: string
}

export interface Ecart extends DetailsEcart {
  code: CodeEcart
  famille: FamilleEcart
  gravite: Gravite
  /** Explication déterministe. C'est elle qui s'affiche si l'IA n'est pas là. */
  explication: string
}

interface FicheEcart {
  gravite: Gravite
  titre: string
  redaction: (d: DetailsEcart) => string
}

const nomCompte = (numero?: string): string => {
  if (!numero) return 'le compte'
  const compte = trouverCompte(numero)
  return compte ? `${numero} ${compte.libelle}` : numero
}

const euro = (montant?: Centimes): string =>
  montant === undefined ? '—' : `${formatMontant(montant)} €`

const CATALOGUE: Record<CodeEcart, FicheEcart> = {
  // ---- Structure -----------------------------------------------------------
  STRUCT_DESEQUILIBRE: {
    gravite: 'bloquant',
    titre: 'Écriture déséquilibrée',
    redaction: (d) =>
      `Le total du débit et le total du crédit diffèrent de ${euro(d.montantConstate)}. ` +
      `Une écriture ne s’enregistre qu’équilibrée : reprenez la ligne dont le montant est incomplet.`,
  },
  STRUCT_ECRITURE_VIDE: {
    gravite: 'bloquant',
    titre: 'Écriture sans ligne',
    redaction: () => `L’écriture ne comporte aucune ligne. Une écriture comporte au moins deux lignes.`,
  },
  STRUCT_LIGNE_SANS_MONTANT: {
    gravite: 'bloquant',
    titre: 'Ligne sans montant',
    redaction: (d) =>
      `La ligne ${(d.ligne ?? 0) + 1} porte le compte ${nomCompte(d.compteConstate)} sans montant. ` +
      `Portez le montant au débit ou au crédit, ou supprimez la ligne.`,
  },
  STRUCT_LIGNE_DEBIT_ET_CREDIT: {
    gravite: 'bloquant',
    titre: 'Ligne mouvementée deux fois',
    redaction: (d) =>
      `La ligne ${(d.ligne ?? 0) + 1} porte un montant au débit et au crédit. ` +
      `Une ligne d’écriture ne se meut que dans un seul sens ; scindez-la en deux lignes.`,
  },
  STRUCT_MONTANT_NEGATIF: {
    gravite: 'bloquant',
    titre: 'Montant négatif',
    redaction: (d) =>
      `La ligne ${(d.ligne ?? 0) + 1} porte un montant négatif. ` +
      `Une contrepassation se passe en inversant le sens, jamais en portant un montant négatif.`,
  },
  STRUCT_COMPTE_INEXISTANT: {
    gravite: 'bloquant',
    titre: 'Compte absent du plan comptable',
    redaction: (d) =>
      `Le compte ${d.compteConstate ?? ''} ne figure pas au plan comptable du dossier. ` +
      `Cherchez le compte par son libellé avec la touche « / ».`,
  },
  STRUCT_JOURNAL_INCOHERENT: {
    gravite: 'majeur',
    titre: 'Journal incohérent',
    redaction: (d) =>
      `L’écriture est passée au journal ${d.journalConstate ?? ''} alors que sa nature relève du journal ` +
      `${d.journalAttendu ?? ''}. ${d.precision ?? 'Le journal détermine la présentation du livre-journal et le contrôle de caisse.'}`,
  },
  STRUCT_DATE_HORS_EXERCICE: {
    gravite: 'bloquant',
    titre: 'Date hors exercice',
    redaction: (d) =>
      `La date du ${d.date ? formatDateFr(d.date) : ''} est en dehors de l’exercice ` +
      `${d.exerciceDebut ? formatDateFr(d.exerciceDebut) : ''} – ${d.exerciceFin ? formatDateFr(d.exerciceFin) : ''}. ` +
      `Une opération relevant de l’exercice suivant se régularise à l’inventaire, elle ne se date pas hors exercice.`,
  },
  STRUCT_DATE_INVALIDE: {
    gravite: 'bloquant',
    titre: 'Date inexploitable',
    redaction: (d) => `La date « ${d.date ?? ''} » n’est pas une date valide. Attendu : JJ/MM/AAAA.`,
  },
  STRUCT_DATE_ERRONEE: {
    gravite: 'majeur',
    titre: 'Date erronée',
    redaction: (d) =>
      `L’écriture est datée du ${d.date ? formatDateFr(d.date) : ''} alors que l’opération date du ` +
      `${d.dateAttendue ? formatDateFr(d.dateAttendue) : ''}. L’écriture prend la date de la pièce, pas celle de la saisie.`,
  },
  STRUCT_PIECE_MANQUANTE: {
    gravite: 'majeur',
    titre: 'Numéro de pièce absent',
    redaction: () =>
      `L’écriture n’a pas de numéro de pièce. Toute écriture s’appuie sur une pièce justificative référencée ; ` +
      `le fichier des écritures comptables l’exige.`,
  },
  STRUCT_PIECE_DOUBLON: {
    gravite: 'majeur',
    titre: 'Pièce déjà comptabilisée',
    redaction: (d) =>
      `La pièce ${d.numeroPiece ?? ''} est déjà enregistrée dans le journal ${d.journalConstate ?? ''}. ` +
      `Vérifiez avant de saisir une seconde fois : une facture comptabilisée deux fois double la charge et la TVA déductible.`,
  },

  // ---- Sens et affectation -------------------------------------------------
  SENS_INVERSE: {
    gravite: 'majeur',
    titre: 'Sens inversé',
    redaction: (d) =>
      `Le compte ${nomCompte(d.compteConstate)} est porté ${d.montantConstate !== undefined && d.montantConstate < 0 ? 'au crédit' : 'dans le mauvais sens'} ` +
      `alors qu’il doit être mouvementé en sens inverse pour cette opération. ${d.precision ?? ''}`.trim(),
  },
  SENS_CONFUSION_BILAN_GESTION: {
    gravite: 'majeur',
    titre: 'Compte de bilan employé pour un compte de gestion',
    redaction: (d) =>
      `Le compte ${nomCompte(d.compteConstate)} est un compte de ${d.precision ?? 'bilan'}, ` +
      `or l’opération relève d’un compte de ${d.compteAttendu ? 'gestion' : 'gestion'}. Le compte attendu est le ${nomCompte(d.compteAttendu)}.`,
  },
  SENS_CONFUSION_401_404: {
    gravite: 'majeur',
    titre: 'Fournisseur d’exploitation et fournisseur d’immobilisations confondus',
    redaction: (d) =>
      `La dette est portée en ${nomCompte(d.compteConstate)} alors que la facture porte sur ` +
      `${d.compteAttendu === '404' ? 'une immobilisation' : 'un achat d’exploitation'}. Le compte attendu est le ${d.compteAttendu ?? ''}.`,
  },
  SENS_CONFUSION_411_462: {
    gravite: 'majeur',
    titre: 'Client et créance sur cession confondus',
    redaction: (d) =>
      `La créance est portée en ${nomCompte(d.compteConstate)} alors qu’elle naît ` +
      `${d.compteAttendu === '462' ? 'de la cession d’une immobilisation' : 'd’une vente relevant de l’exploitation'}. ` +
      `Le compte attendu est le ${d.compteAttendu ?? ''}.`,
  },
  SENS_CONFUSION_CHARGE_IMMOBILISATION: {
    gravite: 'majeur',
    titre: 'Charge et immobilisation confondues',
    redaction: (d) =>
      `Le bien est enregistré en ${nomCompte(d.compteConstate)} alors qu’il ` +
      `${d.compteAttendu?.startsWith('2') ? 'constitue une immobilisation, destinée à servir durablement' : 'se consomme dans l’exercice et constitue une charge'}. ` +
      `Le compte attendu est le ${nomCompte(d.compteAttendu)}.`,
  },
  SENS_CLASSE_VOISINE: {
    gravite: 'majeur',
    titre: 'Compte de classe voisine',
    redaction: (d) =>
      `Le compte ${nomCompte(d.compteConstate)} appartient à une classe voisine du compte attendu. ` +
      `Le compte attendu est le ${nomCompte(d.compteAttendu)}.`,
  },

  // ---- TVA ------------------------------------------------------------------
  TVA_CONFUSION_44566_44562: {
    gravite: 'majeur',
    titre: 'TVA déductible mal ventilée',
    redaction: (d) =>
      d.compteAttendu === '44562'
        ? `TVA déductible portée en 44566 alors que la facture concerne une immobilisation. Le compte attendu est le 44562.`
        : `TVA déductible portée en 44562 alors que la facture concerne un bien ou un service consommé dans l’exercice. Le compte attendu est le 44566.`,
  },
  TVA_CONFUSION_44571_44551: {
    gravite: 'majeur',
    titre: 'TVA collectée et TVA à décaisser confondues',
    redaction: (d) =>
      d.compteAttendu === '44571'
        ? `La TVA facturée au client se porte en 44571 TVA collectée. Le compte 44551 n’apparaît qu’à la déclaration, quand la TVA collectée est soldée.`
        : `Le solde à payer au Trésor se porte en 44551 TVA à décaisser. Le compte 44571 est soldé par la déclaration.`,
  },
  TVA_TAUX_NON_CONFORME: {
    gravite: 'majeur',
    titre: 'Taux de TVA non conforme',
    redaction: (d) =>
      `La TVA est calculée au taux de ${d.tauxConstate !== undefined ? formatTaux(d.tauxConstate) : '—'} ` +
      `alors que la nature du bien relève du taux de ${d.tauxAttendu !== undefined ? formatTaux(d.tauxAttendu) : '—'}. ` +
      `${d.precision ?? ''}`.trim(),
  },
  TVA_BASE_ERRONEE: {
    gravite: 'majeur',
    titre: 'Base de TVA erronée',
    redaction: (d) =>
      `La TVA est calculée sur ${euro(d.montantConstate)} alors que la base imposable s’élève à ${euro(d.montantAttendu)}. ` +
      `${d.precision ?? 'La base est le net commercial, réductions déduites, port taxable compris.'}`,
  },
  TVA_ARRONDI_NON_CONFORME: {
    gravite: 'mineur',
    titre: 'Arrondi de TVA non conforme',
    redaction: (d) =>
      `La TVA portée est de ${euro(d.montantConstate)} alors que le calcul donne ${euro(d.montantAttendu)}. ` +
      `La TVA s’arrondit au centime le plus proche, une seule fois, sur le total de la base à ce taux.`,
  },
  TVA_OMISE: {
    gravite: 'majeur',
    titre: 'TVA absente',
    redaction: (d) =>
      `Aucune ligne de TVA ne figure dans l’écriture alors que la pièce porte ${euro(d.montantAttendu)} de TVA. ` +
      `Le compte attendu est le ${nomCompte(d.compteAttendu)}.`,
  },

  // ---- Montants -------------------------------------------------------------
  MT_CONFUSION_HT_TTC: {
    gravite: 'majeur',
    titre: 'Hors taxes et toutes taxes confondus',
    redaction: (d) =>
      (d.montantConstate ?? 0) > (d.montantAttendu ?? 0)
        ? `Le compte ${nomCompte(d.compteConstate)} est mouvementé pour ${euro(d.montantConstate)}, montant toutes taxes comprises, ` +
          `alors qu’il reçoit le montant hors taxes de ${euro(d.montantAttendu)}. Seuls les comptes de tiers et de trésorerie reçoivent le montant toutes taxes.`
        : `Le compte ${nomCompte(d.compteConstate)} est mouvementé pour ${euro(d.montantConstate)}, montant hors taxes, ` +
          `alors qu’il reçoit le montant toutes taxes comprises de ${euro(d.montantAttendu)}. La dette envers le fournisseur et la créance sur le client sont toujours toutes taxes comprises.`,
  },
  MT_ESCOMPTE: {
    gravite: 'majeur',
    titre: 'Escompte de règlement mal traité',
    redaction: (d) =>
      `L’escompte${d.montantAttendu !== undefined ? ` de ${euro(d.montantAttendu)}` : ''} n’est pas enregistré comme il doit l’être. ` +
      `Il constitue un produit financier au compte 765 chez l’acheteur, une charge financière au compte 665 chez le vendeur. ` +
      `Accordé sur la facture, il diminue la base de la TVA.`,
  },
  MT_REMISE: {
    gravite: 'majeur',
    titre: 'Réduction commerciale mal traitée',
    redaction: (d) =>
      `Remise, rabais et ristourne figurant sur la facture initiale ne se comptabilisent pas séparément : ils réduisent directement l’achat ou la vente. ` +
      `${d.montantAttendu !== undefined ? `Le net commercial attendu est de ${euro(d.montantAttendu)}.` : ''}`,
  },
  MT_PORT: {
    gravite: 'majeur',
    titre: 'Port mal traité',
    redaction: (d) =>
      `Le port${d.montantAttendu !== undefined ? ` de ${euro(d.montantAttendu)}` : ''} n’est pas enregistré au compte attendu ${nomCompte(d.compteAttendu)}. ` +
      `Le port facturé par le fournisseur se porte au compte 6241 chez l’acheteur ; refacturé au client, il se porte au compte 7085. Dans les deux cas il supporte la TVA du bien transporté.`,
  },
  MT_EMBALLAGES_CONSIGNES: {
    gravite: 'majeur',
    titre: 'Emballages consignés mal traités',
    redaction: (d) =>
      `La consignation${d.montantAttendu !== undefined ? ` de ${euro(d.montantAttendu)}` : ''} se porte au compte ${nomCompte(d.compteAttendu)} et reste hors du champ de la TVA. ` +
      `Elle n’est ni un achat ni une vente tant que les emballages peuvent être rendus.`,
  },
  MT_ECART_ARRONDI: {
    gravite: 'mineur',
    titre: 'Écart d’arrondi',
    redaction: (d) =>
      `Le montant porté s’écarte de ${euro(d.montantConstate)} du montant attendu ${euro(d.montantAttendu)}. ` +
      `L’écart tient à l’arrondi : arrondissez une seule fois, au centime, sur le total et non sur chaque ligne.`,
  },
  MT_MONTANT_ERRONE: {
    gravite: 'majeur',
    titre: 'Montant erroné',
    redaction: (d) =>
      `Le compte ${nomCompte(d.compteConstate)} est mouvementé pour ${euro(d.montantConstate)} au lieu de ${euro(d.montantAttendu)}. ` +
      `${d.precision ?? ''}`.trim(),
  },

  // ---- Inventaire ------------------------------------------------------------
  INV_BASE_AMORTISSABLE: {
    gravite: 'majeur',
    titre: 'Base amortissable erronée',
    redaction: (d) =>
      `L’amortissement est calculé sur ${euro(d.montantConstate)} alors que la base amortissable s’élève à ${euro(d.montantAttendu)}. ` +
      `${d.precision ?? 'La base amortissable est la valeur d’origine hors taxes déductible, diminuée de la valeur résiduelle prévue.'}`,
  },
  INV_PRORATA_TEMPORIS: {
    gravite: 'majeur',
    titre: 'Prorata temporis mal calculé',
    redaction: (d) =>
      `La dotation portée est de ${euro(d.montantConstate)} au lieu de ${euro(d.montantAttendu)}. ` +
      `${d.precision ?? 'En linéaire, la première annuité court de la date de mise en service à la clôture, en jours, sur une année de 360 jours. En dégressif, elle court en mois entiers depuis le premier jour du mois d’acquisition.'}`,
  },
  INV_DEPRECIATION_SUR_BRUT: {
    gravite: 'majeur',
    titre: 'Dépréciation calculée sur la valeur brute',
    redaction: (d) =>
      `La dépréciation est calculée sur la valeur brute ${euro(d.montantConstate)} alors qu’elle porte sur la valeur nette comptable ${euro(d.montantAttendu)}. ` +
      `La dépréciation constate la perte de valeur qui s’ajoute à l’amortissement déjà pratiqué.`,
  },
  INV_RATTACHEMENT_EXERCICE: {
    gravite: 'majeur',
    titre: 'Rattachement au mauvais exercice',
    redaction: (d) =>
      `La charge ou le produit du ${d.date ? formatDateFr(d.date) : ''} est rattaché à l’exercice qui se clôt le ` +
      `${d.exerciceFin ? formatDateFr(d.exerciceFin) : ''} alors qu’il concerne l’autre exercice. ` +
      `${d.precision ?? 'Employez les comptes 486 et 487 pour les régularisations, 408 et 418 pour les factures non parvenues et non établies.'}`,
  },

  // ---- Cohérence globale du dossier ------------------------------------------
  GLOB_COMPTE_ATTENTE_NON_SOLDE: {
    gravite: 'majeur',
    titre: 'Compte d’attente non soldé',
    redaction: (d) =>
      `Le compte ${nomCompte(d.compteConstate)} présente un solde de ${euro(d.montantConstate)} à la clôture. ` +
      `Un compte d’attente se solde avant l’établissement des comptes annuels : identifiez l’opération et affectez-la à son compte définitif.`,
  },
  GLOB_BALANCE_DESEQUILIBREE: {
    gravite: 'bloquant',
    titre: 'Balance déséquilibrée',
    redaction: (d) =>
      `La balance présente un écart de ${euro(d.montantConstate)} entre le total des débits et le total des crédits. ` +
      `Une écriture a été enregistrée déséquilibrée : reprenez le journal général à la date où l’écart apparaît.`,
  },
  GLOB_TIERS_SOLDE_NON_LETTRE: {
    gravite: 'mineur',
    titre: 'Compte de tiers soldé mais non lettré',
    redaction: (d) =>
      `Le compte ${nomCompte(d.compteConstate)} est soldé mais ses écritures ne sont pas lettrées. ` +
      `Le lettrage rapproche la facture de son règlement ; sans lui, la balance âgée reste fausse.`,
  },
  GLOB_RESULTAT_DISCORDANT: {
    gravite: 'bloquant',
    titre: 'Résultats discordants',
    redaction: (d) =>
      `Le résultat du compte de résultat s’élève à ${euro(d.montantConstate)} et celui du bilan à ${euro(d.montantAttendu)}. ` +
      `Les deux états procèdent des mêmes comptes : l’écart signale un compte de gestion ou de bilan mal classé.`,
  },
}

export function ficheEcart(code: CodeEcart): FicheEcart {
  return CATALOGUE[code]
}

export function titreEcart(code: CodeEcart): string {
  return CATALOGUE[code].titre
}

export function graviteEcart(code: CodeEcart): Gravite {
  return CATALOGUE[code].gravite
}

/** Construit un écart complet : code, famille, gravité, explication de secours. */
export function creerEcart(
  code: CodeEcart,
  details: DetailsEcart = {},
  graviteForcee?: Gravite,
): Ecart {
  const fiche = CATALOGUE[code]
  return {
    ...details,
    code,
    famille: familleDe(code),
    gravite: graviteForcee ?? fiche.gravite,
    explication: fiche.redaction(details).replace(/\s+/g, ' ').trim(),
  }
}

/** Ordre d'affichage : le plus grave d'abord, puis l'ordre des lignes. */
const POIDS: Record<Gravite, number> = { bloquant: 0, majeur: 1, mineur: 2 }

export function trierEcarts(ecarts: readonly Ecart[]): Ecart[] {
  return [...ecarts].sort(
    (a, b) => POIDS[a.gravite] - POIDS[b.gravite] || (a.ligne ?? 0) - (b.ligne ?? 0),
  )
}
