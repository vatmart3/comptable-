# DESIGN.md — Cabinet Ferrand & Solère

Pièce de démonstration. Site vitrine d'un cabinet d'expertise comptable, Sète / Bassin de Thau.

---

## 1. Le plan de design (15 lignes)

**Concept.** *La balance.* En français le mot dit les deux choses à la fois : l'instrument qui pèse
et la balance comptable, moment où débit et crédit s'équilibrent. Le concept n'habille pas la page,
il **est** la page : le document entier est un registre, et le visiteur y est une écriture non soldée.

**Palette — « papier de registre ».** Froide, institutionnelle, jamais chaleureuse.

| Token | Hex | Rôle |
|---|---|---|
| `--paper` | `#E9EDE6` | fond principal, le vert-gris du papier réglé |
| `--paper-hi` | `#F7F8F5` | surfaces surélevées, champs, colonnes de registre |
| `--ink` | `#14201B` | texte et structure, presque noir teinté vert |
| `--stamp` | `#23347A` | bleu d'encre de tampon administratif — **tous les CTA, et rien d'autre** |
| `--debit` | `#A83A2C` | rouge de report — **uniquement un montant au débit** |
| `--rule` | `#C3CCBE` | filets, séparateurs, quadrillage |

**Typographie — trois rôles, aucune police par défaut.**
*Display* : Bricolage Grotesque variable, axe `opsz` réellement piloté (96 sur le hero, 14 sur les
petits titres) — une grotesque qui se resserre en grand, jamais décorative.
*Texte* : Public Sans — dessinée pour l'administration américaine, lisible, sans opinion.
*Données* : Martian Mono — chiffres, libellés de registre, eyebrows, navigation.
Toutes les valeurs numériques du site sont en `tabular-nums`. Les chiffres ne dansent jamais.

**Layout, en une phrase.** Le contenu ne se centre nulle part : il s'aligne à gauche sur une colonne
de libellé fixe et les montants tombent à droite sur une colonne de chiffres, séparés par des filets
de 1 px — la mise en page d'un livre de comptes, pas d'une landing page. Rayon de bordure : 0 partout,
sauf 2 px sur les champs de formulaire — seul endroit du site que l'on touche, donc seul endroit qui
s'adoucit.

**Élément signature.** Le **grand livre vivant** : un rail fixe en bord d'écran, colonnes
`DATE · LIBELLÉ · DÉBIT · CRÉDIT`, qui écrit une écriture réelle à chaque section franchie et
recalcule un solde à l'odomètre. La dernière ligne reste ouverte, en pointillés — le document est
littéralement inachevé tant que le visiteur n'a pas pris rendez-vous.

## 2. Wireframe

```
┌──────────────────────────────────────────────────────────────┬──────────────────┐
│ FERRAND & SOLÈRE  SOMMAIRE 01 02 03 04 05 06 07  [08 RDV]    │  GRAND LIVRE     │
├──────────────────────────────────────────────────────────────┤  SOLDE  +1 182   │
│                                                              │ ──────────────── │
│            [ scène 3D — balance en déséquilibre ]            │ 31/01 Temps   D  │
│                  plateau gauche effondré                     │ 28/02 Déduct. D  │
│                                                              │ 15/03 Majora. D  │
│  « Vous pilotez à vue. »          ← texte plaqué bas-gauche  │ 30/04 Arbitr. C  │
├──────────────────────────────────────────────────────────────┤ ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄ │
│ 01 │ CE QUE LE DÉSORDRE VOUS COÛTE                           │ ┄ écriture en    │
│    │ Le temps que vous y passez ……………………………  3 780 €        │ ┄ attente ┄┄┄┄┄ │
│    │ Ce que personne ne réclame ……………………………  1 890 €        │                  │
│    │ Les retards ……………………………………………………………   740 €        │                  │
├──────────────────────────────────────────────────────────────┤                  │
│ 02 │ ███ FOND ENCRE — ce que vous croyez / ce que vous achetez│                  │
├──────────────────────────────────────────────────────────────┤                  │
│ 03 │ SIMULATEUR — 5 questions, une par écran                 │                  │
│ 04 │ CADRE 4/5 PLEIN         │ n° Ordre, communes, domaines  │                  │
│ 05 │ 3 DOSSIERS en écritures │ 06 HONORAIRES 690 / 259 / 189 │                  │
│ 07 │ OBJECTIONS  08 │ FORMULAIRE → solde de l'écriture       │                  │
└──────────────────────────────────────────────────────────────┴──────────────────┘
```

