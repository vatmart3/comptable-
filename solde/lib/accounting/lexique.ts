/**
 * Le lexique — du mot au compte.
 *
 * Cœur de l'atelier : on écrit « assurance incendie », on obtient 616100 et,
 * surtout, la raison. Un étudiant de BTS CG n'a pas besoin d'un numéro, il a
 * besoin de savoir POURQUOI c'est ce numéro — c'est ce qu'on lui demandera de
 * justifier en épreuve.
 *
 * Chaque entrée porte donc trois choses au-delà du compte :
 *   - le sens habituel, qui dit de quel côté l'écriture se pose ;
 *   - le taux de TVA applicable, `null` quand l'opération n'est pas soumise ;
 *   - une note qui explique le rattachement, en une phrase.
 *
 * Les pièges classiques de l'épreuve sont marqués `piege` : assurance sans
 * TVA, timbres sans TVA, immobilisation confondue avec une charge, acompte
 * qui n'est pas un produit.
 */

import type { RateMilliPct } from './money'
import { TAUX } from './vat'

export type SensHabituel = 'debit' | 'credit'

export interface EntreeLexique {
  /** Formes sous lesquelles l'étudiant peut l'écrire. La première sert d'étiquette. */
  readonly termes: readonly string[]
  readonly compte: string
  readonly libelle: string
  readonly sens: SensHabituel
  /** null = opération non soumise à TVA. */
  readonly tva: RateMilliPct | null
  /** Le « pourquoi », en une phrase. C'est ce qui fait apprendre. */
  readonly note: string
  /** Erreur fréquente en épreuve, s'il y en a une. */
  readonly piege?: string
}

const N = TAUX.NORMAL
const I = TAUX.INTERMEDIAIRE
const R = TAUX.REDUIT

