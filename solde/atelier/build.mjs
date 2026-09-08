/**
 * Assemble l'atelier en une page autonome.
 *
 * Le bundle embarque le moteur comptable réel — le même code que testent les
 * 354 tests de la suite. Aucun script externe : la page doit s'ouvrir en cours,
 * sans réseau, depuis un fichier local comme depuis une URL.
 */
import { build } from 'esbuild'
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const ici = dirname(fileURLToPath(import.meta.url))
const sortie = process.argv[2] ?? resolve(ici, 'atelier.html')

const resultat = await build({
  entryPoints: [resolve(ici, 'src/main.ts')],
  bundle: true,
  format: 'iife',
  target: 'es2020',
  minify: true,
  write: false,
  logLevel: 'warning',
})

const js = resultat.outputFiles[0]?.text
if (!js) throw new Error('esbuild n’a rien produit')

const gabarit = await readFile(resolve(ici, 'index.html.tpl'), 'utf8')
const page = gabarit.replace('__BUNDLE__', () => js)

await writeFile(sortie, page, 'utf8')
console.log(`${sortie} — ${(page.length / 1024).toFixed(1)} ko, script ${(js.length / 1024).toFixed(1)} ko`)
