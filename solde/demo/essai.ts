/**
 * Page d'essai autonome de La Ligne et de La Balance.
 *
 * Elle importe le code de production — `parseLigne`, `construireLignes`,
 * `inclinaison`, `avancer` — et non une réimplémentation. Ce qui se joue ici
 * est exactement ce qui se joue dans l'application ; seule manque la couche
 * serveur, qui numérote, chaîne et enregistre.
 */

import {
  chercherComptes,
  construireLignes,
  parseLigne,
  type Brouillon,
  type LigneCompte,
  type LigneContexte,
  type ProposedLine,
} from '../lib/accounting/ligne'
import { formatAmount } from '../lib/accounting/money'
import { auRepos, avancer, inclinaison, type EtatRessort } from '../components/balance/ressort'
import { PCG } from '../prisma/data/pcg'

const COMPTES: LigneCompte[] = PCG.map((compte) => ({
  numero: compte.numero,
  libelle: compte.libelle,
  tauxTvaAttendu: compte.tauxTva ?? null,
}))

const CONTEXTE: LigneContexte = {
  comptes: COMPTES,
  tiers: [
    { code: 'FOUTOTAL', nom: 'Total Énergies', type: 'fournisseur' },
    { code: 'FOUORANGE', nom: 'Orange Business', type: 'fournisseur' },
    { code: 'FOUSCI', nom: 'SCI du Cherche-Midi', type: 'fournisseur' },
    { code: 'FOUPAPETERIE', nom: 'Papeterie Saint-Placide', type: 'fournisseur' },
    { code: 'CLIMERIDIEN', nom: 'Méridien Studio', type: 'client' },
    { code: 'CLIBASTIDE', nom: 'Bastide & Fils', type: 'client' },
    { code: 'CLINOVEA', nom: 'Novéa Conseil', type: 'client' },
  ],
  aujourdHui: new Date(),
}

const INTITULE: Record<string, string> = {
  sens: 'Sens',
  date: 'Date',
  montant: 'Montant',
  compte: 'Compte',
  tva: 'TVA',
  journal: 'Journal',
  tiers: 'Tiers',
  libelle: 'Libellé',
}

const $ = <T extends Element>(selecteur: string): T => {
  const element = document.querySelector<T>(selecteur)
  if (!element) throw new Error(`Élément absent : ${selecteur}`)
  return element
}

const champ = $<HTMLInputElement>('#ligne')
const zonePuces = $<HTMLDivElement>('#puces')
const zoneRaison = $<HTMLParagraphElement>('#raison')
const zoneEcriture = $<HTMLDivElement>('#ecriture')
const corps = $<HTMLTableSectionElement>('#lignes')
const totalDebit = $<HTMLElement>('#total-debit')
const totalCredit = $<HTMLElement>('#total-credit')
const etatEquilibre = $<HTMLElement>('#etat-equilibre')
const bouton = $<HTMLButtonElement>('#valider')
const journalEntete = $<HTMLElement>('#journal-entete')
const fleau = $<SVGGElement>('#fleau')
const plateauG = $<SVGGElement>('#plateau-gauche')
const plateauD = $<SVGGElement>('#plateau-droit')
const temoin = $<SVGCircleElement>('#temoin')
const annonce = $<HTMLElement>('#annonce')

let override: Partial<Brouillon> = {}
let derniereSaisie = ''
let cible = 0
let equilibree = false
let clac = 0

/** L'état courant, phrase analysée puis corrigée par les puces éditées. */
function etat(): {
  brouillon: Brouillon | null
  lignes: ProposedLine[]
  pesee: { debit: number; credit: number }
  chips: ReturnType<typeof parseLigne>['chips']
  raison: string
} {
  const analyse = parseLigne(champ.value, CONTEXTE)
  const brouillon = analyse.brouillon ? { ...analyse.brouillon, ...override } : null
  const lignes = brouillon ? construireLignes(brouillon) : []
  const pesee = brouillon
    ? {
        debit: lignes.reduce((total, ligne) => total + ligne.debit, 0),
        credit: lignes.reduce((total, ligne) => total + ligne.credit, 0),
      }
    : analyse.pesee
  return { brouillon, lignes, pesee, chips: analyse.chips, raison: analyse.raison }
}