export const LEXIQUE: readonly EntreeLexique[] = [
  // ─── ACHATS (60) ────────────────────────────────────────────────────────
  {
    termes: ['achat de marchandises', 'marchandises', 'achat marchandises', 'revente'],
    compte: '607000',
    libelle: 'Achats de marchandises',
    sens: 'debit',
    tva: N,
    note: 'Bien acheté pour être revendu en l’état, sans transformation.',
    piege: 'Si le bien est transformé avant la vente, c’est une matière première : 601.',
  },
  {
    termes: ['matière première', 'matieres premieres', 'achat de matières'],
    compte: '601000',
    libelle: 'Achats de matières premières',
    sens: 'debit',
    tva: N,
    note: 'Bien qui entre dans la composition du produit fabriqué.',
  },
  {
    termes: ['fournitures consommables', 'consommables', 'approvisionnements'],
    compte: '602200',
    libelle: 'Fournitures consommables',
    sens: 'debit',
    tva: N,
    note: 'Consommé par l’activité sans entrer dans le produit : visserie, colle, gants.',
  },
  {
    termes: ['emballage', 'emballages', 'carton'],
    compte: '602600',
    libelle: 'Emballages',
    sens: 'debit',
    tva: N,
    note: 'Emballages destinés à être livrés avec la marchandise.',
  },
  {
    termes: ['électricité', 'electricite', 'edf', 'gaz', 'engie', 'énergie', 'eau', 'veolia'],
    compte: '606100',
    libelle: 'Fournitures non stockables — eau, énergie',
    sens: 'debit',
    tva: N,
    note: 'Fluides : ils ne se stockent pas, donc jamais en compte 3.',
  },
  {
    termes: ['carburant', 'gasoil', 'gazole', 'essence', 'plein'],
    compte: '606150',
    libelle: 'Carburants',
    sens: 'debit',
    tva: N,
    note: 'Charge de fonctionnement du véhicule, jamais une immobilisation.',
    piege: 'La TVA sur le gazole d’un véhicule de tourisme n’est déductible qu’à 80 %.',
  },
  {
    termes: ['petit équipement', 'petit outillage', 'produit d’entretien', 'entretien fournitures'],
    compte: '606300',
    libelle: 'Fournitures d’entretien et petit équipement',
    sens: 'debit',
    tva: N,
    note: 'Petit matériel de faible valeur : on le passe en charge au lieu de l’immobiliser.',
    piege: 'Au-delà de 500 € HT, l’administration attend une immobilisation (compte 2).',
  },
  {
    termes: ['fournitures de bureau', 'papeterie', 'ramette', 'cartouche', 'stylo'],
    compte: '606400',
    libelle: 'Fournitures administratives',
    sens: 'debit',
    tva: N,
    note: 'Consommables de bureau : papier, encre, petites fournitures. Charge de l’exercice.',
  },
  {
    termes: ['rabais obtenu', 'remise obtenue', 'ristourne obtenue', 'rrr obtenu'],
    compte: '609000',
    libelle: 'Rabais, remises et ristournes obtenus',
    sens: 'credit',
    tva: N,
    note: 'Réduction accordée par le fournisseur APRÈS la facture : elle se crédite.',
    piege: 'Une remise figurant SUR la facture ne se comptabilise pas : on saisit le net commercial.',
  },

  // ─── SERVICES EXTÉRIEURS (61-62) ────────────────────────────────────────
  {
    termes: ['sous-traitance', 'sous traitance', 'prestataire', 'freelance'],
    compte: '611000',
    libelle: 'Sous-traitance générale',
    sens: 'debit',
    tva: N,
    note: 'Travail confié à un tiers sur une commande de l’entreprise. C’est un service acheté.',
  },
  {
    termes: ['loyer', 'location de local', 'bail', 'location immobilière'],
    compte: '613200',
    libelle: 'Locations immobilières',
    sens: 'debit',
    tva: N,
    note: 'Loyer d’un local. Charge de la période, jamais une immobilisation.',
    piege: 'Un dépôt de garantie n’est pas une charge : 275, c’est une créance.',
  },
  {
    termes: ['location de matériel', 'location mobilière', 'leasing', 'crédit-bail'],
    compte: '613500',
    libelle: 'Locations mobilières',
    sens: 'debit',
    tva: N,
    note: 'Location de matériel : l’entreprise n’en est pas propriétaire, donc pas d’immobilisation.',
  },
  {
    termes: ['charges locatives', 'copropriété', 'syndic'],
    compte: '614000',
    libelle: 'Charges locatives et de copropriété',
    sens: 'debit',
    tva: N,
    note: 'Charges refacturées par le bailleur ou le syndic.',
  },
  {
    termes: ['réparation', 'reparation', 'entretien du matériel', 'maintenance', 'révision'],
    compte: '615500',
    libelle: 'Entretien et réparations sur biens mobiliers',
    sens: 'debit',
    tva: N,
    note: 'Remise en état : le bien retrouve son état, sa valeur n’augmente pas.',
    piege: 'Si l’intervention augmente la valeur ou la durée de vie du bien, elle s’immobilise.',
  },
  {
    termes: ['assurance', 'assurance incendie', 'prime d’assurance', 'mutuelle', 'axa', 'maif'],
    compte: '616000',
    libelle: 'Primes d’assurance',
    sens: 'debit',
    tva: null,
    note: 'Les opérations d’assurance sont exonérées de TVA (art. 261 C du CGI).',
    piege: 'Il n’y a PAS de TVA à récupérer sur une prime d’assurance — c’est le piège le plus fréquent.',
  },
  {
    termes: ['documentation', 'abonnement revue', 'journal', 'livre'],
    compte: '618100',
    libelle: 'Documentation générale',
    sens: 'debit',
    tva: R,
    note: 'Presse et livres relèvent du taux réduit.',
  },
  {
    termes: ['intérim', 'interim', 'personnel extérieur'],
    compte: '621000',
    libelle: 'Personnel extérieur à l’entreprise',
    sens: 'debit',
    tva: N,
    note: 'Facture d’une agence d’intérim : c’est un service, pas un salaire.',
    piege: 'Ne se met jamais en 641 : l’intérimaire n’est pas salarié de l’entreprise.',
  },
  {
    termes: ['honoraires', 'expert-comptable', 'avocat', 'notaire', 'conseil', 'commissaire aux comptes'],
    compte: '622600',
    libelle: 'Honoraires',
    sens: 'debit',
    tva: N,
    note: 'Rémunération d’une profession libérale.',
  },
  {
    termes: ['publicité', 'publicite', 'annonce', 'flyer', 'catalogue', 'salon'],
    compte: '623000',
    libelle: 'Publicité, publications, relations publiques',
    sens: 'debit',
    tva: N,
    note: 'Dépense de communication : annonces, catalogues, salons, campagnes.',
    piege: 'Un cadeau à la clientèle de plus de 73 € TTC : TVA non déductible.',
  },
  {
    termes: ['transport sur achat', 'port', 'livraison', 'frais de port', 'transporteur'],
    compte: '624100',
    libelle: 'Transports sur achats',
    sens: 'debit',
    tva: N,
    note: 'Port facturé séparément par un transporteur.',
    piege: 'Un port facturé PAR LE FOURNISSEUR sur sa facture suit le compte d’achat.',
  },
  {
    termes: ['déplacement', 'train', 'sncf', 'avion', 'péage', 'parking', 'taxi'],
    compte: '625100',
    libelle: 'Voyages et déplacements',
    sens: 'debit',
    tva: I,
    note: 'Transport de personnes : taux intermédiaire de 10 %.',
    piege: 'La TVA sur le transport de personnes n’est pas déductible pour l’entreprise.',
  },
  {
    termes: ['hôtel', 'hotel', 'hébergement', 'nuitée'],
    compte: '625600',
    libelle: 'Missions',
    sens: 'debit',
    tva: I,
    note: 'Hébergement en déplacement professionnel.',
    piege: 'TVA non déductible sur l’hébergement des dirigeants et salariés.',
  },
  {
    termes: ['restaurant', 'repas', 'déjeuner', 'traiteur', 'réception'],
    compte: '625700',
    libelle: 'Réceptions',
    sens: 'debit',
    tva: I,
    note: 'Repas d’affaires. TVA à 10 % sur la restauration.',
  },
  {
    termes: ['téléphone', 'telephone', 'internet', 'fibre', 'mobile', 'orange', 'sfr', 'free'],
    compte: '626000',
    libelle: 'Frais postaux et de télécommunications',
    sens: 'debit',
    tva: N,
    note: 'Abonnements et communications.',
  },
  {
    termes: ['timbre', 'affranchissement', 'la poste', 'courrier'],
    compte: '626000',
    libelle: 'Frais postaux et de télécommunications',
    sens: 'debit',
    tva: null,
    note: 'Les envois postaux relevant du service universel sont exonérés de TVA.',
    piege: 'Pas de TVA sur les timbres : ne pas la reconstituer.',
  },
  {
    termes: ['frais bancaires', 'agios', 'commission bancaire', 'cotisation carte'],
    compte: '627000',
    libelle: 'Services bancaires et assimilés',
    sens: 'debit',
    tva: null,
    note: 'Les services bancaires sont exonérés de TVA.',
    piege: 'Ne pas confondre avec les intérêts d’emprunt, qui vont en 661.',
  },
  {
    termes: ['cotisation professionnelle', 'adhésion', 'syndicat', 'ordre'],
    compte: '628100',
    libelle: 'Cotisations professionnelles',
    sens: 'debit',
    tva: null,
    note: 'Cotisation à un organisme professionnel.',
  },

  // ─── IMPÔTS ET PERSONNEL (63-64) ────────────────────────────────────────
  {
    termes: ['taxe sur les salaires'],
    compte: '631100',
    libelle: 'Taxe sur les salaires',
    sens: 'debit',
    tva: null,
    note: 'Due par les employeurs non soumis à TVA sur la majorité de leur chiffre d’affaires.',
  },
  {
    termes: ['cfe', 'cotisation foncière', 'taxe foncière', 'impôt local'],
    compte: '635100',
    libelle: 'Impôts directs — cotisation foncière des entreprises',
    sens: 'debit',
    tva: null,
    note: 'Impôt local dû par l’entreprise. Charge d’exploitation.',
    piege: 'Ne pas confondre avec l’impôt sur les bénéfices, qui va en 695.',
  },
  {
    termes: ['salaire', 'paie', 'rémunération', 'appointements', 'salaire brut'],
    compte: '641100',
    libelle: 'Salaires et appointements',
    sens: 'debit',
    tva: null,
    note: 'Salaire BRUT du personnel. Hors du champ de la TVA.',
    piege: 'On débite le brut, pas le net : le net versé passe par le 421.',
  },
  {
    termes: ['urssaf', 'cotisation patronale', 'charges sociales', 'retraite', 'sécurité sociale'],
    compte: '645100',
    libelle: 'Cotisations à l’URSSAF',
    sens: 'debit',
    tva: null,
    note: 'Part PATRONALE des cotisations : c’est une charge pour l’entreprise.',
    piege: 'La part salariale n’est pas une charge : elle est retenue sur le brut, en 431.',
  },

  // ─── CHARGES FINANCIÈRES ET EXCEPTIONNELLES (66-67) ─────────────────────
  {
    termes: ['intérêt d’emprunt', 'interets', 'intérêts bancaires', 'intérêt'],
    compte: '661100',
    libelle: 'Intérêts des emprunts et dettes',
    sens: 'debit',
    tva: null,
    note: 'Coût de l’argent emprunté. Charge FINANCIÈRE, pas d’exploitation.',
    piege: 'Le remboursement du capital de l’emprunt n’est pas une charge : il solde le 164.',
  },
  {
    termes: ['amende', 'pénalité', 'majoration de retard'],
    compte: '671000',
    libelle: 'Charges exceptionnelles sur opérations de gestion',
    sens: 'debit',
    tva: null,
    note: 'Amendes et pénalités : charge exceptionnelle, et non déductible fiscalement.',
  },
  {
    termes: ['valeur comptable du bien cédé', 'vnc', 'vnc cédée'],
    compte: '675000',
    libelle: 'Valeurs comptables des éléments d’actif cédés',
    sens: 'debit',
    tva: null,
    note: 'Sortie de l’actif lors d’une cession : on constate la valeur nette restante.',
  },

  // ─── DOTATIONS (68) ─────────────────────────────────────────────────────
  {
    termes: ['dotation aux amortissements', 'amortissement', 'dotation'],
    compte: '681120',
    libelle: 'Dotations aux amortissements des immobilisations',
    sens: 'debit',
    tva: null,
    note: 'Constate l’usure d’une immobilisation sur l’exercice. Charge calculée, sans décaissement.',
    piege: 'La contrepartie est au crédit du 28, jamais au crédit du compte d’immobilisation.',
  },
  {
    termes: ['dépréciation client', 'provision client', 'client douteux'],
    compte: '681740',
    libelle: 'Dotations aux dépréciations des créances',
    sens: 'debit',
    tva: null,
    note: 'Risque de non-recouvrement d’une créance client. Se calcule sur le montant HT.',
    piege: 'La dépréciation se calcule sur la créance HT, pas sur le TTC.',
  },

  // ─── PRODUITS (70-77) ───────────────────────────────────────────────────
  {
    termes: ['vente de marchandises', 'vente', 'vendu'],
    compte: '707000',
    libelle: 'Ventes de marchandises',
    sens: 'credit',
    tva: N,
    note: 'Revente en l’état d’un bien acheté.',
  },
  {
    termes: ['vente de produits finis', 'produit fini'],
    compte: '701000',
    libelle: 'Ventes de produits finis',
    sens: 'credit',
    tva: N,
    note: 'Vente d’un bien fabriqué par l’entreprise.',
  },
  {
    termes: ['prestation de service', 'prestation', 'service', 'mission', 'honoraire facturé'],
    compte: '706000',
    libelle: 'Prestations de services',
    sens: 'credit',
    tva: N,
    note: 'Vente d’un service, pas d’un bien.',
    piege: 'Sur les prestations, la TVA est exigible à l’ENCAISSEMENT, pas à la facturation.',
  },
  {
    termes: ['port facturé', 'frais de port facturé'],
    compte: '708500',
    libelle: 'Ports et frais accessoires facturés',
    sens: 'credit',
    tva: N,
    note: 'Port refacturé au client : c’est un produit.',
  },
  {
    termes: ['rabais accordé', 'remise accordée', 'ristourne accordée', 'rrr accordé'],
    compte: '709000',
    libelle: 'Rabais, remises et ristournes accordés',
    sens: 'debit',
    tva: N,
    note: 'Réduction accordée au client après facturation : compte de produit, mais qui se DÉBITE.',
    piege: 'C’est un compte de classe 7 au débit — le sens surprend souvent en épreuve.',
  },
  {
    termes: ['subvention d’exploitation', 'subvention'],
    compte: '740000',
    libelle: 'Subventions d’exploitation',
    sens: 'credit',
    tva: null,
    note: 'Aide reçue pour compenser une insuffisance de recettes.',
  },
  {
    termes: ['produit de cession', 'prix de cession', 'vente d’immobilisation'],
    compte: '775000',
    libelle: 'Produits des cessions d’éléments d’actif',
    sens: 'credit',
    tva: N,
    note: 'Prix de vente d’une immobilisation. Produit EXCEPTIONNEL.',
    piege: 'La cession se comptabilise en deux écritures : le prix (775) et la sortie du bien (675 + 28).',
  },

  // ─── IMMOBILISATIONS (2) ────────────────────────────────────────────────
  {
    termes: ['logiciel', 'licence', 'brevet'],
    compte: '205000',
    libelle: 'Concessions, brevets, licences, logiciels',
    sens: 'debit',
    tva: N,
    note: 'Immobilisation INCORPORELLE : un bien sans substance physique.',
  },
  {
    termes: ['terrain'],
    compte: '211000',
    libelle: 'Terrains',
    sens: 'debit',
    tva: null,
    note: 'Un terrain ne s’use pas : il ne s’amortit JAMAIS.',
    piege: 'Erreur fréquente : amortir un terrain. Seule la construction s’amortit.',
  },
  {
    termes: ['construction', 'bâtiment', 'immeuble'],
    compte: '213100',
    libelle: 'Constructions',
    sens: 'debit',
    tva: N,
    note: 'Immobilisation corporelle amortissable, souvent sur 20 à 40 ans.',
  },
  {
    termes: ['machine', 'matériel industriel', 'outillage'],
    compte: '215400',
    libelle: 'Matériel industriel',
    sens: 'debit',
    tva: N,
    note: 'Équipement de production, amorti sur sa durée d’utilisation.',
  },
  {
    termes: ['véhicule', 'voiture', 'camionnette', 'utilitaire'],
    compte: '218200',
    libelle: 'Matériel de transport',
    sens: 'debit',
    tva: N,
    note: 'Véhicule inscrit à l’actif, amorti sur sa durée d’utilisation (souvent 5 ans).',
    piege: 'TVA NON déductible sur un véhicule de tourisme ; déductible sur un utilitaire.',
  },
  {
    termes: ['ordinateur', 'imprimante', 'matériel informatique', 'serveur', 'écran'],
    compte: '218300',
    libelle: 'Matériel de bureau et matériel informatique',
    sens: 'debit',
    tva: N,
    note: 'Immobilisation si la valeur dépasse 500 € HT et la durée d’usage un an.',
    piege: 'La TVA d’une immobilisation va en 445620, pas en 445660.',
  },
  {
    termes: ['mobilier', 'bureau meuble', 'chaise', 'étagère'],
    compte: '218400',
    libelle: 'Mobilier',
    sens: 'debit',
    tva: N,
    note: 'Mobilier de l’entreprise, amorti généralement sur 10 ans.',
  },
  {
    termes: ['dépôt de garantie', 'caution versée'],
    compte: '275000',
    libelle: 'Dépôts et cautionnements versés',
    sens: 'debit',
    tva: null,
    note: 'Somme récupérable en fin de bail : c’est une créance, pas une charge.',
    piege: 'Ne jamais passer un dépôt de garantie en charge de loyer.',
  },

  // ─── TIERS (4) ──────────────────────────────────────────────────────────
  {
    termes: ['fournisseur', 'dette fournisseur', 'à payer'],
    compte: '401000',
    libelle: 'Fournisseurs',
    sens: 'credit',
    tva: null,
    note: 'Dette envers un fournisseur, pour le montant TTC.',
  },
  {
    termes: ['fournisseur d’immobilisation'],
    compte: '404000',
    libelle: 'Fournisseurs d’immobilisations',
    sens: 'credit',
    tva: null,
    note: 'Dette née de l’achat d’une immobilisation — distincte du 401.',
    piege: 'Un achat d’immobilisation ne se met pas en 401 mais en 404.',
  },
  {
    termes: ['client', 'créance client', 'à encaisser'],
    compte: '411000',
    libelle: 'Clients',
    sens: 'debit',
    tva: null,
    note: 'Créance sur un client, pour le montant TTC.',
  },
  {
    termes: ['client douteux', 'créance douteuse', 'impayé'],
    compte: '416000',
    libelle: 'Clients douteux ou litigieux',
    sens: 'debit',
    tva: null,
    note: 'Créance dont le recouvrement est incertain : on la transfère du 411 vers le 416.',
  },
  {
    termes: ['salaire à payer', 'net à payer', 'rémunération due'],
    compte: '421000',
    libelle: 'Personnel — rémunérations dues',
    sens: 'credit',
    tva: null,
    note: 'Salaire NET restant à verser au salarié.',
  },
  {
    termes: ['tva déductible', 'tva sur achat', 'tva récupérable'],
    compte: '445660',
    libelle: 'TVA déductible sur autres biens et services',
    sens: 'debit',
    tva: null,
    note: 'TVA payée au fournisseur, récupérable auprès de l’État : c’est une créance, donc au débit.',
    piege: 'Pour une immobilisation, utiliser 445620 et non 445660.',
  },
  {
    termes: ['tva déductible immobilisation', 'tva sur immobilisation'],
    compte: '445620',
    libelle: 'TVA déductible sur immobilisations',
    sens: 'debit',
    tva: null,
    note: 'TVA sur l’achat d’une immobilisation : compte distinct, case 19 de la CA3.',
  },
  {
    termes: ['tva collectée', 'tva sur vente'],
    compte: '445711',
    libelle: 'TVA collectée 20 %',
    sens: 'credit',
    tva: null,
    note: 'TVA encaissée du client pour le compte de l’État : c’est une dette, donc au crédit.',
  },
  {
    termes: ['tva à décaisser', 'tva à payer'],
    compte: '445510',
    libelle: 'TVA à décaisser',
    sens: 'credit',
    tva: null,
    note: 'Solde dû à l’État : TVA collectée − TVA déductible.',
  },
  {
    termes: ['crédit de tva', 'tva à reporter'],
    compte: '445670',
    libelle: 'Crédit de TVA à reporter',
    sens: 'debit',
    tva: null,
    note: 'Quand la TVA déductible dépasse la collectée : l’État doit de l’argent à l’entreprise.',
  },
  {
    termes: ['compte d’attente', 'attente', '471'],
    compte: '471000',
    libelle: 'Compte d’attente',
    sens: 'debit',
    tva: null,
    note: 'Opération non identifiée. À solder AVANT la clôture, jamais laissée en l’état.',
  },
  {
    termes: ['charge constatée d’avance', 'cca'],
    compte: '486000',
    libelle: 'Charges constatées d’avance',
    sens: 'debit',
    tva: null,
    note: 'Charge payée cette année mais qui concerne l’exercice suivant : on la sort du résultat.',
  },
  {
    termes: ['produit constaté d’avance', 'pca'],
    compte: '487000',
    libelle: 'Produits constatés d’avance',
    sens: 'credit',
    tva: null,
    note: 'Produit encaissé d’avance qui concerne l’exercice suivant.',
  },

  // ─── TRÉSORERIE (5) ─────────────────────────────────────────────────────
  {
    termes: ['banque', 'virement', 'chèque', 'cheque', 'carte bancaire', 'cb', 'prélèvement'],
    compte: '512000',
    libelle: 'Banque',
    sens: 'credit',
    tva: null,
    note: 'Compte bancaire. Se crédite quand on paie, se débite quand on encaisse.',
  },
  {
    termes: ['caisse', 'espèces', 'especes', 'liquide'],
    compte: '530000',
    libelle: 'Caisse',
    sens: 'credit',
    tva: null,
    note: 'Espèces. Le solde d’une caisse ne peut JAMAIS être créditeur.',
    piege: 'Une caisse créditrice est toujours une erreur de saisie.',
  },

  // ─── CAPITAUX (1) ───────────────────────────────────────────────────────
  {
    termes: ['capital', 'apport'],
    compte: '101000',
    libelle: 'Capital',
    sens: 'credit',
    tva: null,
    note: 'Apport des associés. Ressource de l’entreprise, donc au passif.',
  },
  {
    termes: ['emprunt', 'prêt bancaire', 'crédit bancaire'],
    compte: '164000',
    libelle: 'Emprunts auprès des établissements de crédit',
    sens: 'credit',
    tva: null,
    note: 'Dette financière. Le remboursement du capital la débite ; seuls les intérêts sont une charge.',
  },
  {
    termes: ['réserve légale', 'réserve'],
    compte: '106100',
    libelle: 'Réserve légale',
    sens: 'credit',
    tva: null,
    note: 'Part du bénéfice conservée dans l’entreprise. 5 % du bénéfice, jusqu’à 10 % du capital.',
  },
  {
    termes: ['report à nouveau'],
    compte: '110000',
    libelle: 'Report à nouveau',
    sens: 'credit',
    tva: null,
    note: 'Bénéfice des exercices antérieurs non distribué.',
  },

  // ─── COMPTES SOUSTRACTIFS ET DE RÉGULARISATION ──────────────────────────
  {
    termes: ['amortissement du matériel', 'amortissements cumulés', 'compte 28'],
    compte: '281830',
    libelle: 'Amortissements du matériel de bureau et informatique',
    sens: 'credit',
    tva: null,
    note: 'Cumul des amortissements. Compte d’actif SOUSTRACTIF : il vient en déduction du 2183 au bilan.',
    piege: 'Malgré son solde créditeur, il ne figure jamais au passif : il se déduit de l’actif.',
  },
  {
    termes: ['dépréciation des créances', 'provision pour créance douteuse', 'compte 491'],
    compte: '491000',
    libelle: 'Dépréciations des comptes de clients',
    sens: 'credit',
    tva: null,
    note: 'Constate le risque de ne pas être payé. Se déduit des créances clients au bilan.',
    piege: 'Se calcule sur la créance HORS TAXE : la TVA sera récupérée si la créance devient irrécouvrable.',
  },
  {
    termes: ['sécurité sociale', 'organismes sociaux', 'cotisations à payer', 'compte 431'],
    compte: '431000',
    libelle: 'Sécurité sociale',
    sens: 'credit',
    tva: null,
    note: 'Dette envers l’URSSAF : elle porte la part salariale ET la part patronale.',
    piege: 'Le 431 reçoit la SOMME des deux parts, pas seulement la patronale.',
  },
  {
    termes: ['créance sur cession', 'compte 462', 'cession à encaisser'],
    compte: '462000',
    libelle: 'Créances sur cessions d’immobilisations',
    sens: 'debit',
    tva: null,
    note: 'Créance née de la vente d’une immobilisation — distincte du 411, réservé à l’exploitation.',
    piege: 'Vendre une machine ne crée pas un client : la créance va en 462, pas en 411.',
  },
]

