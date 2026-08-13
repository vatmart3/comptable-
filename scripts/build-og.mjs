/**
 * Génère `public/og.png` (1200 × 630), l'image de partage.
 *
 *   npm run og
 *
 * Deux partis pris :
 *
 * 1. L'image n'est pas une carte de visite, c'est un extrait du grand livre.
 *    Ce que le lecteur voit dans son fil est exactement ce que le site fait :
 *    trois débits chiffrés, et un solde après intervention.
 *
 * 2. Les montants ne sont pas écrits en dur. Le script importe le vrai modèle
 *    de calcul et le vrai profil de référence depuis `src/config/site.ts`.
 *    Changer un barème met l'image à jour au prochain `npm run og` — elle ne
 *    peut pas se mettre à raconter autre chose que la page.
 *
 * Les polices sont celles du site, converties en instances statiques dans
 * `scripts/fonts/` (Bricolage Grotesque et Martian Mono, OFL 1.1). Aucune
 * police système n'est employée.
 */

import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))

/* fontconfig lit sa configuration à l'initialisation de la librairie, donc avant
   tout `import sharp`. On écrit une configuration ne contenant QUE les deux
   polices du site — chemins absolus, `prefix="default"` n'étant pas fiable d'une
   version à l'autre — puis on se relance une fois avec l'environnement voulu. */
if (!process.env.FONTCONFIG_FILE) {
  const conf = resolve(HERE, '.fonts.conf')
  writeFileSync(
    conf,
    `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd">
<fontconfig>
  <dir>${resolve(HERE, 'fonts')}</dir>
  <cachedir>${resolve(HERE, '.fontcache')}</cachedir>
</fontconfig>
`,
  )
  const r = spawnSync(
    process.execPath,
    ['--experimental-strip-types', '--no-warnings', fileURLToPath(import.meta.url)],
    { stdio: 'inherit', env: { ...process.env, FONTCONFIG_FILE: conf } },
  )
  process.exit(r.status ?? 1)
}

const sharp = (await import('sharp')).default
const { referenceProfile, identity, ledgerLines, hero } = await import('../src/config/site.ts')

const P = {
  paper: '#E9EDE6',
  paperHi: '#F7F8F5',
  ink: '#14201B',
  stamp: '#23347A',
  debit: '#A83A2C',
  rule: '#C3CCBE',
}

const DISPLAY = 'BricolageOG'
const MONO = 'MartianOG'

const eur = (n) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
    .format(n)
    .replace(/ | /g, ' ')

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/* Les trois débits du §01, lus dans le registre lui-même. */
const debits = ledgerLines
  .filter((l) => l.side === 'debit' && l.id.startsWith('cost-'))
  .map((l) => ({ date: l.date, label: l.label, amount: l.amount(referenceProfile) }))

const W = 1200
const H = 630
const M = 64 // marge
const RAIL = 524 // colonne des montants

let y = 0
const rows = debits
  .map((d, i) => {
    const ry = 382 + i * 46
    return `
    <text x="${M}" y="${ry}" font-family="${MONO}" font-size="17" fill="${P.ink}" opacity="0.55">${d.date}</text>
    <text x="${M + 74}" y="${ry}" font-family="${MONO}" font-size="18" fill="${P.ink}">${esc(d.label)}</text>
    <text x="${M + RAIL}" y="${ry}" font-family="${MONO}" font-size="19" fill="${P.debit}" text-anchor="end">${esc(eur(d.amount))}</text>
    <line x1="${M}" y1="${ry + 15}" x2="${M + RAIL}" y2="${ry + 15}" stroke="${P.rule}" stroke-width="1"/>`
  })
  .join('')
y = 382 + debits.length * 46

/* Balance à l'équilibre, à droite : la même que sur le site, simplifiée. */
const bx = 930
const by = 300
const balance = `
  <g stroke="${P.ink}" stroke-width="2.5" fill="none" stroke-linecap="round">
    <path d="M ${bx - 150} ${by} h 300"/>
    <path d="M ${bx} ${by} v 150"/>
    <path d="M ${bx - 62} ${by + 150} h 124"/>
    <path d="M ${bx} ${by} v -46" stroke="${P.stamp}" stroke-width="4"/>
    <path d="M ${bx - 150} ${by} l -46 74 h 92 z" fill="${P.paperHi}"/>
    <path d="M ${bx + 150} ${by} l -46 74 h 92 z" fill="${P.paperHi}"/>
    <circle cx="${bx}" cy="${by}" r="9" fill="${P.rule}"/>
  </g>`

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${P.paper}"/>

  <line x1="${M}" y1="88" x2="${W - M}" y2="88" stroke="${P.ink}" stroke-width="1.5"/>
  <text x="${M}" y="72" font-family="${MONO}" font-size="16" letter-spacing="2.2" fill="${P.ink}">${esc(
    `${identity.legalName.toUpperCase()} · ${identity.kind.toUpperCase()} · ${identity.city.toUpperCase()}`,
  )}</text>

  ${balance}

  <text x="${M}" y="205" font-family="${DISPLAY}" font-size="78" fill="${P.ink}">Ce que le désordre</text>
  <text x="${M}" y="283" font-family="${DISPLAY}" font-size="78" fill="${P.ink}">vous coûte.</text>

  <line x1="${M}" y1="325" x2="${M + RAIL}" y2="325" stroke="${P.ink}" stroke-width="1.5"/>
  <text x="${M}" y="348" font-family="${MONO}" font-size="14" letter-spacing="2" fill="${P.ink}" opacity="0.55">DÉBIT · PROFIL DE RÉFÉRENCE</text>

  ${rows}

  <line x1="${M}" y1="${y + 26}" x2="${M + RAIL}" y2="${y + 26}" stroke="${P.ink}" stroke-width="1.5"/>
  <line x1="${M}" y1="${y + 30}" x2="${M + RAIL}" y2="${y + 30}" stroke="${P.ink}" stroke-width="1.5"/>
  <text x="${M}" y="${y + 62}" font-family="${MONO}" font-size="15" letter-spacing="1.6" fill="${P.ink}" opacity="0.6">SOLDE APRÈS INTERVENTION</text>
  <text x="${M + RAIL}" y="${y + 62}" font-family="${MONO}" font-size="26" fill="${P.stamp}" text-anchor="end">${esc(
    (referenceProfile.solde > 0 ? '+' : '') + eur(referenceProfile.solde),
  )}</text>
  <text x="${M}" y="${y + 88}" font-family="${MONO}" font-size="14" fill="${P.ink}" opacity="0.5">${esc(
    `et ${referenceProfile.hoursReturned} heures rendues par an`,
  )}</text>
</svg>`

const out = resolve(HERE, '../public/og.png')
mkdirSync(dirname(out), { recursive: true })
writeFileSync(resolve(HERE, '../public/og.svg'), svg)
await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(out)

console.log(`og.png — ${W}×${H} · solde ${eur(referenceProfile.solde)} · « ${hero.eyebrow} »`)
