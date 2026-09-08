/**
 * Chaînage cryptographique du registre.
 *
 * Esprit de l'article 286-I-3° bis du CGI (loi anti-fraude TVA) : le logiciel
 * doit garantir l'inaltérabilité, la sécurisation, la conservation et
 * l'archivage des données. Ici, chaque écriture validée porte le hash de la
 * précédente. Modifier une écriture du passé, en supprimer une, ou en
 * intercaler une, casse la chaîne à partir de ce point — et `verifyChain` le
 * dit, en désignant le maillon.
 *
 * L'empreinte ne dépend que du contenu comptable (date, journal, numéro,
 * libellé, lignes). Elle ignore délibérément les métadonnées mutables
 * (identifiants techniques, horodatage de mise à jour) : sinon un simple
 * `updatedAt` invaliderait la chaîne sans qu'aucun chiffre n'ait bougé.
 */

import { createHash } from 'node:crypto'
import { formatPlain, type Cents } from './money'

export const GENESIS_HASH = '0'.repeat(64)

export interface ChainableLine {
  readonly accountNumero: string
  readonly debit: Cents
  readonly credit: Cents
  readonly libelle: string
}

export interface ChainableEntry {
  readonly journalCode: string
  readonly numero: number
  readonly date: Date
  readonly libelle: string
  readonly pieceRef: string | null
  readonly lines: readonly ChainableLine[]
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/**
 * Empreinte canonique, lisible, stable. Le format est volontairement textuel :
 * un contrôleur fiscal doit pouvoir recalculer un hash à la main avec
 * `sha256sum`, sans exécuter notre code.
 */
export function fingerprint(entry: ChainableEntry): string {
  const head = [entry.journalCode, String(entry.numero), isoDay(entry.date), entry.libelle, entry.pieceRef ?? '']
  const lines = entry.lines.map((line) =>
    [line.accountNumero, formatPlain(line.debit), formatPlain(line.credit), line.libelle].join('~'),
  )
  return [head.join('~'), ...lines].join('\n')
}

export function computeHash(entry: ChainableEntry, previousHash: string): string {
  return createHash('sha256').update(`${fingerprint(entry)}\n@${previousHash}`, 'utf8').digest('hex')
}

export interface ChainedEntry extends ChainableEntry {
  readonly chainIndex: number
  readonly hash: string
  readonly hashPrecedent: string
}

/** Chaîne une suite d'écritures depuis un maillon donné (reprise de chaîne incluse). */
export function chain(
  entries: readonly ChainableEntry[],
  startFrom: { hash: string; index: number } = { hash: GENESIS_HASH, index: 0 },
): ChainedEntry[] {
  let previousHash = startFrom.hash
  let index = startFrom.index
  const result: ChainedEntry[] = []
  for (const entry of entries) {
    index += 1
    const hash = computeHash(entry, previousHash)
    result.push({ ...entry, chainIndex: index, hash, hashPrecedent: previousHash })
    previousHash = hash
  }
  return result
}

export type ChainBreak =
  | { readonly kind: 'hash_altere'; readonly chainIndex: number; readonly attendu: string; readonly trouve: string }
  | { readonly kind: 'maillon_rompu'; readonly chainIndex: number; readonly attendu: string; readonly trouve: string }
  | { readonly kind: 'index_manquant'; readonly chainIndex: number }
  | { readonly kind: 'index_duplique'; readonly chainIndex: number }

export interface ChainVerdict {
  readonly ok: boolean
  readonly verifiees: number
  readonly ruptures: readonly ChainBreak[]
  /** Dernier hash valide : point de reprise pour rechaîner. */
  readonly dernierHash: string
}

/**
 * Recalcule toute la chaîne et désigne la moindre altération.
 * C'est ce que fait `npm run solde:verify`.
 */
export function verifyChain(
  entries: readonly ChainedEntry[],
  genesis: string = GENESIS_HASH,
): ChainVerdict {
  const ordered = [...entries].sort((a, b) => a.chainIndex - b.chainIndex)
  const ruptures: ChainBreak[] = []
  let previousHash = genesis
  let expectedIndex = ordered.length > 0 ? (ordered[0]?.chainIndex ?? 1) : 1
  let dernierHash = genesis
  let verifiees = 0

  for (const entry of ordered) {
    if (entry.chainIndex > expectedIndex) {
      for (let missing = expectedIndex; missing < entry.chainIndex; missing += 1) {
        ruptures.push({ kind: 'index_manquant', chainIndex: missing })
      }
    } else if (entry.chainIndex < expectedIndex) {
      ruptures.push({ kind: 'index_duplique', chainIndex: entry.chainIndex })
    }
    expectedIndex = entry.chainIndex + 1

    if (entry.hashPrecedent !== previousHash) {
      ruptures.push({
        kind: 'maillon_rompu',
        chainIndex: entry.chainIndex,
        attendu: previousHash,
        trouve: entry.hashPrecedent,
      })
    }

    const recomputed = computeHash(entry, entry.hashPrecedent)
    if (recomputed !== entry.hash) {
      ruptures.push({
        kind: 'hash_altere',
        chainIndex: entry.chainIndex,
        attendu: recomputed,
        trouve: entry.hash,
      })
    } else {
      verifiees += 1
    }

    previousHash = entry.hash
    dernierHash = entry.hash
  }

  return { ok: ruptures.length === 0, verifiees, ruptures, dernierHash }
}

export function describeBreak(rupture: ChainBreak): string {
  switch (rupture.kind) {
    case 'hash_altere':
      return `Écriture n° ${rupture.chainIndex} : le contenu a été modifié après validation.`
    case 'maillon_rompu':
      return `Écriture n° ${rupture.chainIndex} : le maillon précédent ne correspond pas — une écriture a été supprimée ou intercalée.`
    case 'index_manquant':
      return `Écriture n° ${rupture.chainIndex} absente de la chaîne.`
    case 'index_duplique':
      return `Écriture n° ${rupture.chainIndex} présente deux fois dans la chaîne.`
  }
}