// ── Recherche ───────────────────────────────────────────────────────────────

/** Minuscules sans accents ni apostrophes typographiques. */
export function normaliser(valeur: string): string {
  return valeur
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’']/g, "'")
    .toLowerCase()
    .trim()
}

export interface ResultatLexique {
  readonly entree: EntreeLexique
  /** Score de pertinence, en millièmes. */
  readonly score: number
  /** Terme qui a déclenché la correspondance. */
  readonly terme: string
}

/**
 * Cherche un compte à partir d'un mot ou d'un bout de phrase.
 *
 * Ordre de pertinence : terme exact, puis terme qui commence par la requête,
 * puis terme contenu, puis libellé du compte, puis numéro de compte tapé
 * directement. Un étudiant qui tape « 616 » cherche un compte ; un étudiant
 * qui tape « assurance » cherche une notion.
 */
export function chercher(requete: string, limite = 8): ResultatLexique[] {
  const q = normaliser(requete)
  if (q.length === 0) return []

  const trouves: ResultatLexique[] = []

  for (const entree of LEXIQUE) {
    let meilleur = 0
    let termeRetenu = entree.termes[0] ?? ''

    if (entree.compte.startsWith(q) && /^\d+$/.test(q)) {
      meilleur = 950
      termeRetenu = entree.compte
    }

    for (const terme of entree.termes) {
      const t = normaliser(terme)
      let score = 0
      if (t === q) score = 1000
      else if (t.startsWith(q)) score = 880
      else if (t.includes(q)) score = 760
      else if (q.includes(t) && t.length >= 4) score = 700
      if (score > meilleur) {
        meilleur = score
        termeRetenu = terme
      }
    }

    if (meilleur === 0 && normaliser(entree.libelle).includes(q) && q.length >= 3) {
      meilleur = 620
    }

    if (meilleur > 0) trouves.push({ entree, score: meilleur, terme: termeRetenu })
  }

  return trouves
    .sort((a, b) => b.score - a.score || a.entree.compte.localeCompare(b.entree.compte))
    .slice(0, limite)
}

/** La meilleure correspondance, ou null si rien ne dépasse le seuil de confiance. */
export function meilleure(requete: string, seuil = 700): ResultatLexique | null {
  const resultat = chercher(requete, 1)[0]
  return resultat && resultat.score >= seuil ? resultat : null
}

/** Toutes les entrées d'une classe, pour les listes déroulantes par famille. */
export function parClasse(classe: number): EntreeLexique[] {
  return LEXIQUE.filter((entree) => Number(entree.compte[0]) === classe)
}

/** Les pièges du programme, pour une fiche de révision. */
export function pieges(): readonly EntreeLexique[] {
  return LEXIQUE.filter((entree) => entree.piege != null)
}