function rendre(): void {
  if (champ.value !== derniereSaisie) {
    override = {}
    derniereSaisie = champ.value
  }

  const { brouillon, lignes, pesee, chips, raison } = etat()

  // ── Puces ────────────────────────────────────────────────────────────────
  zonePuces.replaceChildren()
  for (const chip of chips) {
    const puce = document.createElement('div')
    puce.className = 'puce'
    puce.dataset['kind'] = chip.kind
    if (chip.confiance < 700 && !(chip.kind in override)) puce.dataset['deduite'] = 'oui'

    const intitule = document.createElement('span')
    intitule.className = 'surtitre'
    intitule.textContent = INTITULE[chip.kind] ?? chip.kind

    const valeur = document.createElement('span')
    valeur.className = chip.kind === 'montant' || chip.kind === 'compte' ? 'chiffre valeur' : 'valeur'
    valeur.textContent = libelleDeLaPuce(chip.kind, chip.label, brouillon)

    puce.append(intitule, valeur)

    // Seules les puces réellement éditables ici sont interactives : mentir sur
    // une affordance est pire que de ne pas l'offrir.
    if (brouillon && (chip.kind === 'compte' || chip.kind === 'tva' || chip.kind === 'montant')) {
      puce.tabIndex = 0
      puce.setAttribute('role', 'button')
      puce.dataset['editable'] = 'oui'
      const ouvrir = (): void => editer(chip.kind, brouillon, puce)
      puce.addEventListener('click', ouvrir)
      puce.addEventListener('keydown', (evenement) => {
        if (evenement.key === 'Enter' || evenement.key === ' ') {
          evenement.preventDefault()
          ouvrir()
        }
      })
    }
    zonePuces.append(puce)
  }

  zoneRaison.textContent = raison

  // ── Écriture ─────────────────────────────────────────────────────────────
  corps.replaceChildren()
  for (const ligne of lignes) {
    const rang = document.createElement('tr')
    rang.innerHTML = `
      <td class="chiffre">${ligne.accountNumero}</td>
      <td class="libelle">${echapperHtml(ligne.libelle)}</td>
      <td class="chiffre montant debit">${ligne.debit === 0 ? '—' : formatAmount(ligne.debit)}</td>
      <td class="chiffre montant credit">${ligne.credit === 0 ? '—' : formatAmount(ligne.credit)}</td>`
    corps.append(rang)
  }
  zoneEcriture.hidden = lignes.length === 0
  totalDebit.textContent = formatAmount(pesee.debit)
  totalCredit.textContent = formatAmount(pesee.credit)
  journalEntete.textContent = brouillon
    ? `${brouillon.journalCode} · ${brouillon.date.toLocaleDateString('fr-FR', { timeZone: 'UTC' })}`
    : ''

  // ── Balance ──────────────────────────────────────────────────────────────
  const vide = pesee.debit === 0 && pesee.credit === 0
  equilibree = !vide && pesee.debit === pesee.credit
  cible = vide ? 0 : inclinaison(pesee.debit, pesee.credit)

  etatEquilibre.textContent = equilibree ? 'Équilibrée' : 'Déséquilibrée'
  bouton.disabled = !equilibree
  annonce.textContent = vide
    ? ''
    : equilibree
      ? `Balance à l’équilibre, ${formatAmount(pesee.debit)} de chaque côté.`
      : `Balance déséquilibrée de ${formatAmount(Math.abs(pesee.debit - pesee.credit))}.`
}

function libelleDeLaPuce(kind: string, defaut: string, brouillon: Brouillon | null): string {
  if (!brouillon) return defaut
  switch (kind) {
    case 'montant':
      return formatAmount(brouillon.montantTtc)
    case 'compte': {
      const compte = COMPTES.find((item) => item.numero === brouillon.compteNumero)
      return compte ? `${compte.numero} ${compte.libelle}` : brouillon.compteNumero
    }
    case 'tva':
      return brouillon.tauxTva === 0
        ? 'Sans TVA'
        : `TVA ${(brouillon.tauxTva / 1000).toString().replace('.', ',')} %`
    case 'libelle':
      return brouillon.libelle
    default:
      return defaut
  }
}

