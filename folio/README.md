# FOLIO — moteur comptable

PGI d'entraînement pour le BTS Comptabilité et Gestion. Ce dossier contient la
**phase 1** : le moteur, et rien d'autre. Aucune interface, aucune dépendance à
React, aucun appel réseau, aucun modèle de langage.

## Pourquoi le moteur d'abord

Un étudiant à qui une IA approximative refuse une écriture juste désinstalle
l'application et n'y revient pas. Tout ce qui calcule, contrôle et corrige est
donc du TypeScript déterministe, couvert par des tests. L'IA n'intervient, plus
tard et facultativement, que pour reformuler une explication déjà produite ici.

## Deux règles d'écriture du code

**Les montants sont des entiers de centimes.** `Centimes` circule partout ;
la conversion en euros n'a lieu qu'aux frontières (saisie, affichage, FEC, PDF).
C'est la seule façon de tenir la promesse « exact au centime ».

**Les dates sont des chaînes `AAAA-MM-JJ`.** Le moteur ne construit jamais
d'objet `Date` : le fuseau du navigateur ferait basculer une écriture du
31 décembre sur l'exercice suivant.

## Arborescence

```
src/engine/
  core/          montant.ts   arithmétique en centimes, arrondi, répartition
                 dates.ts     exercice, base 30/360, prorata
  types/         dossier, compte, journal, écriture, pièce, entraînement
  referentiel/   plan comptable PCG du BTS CG, journaux, taux de TVA
  controles/     codes.ts     39 codes d'écart typés
                 catalogue.ts gravité et explication déterministe de chacun
                 structure, sens, tva, montants, inventaire, global
                 diagnostic.ts  comparaison saisie / attendu
  calculs/       pièce, grand livre, balance, balance âgée, CA3,
                 amortissements, régularisations, lettrage, rapprochement,
                 états financiers
  export/        fec.ts       fichier des écritures comptables, A. 47 A-1
  fixtures/      garage-vidal.ts  exercice complet vérifiable à la main
```

## Les deux points d'entrée du contrôle

```ts
// L'écriture est-elle recevable en elle-même ?
controlerEcriture(ecriture, { exercice, ecrituresExistantes, piece })

// En quoi diffère-t-elle de l'écriture attendue ?
diagnostiquer(saisie, attendue, { piece, journalSaisi, journalAttendu, ... })
```

Les deux renvoient des `Ecart` :

```ts
{
  code: 'TVA_CONFUSION_44566_44562',
  famille: 'tva',
  gravite: 'majeur',
  explication: 'TVA déductible portée en 44566 alors que la facture concerne
                une immobilisation. Le compte attendu est le 44562.',
  ligne: 1, compteConstate: '44566', compteAttendu: '44562'
}
```

Le `code` est la clé du produit : il alimente le diagnostic, l'entraînement
ciblé et le tableau de progression. Il n'y a pas de message générique — un test
vérifie que chacun des 39 codes est produit par un cas réel et qu'aucune
explication ne contient de trou.

## Contrôles couverts

| Famille | Ce que le moteur nomme |
| --- | --- |
| structure | déséquilibre, ligne sans montant ou à double sens, montant négatif, compte hors plan, journal incohérent, date invalide, hors exercice ou erronée, pièce absente ou en doublon |
| sens | sens inversé, bilan/gestion, 401/404, 411/462, charge/immobilisation, classe voisine |
| tva | 44566/44562, 44571/44551, taux non conforme, base erronée, arrondi, TVA omise |
| montants | HT/TTC, escompte, remise, port, emballages consignés, écart d'arrondi, montant erroné |
| inventaire | base amortissable, prorata temporis, dépréciation sur le brut, rattachement à l'exercice |
| global | compte d'attente non soldé, balance déséquilibrée, tiers soldé non lettré, résultats discordants |

## Commandes

```
npm install
npm test              # 184 tests
npm run coverage      # seuils : 90 % lignes, 85 % branches
npm run typecheck
```

## Ce que la phase 2 consommera

`rechercherComptes` pour la recherche au clavier, `desequilibre` pour
l'inclinaison de la balance 3D, `controlerEcriture` à la validation,
`diagnostiquer` pour la correction, et les fonctions de `calculs/` pour les
restitutions de la phase 3.
