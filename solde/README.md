# SOLDE

**La comptabilité qui se tient droite.**

PGI de comptabilité française pour TPE/PME, indépendants et cabinets d'expertise
comptable. Saisir une écriture en quatre secondes, clôturer sans peur,
comprendre ses chiffres sans savoir lire une balance.

---

## État d'avancement

| Phase | Contenu | État |
|---|---|---|
| **P0** | Setup, schéma Prisma, design tokens, PCG seedé, moteur comptable + tests | **livrée** |
| **P1** | La Ligne + La Balance : saisie, validation, chaînage, journaux | **livrée** |
| P2 | Le Fil : grand livre, balance, filtres, zoom sémantique | à venir |
| P3 | Banque : imports, Lettrage Magnétique, rapprochement | à venir |
| P4 | Facturation, TVA, immobilisations | à venir |
| P5 | Couche IA (9 usages) | à venir |
| P6 | États financiers, Radar de clôture, export FEC, PDF | à venir |
| P7 | 3D finalisée, transitions partagées, PWA offline, polish | à venir |

## Démarrer

```bash
npm install
cp .env.example .env          # renseigner DATABASE_URL
npm run db:push               # crée le schéma
npm run db:seed               # société de démonstration + PCG complet
npm run dev
```

Tests et contrôles :

```bash
npm test              # 287 tests : moteur comptable, parseur, service, démo
npm run typecheck     # TypeScript strict, zéro any
npm run solde:verify  # intégrité du registre : chaîne, séquences, balance
npm run demo:etats    # vraisemblance comptable du seed de démonstration
```

Les tests d'intégration (`tests/entries.integration.test.ts`) tournent sur une
vraie base et se désactivent seuls si `DATABASE_URL` n'est pas joignable.

## Architecture

```
lib/accounting/   moteur comptable pur — aucune dépendance React, Next ou Prisma
lib/server/       services qui touchent la base : contexte, écritures
lib/db.ts         client Prisma
app/              routes App Router + server actions
components/       balance/ (3D et dessinée), saisie/ (La Ligne), palette/ (⌘K)
prisma/           schéma, données du PCG, générateur de démo, seed
tests/            Vitest, un fichier par module + intégration
scripts/verify.ts commande d'intégrité
```

**Le moteur comptable est une librairie pure.** Aucune règle métier ne vit dans
un composant React. `lib/accounting/` ne lit jamais la base : on lui donne des
lignes, il rend des chiffres — c'est ce qui le rend testable et rejouable sur
n'importe quel périmètre.

## Les invariants

Trois règles portées par le code, et testées :

1. **Partie double.** `somme(débits) = somme(crédits)`, vérifié avant tout
   enregistrement. Une ligne porte un débit *ou* un crédit, jamais les deux,
   jamais zéro sur les deux.
2. **Immutabilité.** Une écriture validée ne se modifie pas et ne se supprime
   pas. Correction = contre-passation.
3. **Inaltérabilité.** Chaque écriture validée porte
   `hash = SHA256(empreinte + hashPrécédent)`. `npm run solde:verify` recalcule
   toute la chaîne et désigne le maillon altéré. Esprit de l'article
   286-I-3° bis du CGI.

Et deux conventions qui évitent les erreurs silencieuses :

- **Tous les montants sont des entiers de centimes.** `0.1 + 0.2 !== 0.3` n'est
  pas une curiosité de développeur en comptabilité, c'est un écart de balance.
- **Aucun `enum` Prisma, aucun attribut natif.** Le schéma est portable tel quel
  entre PostgreSQL et SQLite ; les domaines de valeurs sont tenus par Zod.

## Modules du moteur

| Module | Rôle |
|---|---|
| `money` | centimes, arrondi commercial, lecture/formatage français, répartition sans perte |
| `account` | grammaire du numéro PCG : classe, nature, sens naturel, lettrabilité |
| `entry` | structure de l'écriture, invariants, contre-passation |
| `chain` | empreinte canonique, chaînage SHA-256, vérification |
| `sequence` | numérotation continue, détection des trous et doublons |
| `vat` | taux, HT/TTC, CA3 par cases, contrôle de cohérence, écriture de déclaration |
| `depreciation` | plans linéaire (prorata en jours, base 360) et dégressif (prorata en mois, bascule obligatoire) |
| `lettering` | lettres A→ZZ, validité d'un lettrage, propositions de rapprochement |
| `statements` | balance, grand livre progressif, bilan, compte de résultat, SIG, ratios |
| `closing` | résultat, à-nouveaux, affectation, contrôles de clôture |
| `fec` | export 18 champs conforme, audit du fichier produit |
| `anomalies` | radar : doublons, TVA incohérente, week-end, 471, séquence, montants aberrants |
| `roles` | matrice lecture / saisie / réviseur / expert |
| `ligne` | analyse d'une saisie en langage naturel — déterministe, hors ligne |

## La saisie

`/saisie` porte les deux premières signatures du § 7.

**La Ligne** analyse une phrase française et en tire une écriture. L'analyse est
déterministe et tourne dans le navigateur : elle fonctionne sans réseau, comme
l'exige le § 2, et son résultat est prévisible — une grammaire s'apprend, un
modèle se devine. La couche IA du § 5.1 viendra en Phase 5 se brancher en aval,
sur les seules phrases que cette grammaire n'a pas su lire.

Les puces n'éditent pas des lignes comptables : elles éditent un *brouillon*
(sens, date, montant, compte, taux, journal, tiers), dont les lignes se
déduisent. Une écriture sortie de La Ligne est donc équilibrée par construction.

**La Balance** pèse ce qui est déjà connu. Un montant sans imputation charge un
plateau et laisse l'autre vide : elle penche à fond, et la validation reste
fermée. Dès que le compte arrive, les deux plateaux s'égalisent, elle se pose,
le témoin passe au vert. Aucun message d'erreur n'accompagne le déséquilibre —
on le voit. Sous `prefers-reduced-motion`, la même balance est dessinée en SVG,
figée à la même inclinaison.

### Ce que le service garantit

Un brouillon n'a **pas** de numéro : lui en donner un, puis le supprimer,
creuserait un trou dans la séquence — donc une présomption de suppression
d'écriture. Le numéro est attribué à la validation.

Numérotation et chaînage sont deux compteurs partagés. La validation prend donc
un verrou consultatif PostgreSQL sur la société, en tête de transaction. Le test
d'intégration valide six écritures en parallèle et vérifie qu'aucun numéro ni
aucun maillon n'est attribué deux fois.

## Direction artistique

Les tokens vivent dans `app/globals.css` et nulle part ailleurs : palette
papier/encre, rayons 28/16/999, filets d'un pixel plutôt que des ombres,
chiffres tabulaires partout, ressorts plutôt que des `ease-in-out`.
`prefers-reduced-motion` est respecté.

La police d'interface prévue est **General Sans** (Fontshare). Elle n'est pas
distribuée sur npm : déposer les `.woff2` dans `public/fonts` l'active
automatiquement. En attendant, **Figtree** (auto-hébergée, même squelette
géométrique) prend le relais. Les chiffres sont en **Geist Mono**.
