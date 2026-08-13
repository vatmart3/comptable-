# Cabinet Ferrand & Solère — site vitrine

Site vitrine complet d'un cabinet d'expertise comptable (Sète, Bassin de Thau, Montpellier).
Pièce de démonstration MJAGENCY.

Le concept, les partis pris et leur justification sont dans **[DESIGN.md](./DESIGN.md)**.

> **Cabinet de démonstration.** Ferrand & Solère n'existe pas. Nom, numéros d'inscription à
> l'Ordre, dossiers clients et coordonnées sont inventés. Le site l'affiche lui-même (drapeau
> `demo` dans `src/config/site.ts`), et le formulaire ne transmet rien.

---

## Installation

```bash
npm install
npm run dev
```

Node 20 ou plus. Aucune clé d'API, aucun service externe, aucune variable d'environnement :
le site n'appelle rien au-delà de son propre domaine.

| Commande | Effet |
|---|---|
| `npm run dev` | serveur de développement Vite |
| `npm run build` | vérification TypeScript puis build de production dans `dist/` |
| `npm run preview` | sert le build de production |
| `npm run og` | régénère `public/og.png` à partir du modèle de calcul |
| `npm run single` | assemble tout le site en une page autonome (`dist-single/page.html`) |

### Voir le site sans rien installer

`npm run single` produit `dist-single/page.html` : le site entier dans un seul fichier, styles,
script et polices inclus en `data:` URI. Aucune requête réseau, il s'ouvre par double-clic ou se
dépose sur n'importe quel hébergeur statique.

C'est une variante de *démonstration*, pas la version de production : elle désactive le découpage
en chunks, donc la scène 3D n'est plus chargée en différé après le premier paint. Pour un
hébergement réel, `npm run build` et servez `dist/`.

---

## Structure

```
index.html                  titre, description et Open Graph statiques (copie de site.ts)
public/
  favicon.svg               la balance, en 32 px
  og.png · og.svg           image de partage, générée par npm run og
scripts/
  build-og.mjs              génération de l'image OG
  fonts/                    instances statiques des polices, pour la génération OG (OFL 1.1)
src/
  config/site.ts            ⭐ SOURCE UNIQUE — identité, textes, tarifs, dossiers, couleurs
  index.css                 tokens (@theme Tailwind), rôles typographiques, animations
  lib/
    simulator.ts            ⭐ MODÈLE DE CALCUL — barèmes et formules, sans dépendance
    ledger.tsx              état du grand livre (contexte React) + useLedgerEntry
    useSmoothScroll.ts      Lenis branché sur l'horloge GSAP
    motion.ts               prefers-reduced-motion, pointeur fin, avancement du hero
    format.ts               formatage des montants en français
  components/
    Nav.tsx                 sommaire folioté (le folio 08 est le bouton d'action)
    Hero.tsx                scène 3D, orchestration au scroll, replis
    scene/BalanceScene.tsx  la balance (React Three Fiber), chargée en lazy
    scene/BalanceDrawing.tsx dessin SVG : chargement (fil de fer) et repli sans WebGL
    Ledger.tsx              ⭐ LE GRAND LIVRE — rail desktop, barre basse mobile
    Odometer.tsx            compteur à rouleau
    Amount.tsx              un montant, et la règle de couleur du débit
    Section.tsx             ossature commune (filet, folio, titre)
    Section*.tsx            les huit sections, une par fichier
    Crosshair.tsx           réticule de lecture desktop, désactivable
    Footer.tsx              pied de registre (totaux, mentions)
    Head.tsx                JSON-LD AccountingService + LocalBusiness + FAQPage
```

### Les deux fichiers qui tiennent le site

**`src/config/site.ts`** — tout le contenu. Aucun texte n'est écrit en dur dans un composant.

**`src/lib/simulator.ts`** — tous les barèmes. Ce fichier produit *à la fois* les montants par
défaut de la page (via le profil de référence) et le résultat personnalisé du simulateur. C'est la
même fonction dans les deux cas : le §01, le grand livre, le §06 et l'image OG ne peuvent pas se
contredire. Modifier un barème met tout à jour d'un coup.

---

## Rebrander en 15 minutes

Pour un autre cabinet, dans l'ordre :

1. **`src/config/site.ts` — `identity`** : nom, ville, zone, adresse, téléphone, e-mail, SIREN,
   horaires, coordonnées géographiques. *(2 min)*
2. **`plans`** : les trois formules, leurs prix mensuels et leur contenu. L'ordre compte — la plus
   complète en premier, `highlight: true` sur celle que le cabinet veut voir choisie. *(3 min)*
3. **`expert`** : les associés, leurs numéros d'inscription à l'Ordre, les domaines, les communes.
   Pour une vraie photographie : posez le fichier dans `public/media/` et renseignez
   `expert.person.portrait`. Sans photo, le cadre affiche la fiche d'inscription au tableau,
   composée en typographie du site. *(3 min)*
