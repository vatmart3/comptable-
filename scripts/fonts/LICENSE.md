# Polices incluses pour la génération de l'image OG

Ces deux fichiers sont des **instances statiques** générées à partir des polices
variables installées via `@fontsource-variable/*`. Ils ne servent qu'à
`npm run og` : le site, lui, charge les polices variables depuis `node_modules`.

Ils sont versionnés pour que `npm run og` fonctionne sans chaîne de conversion
(Python / fontTools) sur la machine qui régénère l'image.

| Fichier | Police d'origine | Instance | Licence |
|---|---|---|---|
| `BricolageGrotesque-OG.ttf` | Bricolage Grotesque | `opsz` 96, `wght` 560, `wdth` 97 | SIL Open Font License 1.1 |
| `MartianMono-OG.ttf` | Martian Mono | `wght` 500 | SIL Open Font License 1.1 |

Le nom de famille interne a été remplacé par `BricolageOG` et `MartianOG` : Pango
interprète les mots de style présents dans un nom de famille (« ExtraBold »,
« SemiExpanded ») comme une demande de graisse ou de chasse, et ne retrouvait
plus la police.

## Attributions

- **Bricolage Grotesque** — Copyright 2022 The Bricolage Grotesque Project
  Authors (https://github.com/ateliertriay/bricolage). SIL OFL 1.1.
- **Martian Mono** — Copyright 2022 The Martian Mono Project Authors
  (https://github.com/evilmartians/mono). SIL OFL 1.1.

Texte complet de la licence : https://openfontlicense.org

La SIL OFL 1.1 autorise la modification et la redistribution, y compris des
versions modifiées comme ces instances statiques, à condition que les fichiers
modifiés ne soient pas distribués sous le nom réservé de la police d'origine —
d'où le renommage en `BricolageOG` / `MartianOG`.