---

## 3. Critique du plan — « aurais-je livré ça à un avocat, un dentiste, une agence immobilière ? »

C'est le test que je me suis imposé décision par décision. Trois réponses ont été « oui ». Elles ont
été corrigées.

**Défaut 1 — la section coûts était une grille de trois cartes.**
Trois coûts, trois cartes, une icône, un montant. J'aurais livré exactement ça à un avocat
(« ce qu'un litige non anticipé vous coûte ») et à un dentiste. Donc ce n'était pas un choix, c'était
un réflexe. **Corrigé** : les trois coûts sont trois *lignes d'écriture*, libellé à gauche, montant à
droite, filet entre les deux, sur toute la largeur. Aucune boîte. La forme vient du plan comptable,
pas du système de composants — et elle rend le montant plus dur, parce qu'il est aligné avec les
autres montants du site au pixel près.

**Défaut 2 — le simulateur était un formulaire multi-étapes avec barre de progression.**
Générique et transposable tel quel à n'importe quel métier. **Corrigé** : les cinq questions sont
posées comme un **questionnaire d'ouverture de dossier**, une par écran, numérotées en Martian Mono,
et chaque réponse s'inscrit immédiatement dans le grand livre — le visiteur voit son dossier s'ouvrir
pendant qu'il répond. La progression n'est pas une barre, c'est un registre qui se remplit. Le
mécanisme d'engagement est le même, mais il est en langage comptable.

**Défaut 3 — la palette était crédible mais empruntée.**
J'étais parti sur un beige papier chaud. C'est-à-dire exactement la signature « papier + serif +
terracotta » interdite au §1, et c'est aussi la palette d'un cabinet d'avocats et d'une agence
immobilière haut de gamme. **Corrigé** : je suis allé chercher la couleur dans le matériau réel du
métier — le papier de registre comptable français est **vert-gris**, pas crème, et l'encre des
tampons administratifs est un **bleu outremer sourd**, pas un bleu corporate. Le rouge n'est pas un
accent de marque : c'est le rouge de report, et il n'a le droit d'apparaître **que** sur un montant
négatif. La discipline chromatique est ce qui rend la page crédible : trois couleurs seulement
portent du sens, et chacune n'en porte qu'un.

Deux autres corrections mineures : le footer en quatre colonnes est devenu un **pied de registre**
(double filet de clôture, totaux débit / crédit / solde) ; la navigation déroulante est devenue une
**ligne de sommaire** paginée, parce qu'un registre a un sommaire, pas un menu.

---

## 4. Pourquoi ces choix pour ce métier précisément

**Parce que le métier a déjà une forme, et qu'elle est excellente.** Un livre de comptes est un objet
de design remarquable : deux colonnes, un ordre chronologique irréversible, des filets, des chiffres
alignés, une contrainte formelle absolue — ça doit tomber juste. Cette forme a quatre cents ans, elle
est immédiatement lisible par un dirigeant, et personne ne l'utilise sur le web. Il n'y avait rien à
inventer, il fallait la prendre au sérieux. C'est pour ça que la grille est asymétrique, que les
montants sont à droite, que le rayon de bordure est nul et que les filets font tout le travail de
structure : ce ne sont pas des partis pris esthétiques, ce sont les règles du document.

**Parce que le déséquilibre est le seul argument.** Personne ne se lève le matin en voulant acheter
de la comptabilité. On appelle un expert-comptable quand quelque chose penche. La scène 3D du hero ne
montre donc pas le cabinet, elle montre **l'état du visiteur** : un plateau qui s'effondre sous des
papiers en désordre. Et elle se redresse à mesure qu'il descend la page. Le mouvement du site est
l'argument du site. C'est aussi pour ça que le hero n'a pas de titre centré ni de double bouton : à
cet instant, on n'a rien à vendre, on a quelque chose à faire reconnaître.

**Parce que la crédibilité d'un chiffre est le produit.** Un cabinet vend de la fiabilité numérique.
Un site qui laisse ses chiffres sauter, changer de police ou se contredire d'une section à l'autre
détruit la thèse. D'où : `tabular-nums` partout, un odomètre qui roule au lieu de sauter, et surtout
un **modèle de calcul unique** (`src/lib/simulator.ts`) qui produit à la fois les valeurs par défaut
de la page et le résultat du simulateur. Les chiffres du §01 ne sont pas écrits en dur : ce sont ceux
du profil de référence passé dans le même modèle. Il est structurellement impossible que le site se
contredise.

**Parce que la boucle ouverte est honnête ici.** L'effet Zeigarnik est souvent un gadget. Sur un site
de comptable, une écriture non soldée n'est pas une métaphore : c'est un vrai problème professionnel,
que le visiteur reconnaît. Le registre reste ouvert, la ligne en pointillés dit `— écriture en
attente —`, et elle ne se solde qu'à la prise de rendez-vous. La récompense n'est pas un confetti,
c'est un trait de clôture.

**Enfin, l'audace est concentrée en un seul endroit** — le hero 3D et le rail. Tout le reste est
d'une discipline stricte : un seul niveau de gris, un seul accent, aucune ombre, aucun arrondi,
aucune icône décorative. Un cabinet d'expertise comptable ne se vend pas en criant. Il se vend en
montrant qu'il tient une ligne.

---

## 5. Trois arbitrages pris pendant la fabrication

Le plan ne survit jamais entier au code. Trois décisions ont été tranchées en cours de route,
et elles méritent d'être dites plutôt que masquées.

**Le portrait de la §04 n'est pas une photographie.** Le cahier des charges demandait un vrai
portrait plein cadre. Il interdisait aussi les photos de banque d'images — et le cabinet est
fictif. Publier le visage d'une personne réelle sous un faux nom et un faux numéro d'inscription
à l'Ordre n'était pas envisageable ; fabriquer un visage non plus, pour la même raison. Le cadre
4/5 est donc occupé par la **fiche d'inscription au tableau de l'Ordre**, composée dans la
typographie du site sur fond d'encre, avec sa trame de similigravure obtenue en CSS. Le
traitement, le cadre et les repères d'impression sont ceux prévus pour la photographie : un
cabinet réel renseigne `expert.person.portrait` et récupère exactement la mise en page voulue,
photo comprise. C'est une contrainte d'honnêteté qui a produit un meilleur objet.

**Le hero a perdu sa phrase longue.** « Vous ne savez pas ce que votre entreprise a gagné le mois
dernier » occupait trois lignes et traversait la balance : la scène et le texte se détruisaient
mutuellement. La phrase est devenue **« Vous pilotez à vue. »**, et ce qu'elle a perdu en détail
elle l'a rendu en violence. Le détail est passé dans la ligne du dessous, où il est à sa place.

**Le sommaire ne montre plus tous ses libellés.** À 1440 px, huit libellés plus le rail du grand
livre ne tiennent pas — ils se tronquaient. Le sommaire affiche donc les folios, et déplie le
libellé de celui où l'on se trouve ; tout revient à partir de 1536 px. Et le folio 08 n'est plus
une entrée de liste : c'est le bouton d'action lui-même. Un registre se termine par l'écriture
qu'il reste à passer.

---

## 6. Ce que le site refuse de faire (§4 du cahier des charges)

Aucun faux compteur de visiteurs, aucun décompte, aucun avis inventé, aucun logo client.
Les trois dossiers du §05 sont annoncés comme illustratifs et ne désignent personne. Les données
sectorielles sont annoncées comme des estimations, et les règles fiscales citées renvoient à leur
article du Code général des impôts. Le simulateur conclut honnêtement — y compris quand il conclut
que le visiteur n'a pas besoin du cabinet, ce qui arrive réellement (micro-entreprise déjà suivie :
le solde devient négatif et le site le dit). Le formulaire ne transmet rien et l'annonce.
Aucun consentement pré-coché, aucune case cachée, et le refus de donner son e-mail après le
simulateur n'entraîne aucune perte de résultat.