4. **`cases`** : les trois dossiers, avec des chiffres réels et anonymisés. **Puis passez `demo` à
   `false`** en haut du fichier : les mentions de démonstration disparaissent. *(4 min)*
5. **`objections`, `hero`, `cost`, `craft`, `contact`** : la copy. *(le temps qu'il faut)*
6. **`meta`** — puis recopiez `title` et `description` dans `index.html` (elles y sont en dur pour
   le premier paint ; un commentaire le rappelle sur place). *(1 min)*
7. **`npm run og`** pour régénérer l'image de partage avec les nouveaux chiffres. *(1 min)*

### Changer les couleurs

Les six couleurs sont déclarées **à deux endroits, volontairement identiques** :

- `src/index.css`, bloc `@theme` — c'est de là que Tailwind génère les classes (`bg-paper`,
  `text-stamp`…) ;
- `src/config/site.ts`, objet `palette` — lu par la scène 3D et par le script OG, qui ne
  passent pas par Tailwind.

Modifiez les deux. Trois règles à tenir, sans quoi le système s'effondre :

- `--stamp` porte **tous** les appels à l'action et **rien d'autre** ;
- `--debit` n'apparaît **que** sur un montant porté au débit ou un solde négatif ;
- tout le reste est `--ink` sur `--paper`.

Le thème Tailwind repart de zéro (`--color-*: initial`) : aucune couleur par défaut n'existe dans
ce projet. `bg-slate-500` ne compile pas. C'est voulu — on ne peut pas introduire une couleur hors
charte par accident.

### Brancher le formulaire

Le formulaire du §08 et la capture d'e-mail du §03 n'envoient rien. Deux points d'accroche, tous
les deux commentés dans le code :

- `src/components/SectionContact.tsx`, fonction `onSubmit` ;
- `src/components/SectionSim.tsx`, `onSubmit` du bloc « capture ».

Remplacez l'appel local par votre endpoint. Tant que `demo` vaut `true`, le site affiche à côté de
chaque formulaire qu'aucune donnée n'est transmise — ne passez `demo` à `false` qu'une fois l'envoi
réellement branché.

---

## Ce que le site tient

**Accessibilité.** Contrastes AA vérifiés par le calcul sur chaque niveau de texte atténué (les
paliers non conformes ont été remontés : 65 % sur `--paper`, 55 % sur `--ink`). Plan de titres
h1→h4 sans saut. Tous les champs ont un `<label for>` réel. Focus clavier visible et dessiné —
ni l'`outline` par défaut, ni `outline: none`. Résultats du simulateur en `aria-live="polite"`.
Le grand livre annonce son solde une seule fois, par un résumé textuel.

**Mouvement réduit.** Sous `prefers-reduced-motion`, Lenis n'est pas monté, le hero cesse d'être
une piste de scroll de 240 vh et redevient un écran, la balance s'affiche directement à l'équilibre
et la boucle de rendu 3D s'arrête après une frame. Le texte de relance change lui aussi : promettre
un mouvement qui n'aura pas lieu serait faux.

**Replis.** Sans WebGL, la scène est remplacée par un dessin vectoriel de la balance à l'équilibre.
Pendant le chargement du chunk 3D, un tracé en fil de fer se dessine — jamais un spinner.

**Responsive.** Vérifié sans débordement horizontal de 360 à 2560 px. Le grand livre est un rail
en colonne sur desktop et une barre basse dépliable sur mobile — deux comportements distincts, pas
une réduction. La scène 3D est recadrée et allégée en portrait (14 documents au lieu de 30, pas
d'antialiasing, résolution plafonnée).

**Performance.** La scène 3D est un chunk séparé, demandé après le premier paint et seulement si
WebGL répond. Aucune texture, aucun modèle chargé : toute la géométrie est générée. Aucune requête
réseau vers un tiers, polices comprises (elles viennent de `node_modules` via `@fontsource`).

**Honnêteté.** Aucun compteur de visiteurs, aucun décompte, aucun avis ni logo inventé. Les règles
fiscales citées renvoient à leur article du Code général des impôts. Les estimations sont annoncées
comme telles et leurs hypothèses sont affichées. Le simulateur conclut honnêtement, y compris quand
il conclut que le visiteur n'a pas besoin du cabinet — cas réel : une micro-entreprise déjà suivie
obtient un solde négatif et le site le dit. Aucune case pré-cochée, et refuser de donner son e-mail
ne retire rien au résultat.

---

## Licences

Code : propriété MJAGENCY, pour démonstration.
Polices : Bricolage Grotesque, Public Sans et Martian Mono, toutes trois sous SIL Open Font
License 1.1. Voir `scripts/fonts/LICENSE.md` pour les instances statiques versionnées.
