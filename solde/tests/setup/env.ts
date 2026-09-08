/**
 * Charge .env pour les tests d'intégration, sans dépendance supplémentaire.
 * Les tests unitaires du moteur n'en ont pas besoin — ils ne touchent rien.
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const chemin = resolve(process.cwd(), '.env')
if (existsSync(chemin)) {
  for (const ligne of readFileSync(chemin, 'utf8').split('\n')) {
    const match = ligne.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (!match?.[1]) continue
    const valeur = (match[2] ?? '').replace(/^["']|["']$/g, '')
    if (process.env[match[1]] === undefined) process.env[match[1]] = valeur
  }
}