// ── Édition d'une puce ──────────────────────────────────────────────────────

let panneauOuvert: HTMLElement | null = null

function fermerPanneau(): void {
  panneauOuvert?.remove()
  panneauOuvert = null
}

function editer(kind: string, brouillon: Brouillon, ancre: HTMLElement): void {
  fermerPanneau()
  const panneau = document.createElement('div')
  panneau.className = 'panneau'
  panneau.setAttribute('role', 'dialog')

  const appliquer = (champs: Partial<Brouillon>): void => {
    override = { ...override, ...champs }
    fermerPanneau()
    rendre()
    champ.focus()
  }

  if (kind === 'tva') {
    panneau.append(titre('Taux de TVA'))
    for (const [valeur, libelle] of [
      [20000, '20 %'],
      [10000, '10 %'],
      [5500, '5,5 %'],
      [2100, '2,1 %'],
      [0, 'Sans TVA'],
    ] as const) {
      panneau.append(
        option(libelle, valeur === brouillon.tauxTva, () => appliquer({ tauxTva: valeur })),
      )
    }
  } else if (kind === 'montant') {
    panneau.append(titre('Montant TTC'))
    const saisie = document.createElement('input')
    saisie.className = 'chiffre saisie-panneau'
    saisie.value = formatAmount(brouillon.montantTtc)
    saisie.addEventListener('keydown', (evenement) => {
      if (evenement.key !== 'Enter') return
      evenement.preventDefault()
      const centimes = Math.round(Number(saisie.value.replace(/[^\d,.-]/g, '').replace(',', '.')) * 100)
      if (Number.isSafeInteger(centimes) && centimes > 0) appliquer({ montantTtc: centimes })
    })
    panneau.append(saisie)
    panneau.append(aide('Entrée pour appliquer'))
    setTimeout(() => saisie.focus(), 0)
  } else {
    panneau.append(titre('Compte d’imputation'))
    const recherche = document.createElement('input')
    recherche.className = 'chiffre saisie-panneau'
    recherche.placeholder = '606 ou « carburant »'
    const liste = document.createElement('div')
    liste.className = 'liste'
    const remplir = (): void => {
      liste.replaceChildren()
      const trouves = chercherComptes(recherche.value, COMPTES, 7)
      if (trouves.length === 0) {
        liste.append(aide('Aucun compte ne correspond.'))
        return
      }
      for (const compte of trouves) {
        liste.append(
          option(
            `${compte.numero} · ${compte.libelle}`,
            compte.numero === brouillon.compteNumero,
            () =>
              appliquer({
                compteNumero: compte.numero,
                ...(compte.tauxTvaAttendu != null ? { tauxTva: compte.tauxTvaAttendu } : {}),
              }),
          ),
        )
      }
    }
    recherche.addEventListener('input', remplir)
    panneau.append(recherche, liste)
    remplir()
    setTimeout(() => recherche.focus(), 0)
  }

  ancre.append(panneau)
  panneauOuvert = panneau
}

function titre(texte: string): HTMLElement {
  const element = document.createElement('p')
  element.className = 'surtitre titre-panneau'
  element.textContent = texte
  return element
}

function aide(texte: string): HTMLElement {
  const element = document.createElement('p')
  element.className = 'aide'
  element.textContent = texte
  return element
}

function option(libelle: string, courante: boolean, surClic: () => void): HTMLElement {
  const bouton = document.createElement('button')
  bouton.type = 'button'
  bouton.className = 'option'
  if (courante) bouton.dataset['courante'] = 'oui'
  bouton.textContent = libelle
  bouton.addEventListener('click', (evenement) => {
    evenement.stopPropagation()
    surClic()
  })
  return bouton
}

