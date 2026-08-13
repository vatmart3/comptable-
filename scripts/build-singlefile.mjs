/**
 * Assemble le site en UNE page autonome, à partir de `dist-single/`.
 *
 *   npx vite build --config vite.single.config.ts
 *   node scripts/build-singlefile.mjs
 *
 * Le fichier produit ne contient ni <!doctype>, ni <html>, ni <head>, ni <body> :
 * c'est un fragment de page, destiné à un hébergeur qui fournit l'enveloppe.
 * Tout est inliné — styles, script, polices en data: URI — donc la page ne fait
 * aucune requête réseau.
 *
 * ⚠ Cette variante n'est pas la version de production : le découpage en chunks
 *   est désactivé, la scène 3D n'est donc plus chargée en différé après le
 *   premier paint. Pour un hébergement réel, utiliser `npm run build`.
 */

import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const DIST = resolve(HERE, '../dist-single/assets')
const OUT = resolve(HERE, '../dist-single/page.html')

const files = readdirSync(DIST)
const cssFile = files.find((f) => f.endsWith('.css'))
const jsFile = files.find((f) => f.endsWith('.js'))
if (!cssFile || !jsFile) throw new Error('Build introuvable : lancez d’abord vite build.')

const css = readFileSync(resolve(DIST, cssFile), 'utf8')
const js = readFileSync(resolve(DIST, jsFile), 'utf8')

/* Un `</script` ou `</style` littéral fermerait la balise par surprise. */
const guard = (s, tag) => s.replaceAll(`</${tag}`, `<\\/${tag}`)

const html = `<title>Ferrand &amp; Solère</title>
<style>${guard(css, 'style')}</style>
<div id="root"></div>
<script type="module">${guard(js, 'script')}</script>
`

writeFileSync(OUT, html)
console.log(`page.html — ${(html.length / 1024 / 1024).toFixed(2)} Mo`)
