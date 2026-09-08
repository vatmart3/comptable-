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
| P1 | La Ligne + La Balance : saisie, validation, chaînage, journaux | à venir |
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
npm test              # 197 tests sur le moteur comptable
npm run typecheck     # TypeScript strict, zéro any
npm run solde:verify  # intégrité du registre : chaîne, séquences, balance
```

## Architecture

```
lib/accounting/   moteur comptable pur — aucune dépendance React, Next ou Prisma
lib/db.ts         client Prisma
app/              routes App Router
prisma/           schéma, données du PCG, seed
tests/            Vitest, un fichier par module du moteur
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

## Direction artistique

Les tokens vivent dans `app/globals.css` et nulle part ailleurs : palette
papier/encre, rayons 28/16/999, filets d'un pixel plutôt que des ombres,
chiffres tabulaires partout, ressorts plutôt que des `ease-in-out`.
`prefers-reduced-motion` est respecté.

La police d'interface prévue est **General Sans** (Fontshare). Elle n'est pas
distribuée sur npm : déposer les `.woff2` dans `public/fonts` l'active
automatiquement. En attendant, **Figtree** (auto-hébergée, même squelette
géométrique) prend le relais. Les chiffres sont en **Geist Mono**.