function echapperHtml(valeur: string): string {
  const div = document.createElement('div')
  div.textContent = valeur
  return div.innerHTML
}

// ── Animation de La Balance ─────────────────────────────────────────────────

const ANGLE_MAX_DEGRES = 18
const mouvementReduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches
let ressort: EtatRessort = { valeur: 0, vitesse: 0 }
let etaitEquilibree = false
let dernierTemps = 0

function peindre(angleDegres: number, pose: boolean): void {
  const decalage = Math.sin((angleDegres * Math.PI) / 180) * 46
  fleau.setAttribute('transform', `rotate(${-angleDegres} 110 56)`)
  plateauG.setAttribute('transform', `translate(0 ${-decalage})`)
  plateauD.setAttribute('transform', `translate(0 ${decalage})`)
  temoin.setAttribute('fill', equilibree && pose ? 'var(--vert-sourd)' : 'var(--terre)')
  const pulsation = 1 + clac * 0.9
  temoin.setAttribute('r', String(7 * pulsation))
}

function image(temps: number): void {
  const delta = dernierTemps === 0 ? 1 / 60 : (temps - dernierTemps) / 1000
  dernierTemps = temps

  if (equilibree && !etaitEquilibree) clac = 1
  etaitEquilibree = equilibree
  clac = Math.max(0, clac - delta * 4)

  const angleCible = cible * ANGLE_MAX_DEGRES
  ressort = avancer(ressort, angleCible, delta)
  peindre(ressort.valeur, auRepos(ressort, angleCible))
  requestAnimationFrame(image)
}

// ── Validation ──────────────────────────────────────────────────────────────

const noteServeur = $<HTMLParagraphElement>('#note-serveur')

/**
 * Le bouton fait ce qu'il peut faire, et le dit. Une page statique n'a pas de
 * base : prétendre enregistrer serait un mensonge d'interface, et un bouton
 * qui ment coûte plus cher qu'un bouton absent.
 */
function tenterValidation(): void {
  const { brouillon, pesee } = etat()
  if (!brouillon || !equilibree) return
  noteServeur.textContent =
    `Balance à l’équilibre, ${formatAmount(pesee.debit)} de chaque côté : la validation s’ouvre. ` +
    `Dans l’application, l’écriture partirait au serveur — contrôle, numéro de séquence ` +
    `dans le journal ${brouillon.journalCode}, maillon SHA-256 chaîné au précédent. ` +
    `Cette page n’a pas de base : rien n’est enregistré.`
}

bouton.addEventListener('click', tenterValidation)

champ.addEventListener('keydown', (evenement) => {
  if (evenement.key === 'Enter' && equilibree) {
    evenement.preventDefault()
    tenterValidation()
  }
})

// ── Démarrage ───────────────────────────────────────────────────────────────

champ.addEventListener('input', () => {
  fermerPanneau()
  noteServeur.textContent = ''
  rendre()
})

document.addEventListener('click', (evenement) => {
  if (panneauOuvert && evenement.target instanceof Node && !panneauOuvert.contains(evenement.target)) {
    const dansUnePuce = (evenement.target as Element).closest?.('.puce')
    if (!dansUnePuce) fermerPanneau()
  }
})

document.addEventListener('keydown', (evenement) => {
  if (evenement.key === 'Escape') fermerPanneau()
})

for (const exemple of document.querySelectorAll<HTMLButtonElement>('[data-exemple]')) {
  exemple.addEventListener('click', () => {
    champ.value = exemple.dataset['exemple'] ?? ''
    rendre()
    champ.focus()
  })
}

rendre()

if (mouvementReduit) {
  // § 9 : la balance devient statique. Elle garde son inclinaison, elle ne
  // l'anime pas — et un observateur la met à jour à chaque frappe.
  const majStatique = (): void => peindre(cible * ANGLE_MAX_DEGRES, true)
  champ.addEventListener('input', () => setTimeout(majStatique, 0))
  new MutationObserver(majStatique).observe(zonePuces, { childList: true, subtree: true })
  majStatique()
} else {
  requestAnimationFrame(image)
}
