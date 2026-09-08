/**
 * L'ATELIER — entraînement à la comptabilité, programme de BTS CG.
 *
 * Trois choses s'y font :
 *   - passer des écritures au journal, avec le compte qui se trouve tout seul
 *     à partir du mot qu'on écrit ;
 *   - voir ce que ces écritures produisent : grand livre, balance, bilan,
 *     compte de résultat, recalculés à chaque saisie ;
 *   - s'entraîner sur des exercices corrigés.
 *
 * Tout tourne dans le navigateur. Le moteur comptable (`lib/accounting`) est
 * celui d'un vrai logiciel : équilibre, PCG, TVA, présentation française des
 * états. Ce qui a été retiré, c'est ce qui n'a pas de sens pour un étudiant —
 * base de données, comptes utilisateurs, chaînage anti-fraude.
 */

import { baseFromInclusive, formatAmount, parseAmount, type Cents } from '../../lib/accounting/money'
import { computeBalance, runningLedger, type StatementLine } from '../../lib/accounting/statements'
import { balanceQuatreColonnes, bilan, compteDeResultat } from '../../lib/accounting/presentation'
import { corriger, EXERCICES, THEMES, type Exercice } from '../../lib/accounting/exercices'
import { TAUX } from '../../lib/accounting/vat'
import { accountClass } from '../../lib/accounting/account'
import {
  charger,
  ecritureVide,
  enregistrer,
  etatVide,
  JOURNAUX,
  lignesUtiles,
  ligneVide,
  recevable,
  totaux,
  type EcritureSaisie,
  type Etat,
  type LigneSaisie,
  type Onglet,
} from './etat'
import { existe, libelleDe, suggerer } from './recherche'

// ── Outils DOM ──────────────────────────────────────────────────────────────

const $ = <T extends Element>(selecteur: string): T => {
  const element = document.querySelector<T>(selecteur)
  if (!element) throw new Error(`Élément absent : ${selecteur}`)
  return element
}

function el<K extends keyof HTMLElementTagNameMap>(
  balise: K,
  classe?: string,
  texte?: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(balise)
  if (classe) element.className = classe
  if (texte !== undefined) element.textContent = texte
  return element
}

const montant = (valeur: Cents): string => (valeur === 0 ? '—' : formatAmount(valeur))

// ── État ────────────────────────────────────────────────────────────────────

let etat: Etat = etatVide()
let brouillon: EcritureSaisie = ecritureVide()
let exerciceEnCours: Exercice | null = null
let indiceEcritureExercice = 0
let messageCorrection: HTMLElement | null = null

function sauver(): void {
  enregistrer(etat)
}

// ── Journal : conversion vers le moteur ─────────────────────────────────────

/** Les écritures saisies, sous la forme qu'attend le moteur comptable. */
function lignesMoteur(): StatementLine[] {
  return etat.ecritures.flatMap((ecriture, index) =>
    ecriture.lignes.map((ligne) => ({
      accountNumero: ligne.compte,
      accountLibelle: ligne.libelleCompte || libelleDe(ligne.compte) || ligne.compte,
      date: new Date(`${ecriture.date}T00:00:00.000Z`),
      journalCode: ecriture.journal,
      entryNumero: index + 1,
      entryId: ecriture.id,
      libelle: ligne.libelle || ecriture.libelle,
      debit: ligne.debit,
      credit: ligne.credit,
      lettre: null,
    })),
  )
}

// ── Rendu principal ─────────────────────────────────────────────────────────

const ONGLETS: readonly { readonly id: Onglet; readonly libelle: string }[] = [
  { id: 'journal', libelle: 'Journal' },
  { id: 'grandlivre', libelle: 'Grand livre' },
  { id: 'balance', libelle: 'Balance' },
  { id: 'bilan', libelle: 'Bilan' },
  { id: 'resultat', libelle: 'Compte de résultat' },
  { id: 'exercices', libelle: 'Exercices' },
]

function rendre(): void {
  const barre = $<HTMLElement>('#onglets')
  barre.replaceChildren()
  for (const onglet of ONGLETS) {
    const bouton = el('button', 'onglet', onglet.libelle)
    bouton.type = 'button'
    if (onglet.id === etat.onglet) bouton.dataset['actif'] = 'oui'
    bouton.addEventListener('click', () => {
      etat.onglet = onglet.id
      sauver()
      rendre()
    })
    barre.append(bouton)
  }

  const compteur = $<HTMLElement>('#compteur-ecritures')
  const nombre = etat.ecritures.length
  compteur.textContent = nombre === 0 ? 'aucune écriture' : `${nombre} écriture${nombre > 1 ? 's' : ''}`

  const scene = $<HTMLElement>('#scene')
  scene.replaceChildren()
  switch (etat.onglet) {
    case 'journal':
      scene.append(vueJournal())
      break
    case 'grandlivre':
      scene.append(vueGrandLivre())
      break
    case 'balance':
      scene.append(vueBalance())
      break
    case 'bilan':
      scene.append(vueBilan())
      break
    case 'resultat':
      scene.append(vueResultat())
      break
    case 'exercices':
      scene.append(vueExercices())
      break
  }
  scene.scrollIntoView({ block: 'nearest' })
}

// ── Vue : journal ───────────────────────────────────────────────────────────

function vueJournal(): HTMLElement {
  const zone = el('div', 'colonne')

  if (exerciceEnCours) zone.append(bandeauExercice(exerciceEnCours))
  zone.append(editeur())

  const titre = el('h2', 'titre-section', 'Journal')
  zone.append(titre)

  if (etat.ecritures.length === 0) {
    const vide = el('div', 'vide')
    vide.append(
      el('p', 'vide-titre', 'Le journal est vide.'),
      el(
        'p',
        'vide-texte',
        'Saisissez une écriture ci-dessus, ou ouvrez l’onglet Exercices pour vous entraîner sur un énoncé corrigé.',
      ),
    )
    zone.append(vide)
    return zone
  }

  const triees = [...etat.ecritures].sort((a, b) => a.date.localeCompare(b.date))
  for (const ecriture of triees) zone.append(carteEcriture(ecriture))
  return zone
}

function carteEcriture(ecriture: EcritureSaisie): HTMLElement {
  const carte = el('article', 'carte ecriture defilant')

  const entete = el('div', 'ecriture-entete')
  const gauche = el('div', 'ecriture-titre')
  gauche.append(
    el('span', 'etiquette', `${ecriture.journal} · ${formatDate(ecriture.date)}`),
    el('span', 'ecriture-libelle', ecriture.libelle),
  )
  if (ecriture.piece) gauche.append(el('span', 'etiquette', `Pièce ${ecriture.piece}`))

  const actions = el('div', 'ecriture-actions')
  const reprendre = el('button', 'lien', 'Reprendre')
  reprendre.type = 'button'
  reprendre.addEventListener('click', () => {
    brouillon = { ...ecriture, lignes: ecriture.lignes.map((ligne) => ({ ...ligne })) }
    etat.ecritures = etat.ecritures.filter((autre) => autre.id !== ecriture.id)
    sauver()
    rendre()
  })
  const supprimer = el('button', 'lien danger', 'Supprimer')
  supprimer.type = 'button'
  supprimer.addEventListener('click', () => {
    etat.ecritures = etat.ecritures.filter((autre) => autre.id !== ecriture.id)
    sauver()
    rendre()
  })
  actions.append(reprendre, supprimer)
  entete.append(gauche, actions)

  const table = el('table', 'table')
  const corps = el('tbody')
  for (const ligne of ecriture.lignes) {
    const rang = el('tr')
    rang.append(
      cellule(ligne.compte, 'chiffre compte'),
      cellule(ligne.libelle || ligne.libelleCompte, 'libelle'),
      cellule(montant(ligne.debit), 'chiffre nombre debit'),
      cellule(montant(ligne.credit), 'chiffre nombre credit'),
    )
    corps.append(rang)
  }
  const t = totaux(ecriture.lignes)
  const pied = el('tfoot')
  const rangTotal = el('tr')
  rangTotal.append(
    cellule('', ''),
    cellule('Totaux', 'libelle sourdine'),
    cellule(formatAmount(t.debit), 'chiffre nombre'),
    cellule(formatAmount(t.credit), 'chiffre nombre'),
  )
  pied.append(rangTotal)
  table.append(corps, pied)

  carte.append(entete, table)
  return carte
}

function cellule(texte: string, classe: string): HTMLTableCellElement {
  const cell = el('td', classe, texte)
  return cell
}

function formatDate(iso: string): string {
  const [annee, mois, jour] = iso.split('-')
  return `${jour}/${mois}/${annee}`
}

// ── L'éditeur d'écriture ────────────────────────────────────────────────────

function editeur(): HTMLElement {
  const carte = el('section', 'carte editeur')

  // ── En-tête : date, journal, pièce, libellé ──
  const entete = el('div', 'grille-entete')

  const champDate = el('input', 'champ chiffre')
  champDate.type = 'date'
  champDate.value = brouillon.date
  champDate.addEventListener('input', () => {
    brouillon.date = champDate.value
  })
  entete.append(bloc('Date', champDate))

  const champJournal = el('select', 'champ')
  for (const journal of JOURNAUX) {
    const option = el('option', undefined, `${journal.code} — ${journal.libelle}`)
    option.value = journal.code
    if (journal.code === brouillon.journal) option.selected = true
    champJournal.append(option)
  }
  champJournal.addEventListener('change', () => {
    brouillon.journal = champJournal.value
  })
  entete.append(bloc('Journal', champJournal))

  const champPiece = el('input', 'champ')
  champPiece.value = brouillon.piece
  champPiece.placeholder = 'n° 412'
  champPiece.addEventListener('input', () => {
    brouillon.piece = champPiece.value
  })
  entete.append(bloc('Pièce', champPiece))

  const champLibelle = el('input', 'champ')
  champLibelle.value = brouillon.libelle
  champLibelle.placeholder = 'Facture Delmas'
  champLibelle.addEventListener('input', () => {
    brouillon.libelle = champLibelle.value
    majDerive()
  })
  entete.append(bloc('Libellé de l’écriture', champLibelle, 'large'))

  carte.append(entete)

  // ── Lignes ──
  const table = el('table', 'table table-saisie')
  const entetes = el('thead')
  const rangEntete = el('tr')
  for (const [libelle, classe] of [
    ['Compte', 'col-compte'],
    ['Libellé', 'col-libelle'],
    ['Débit', 'col-montant'],
    ['Crédit', 'col-montant'],
    ['', 'col-action'],
  ] as const) {
    const th = el('th', `surtitre ${classe}`, libelle)
    rangEntete.append(th)
  }
  entetes.append(rangEntete)

  const corps = el('tbody')
  for (const ligne of brouillon.lignes) corps.append(rangSaisie(ligne))
  table.append(entetes, corps)
  carte.append(table)

  // ── Barre d'actions ──
  const barre = el('div', 'barre-actions')

  const ajouter = el('button', 'bouton discret', '+ Ligne')
  ajouter.type = 'button'
  ajouter.addEventListener('click', () => {
    brouillon.lignes.push(ligneVide())
    rendre()
  })

  const tva = el('button', 'bouton discret', 'Aide TVA')
  tva.type = 'button'
  tva.addEventListener('click', ouvrirAideTva)

  const indicateur = el('div', 'indicateur')
  indicateur.id = 'indicateur'

  const valider = el('button', 'bouton', 'Enregistrer l’écriture')
  valider.type = 'button'
  valider.id = 'valider'
  valider.addEventListener('click', enregistrerEcriture)

  const verifier = el('button', 'bouton', 'Vérifier ma réponse')
  verifier.type = 'button'
  verifier.id = 'verifier'
  verifier.addEventListener('click', verifierExercice)

  barre.append(ajouter, tva, indicateur, exerciceEnCours ? verifier : valider)
  carte.append(barre)

  const zoneMessage = el('div', 'zone-message')
  zoneMessage.id = 'zone-message'
  if (messageCorrection) zoneMessage.append(messageCorrection)
  carte.append(zoneMessage)

  queueMicrotask(majDerive)
  return carte
}

function bloc(intitule: string, champ: HTMLElement, classe = ''): HTMLElement {
  const conteneur = el('label', `bloc-champ ${classe}`)
  conteneur.append(el('span', 'surtitre', intitule), champ)
  return conteneur
}

function rangSaisie(ligne: LigneSaisie): HTMLTableRowElement {
  const rang = el('tr')

  // Compte, avec suggestions.
  const cellCompte = el('td', 'col-compte')
  cellCompte.dataset['intitule'] = 'Compte'
  const enveloppe = el('div', 'enveloppe-suggestions')
  const champCompte = el('input', 'champ chiffre')
  champCompte.value = ligne.compte
  champCompte.placeholder = 'assurance…'
  champCompte.autocomplete = 'off'
  const liste = el('div', 'suggestions')
  liste.hidden = true

  const fermer = (): void => {
    liste.hidden = true
    liste.replaceChildren()
    delete cellCompte.dataset['ouverte']
  }

  const choisir = (compte: string, libelle: string, sens: 'debit' | 'credit' | null): void => {
    ligne.compte = compte
    ligne.libelleCompte = libelle
    if (!ligne.libelle) ligne.libelle = libelle
    champCompte.value = compte
    const cellLibelle = rang.querySelector<HTMLInputElement>('.champ-libelle')
    if (cellLibelle && !cellLibelle.value) cellLibelle.value = libelle
    fermer()
    majDerive()
    // On amène le curseur du bon côté : le sens habituel du compte.
    const cible = rang.querySelector<HTMLInputElement>(
      sens === 'credit' ? '.champ-credit' : '.champ-debit',
    )
    cible?.focus()
  }

  const proposer = (): void => {
    const requete = champCompte.value.trim()
    ligne.compte = requete
    if (requete.length === 0) {
      fermer()
      majDerive()
      return
    }
    const suggestions = suggerer(requete, 6)
    liste.replaceChildren()
    if (suggestions.length === 0) {
      const rien = el('p', 'suggestion-vide', 'Aucun compte ne correspond.')
      liste.append(rien)
    }
    for (const suggestion of suggestions) {
      const bouton = el('button', 'suggestion')
      bouton.type = 'button'
      const tete = el('div', 'suggestion-tete')
      tete.append(
        el('span', 'chiffre suggestion-numero', suggestion.compte),
        el('span', 'suggestion-libelle', suggestion.libelle),
      )
      bouton.append(tete)
      if (suggestion.note) bouton.append(el('p', 'suggestion-note', suggestion.note))
      if (suggestion.piege) {
        bouton.append(el('p', 'suggestion-piege', `Piège — ${suggestion.piege}`))
      }
      bouton.addEventListener('mousedown', (evenement) => {
        evenement.preventDefault()
        choisir(suggestion.compte, suggestion.libelle, suggestion.sens)
      })
      liste.append(bouton)
    }
    liste.hidden = false
    cellCompte.dataset['ouverte'] = 'oui'
  }

  champCompte.addEventListener('input', proposer)
  champCompte.addEventListener('focus', () => {
    if (champCompte.value.trim().length > 0) proposer()
  })
  champCompte.addEventListener('blur', () => setTimeout(fermer, 120))
  champCompte.addEventListener('keydown', (evenement) => {
    if (evenement.key === 'Escape') fermer()
    if (evenement.key === 'Enter') {
      evenement.preventDefault()
      const premier = liste.querySelector<HTMLButtonElement>('.suggestion')
      premier?.dispatchEvent(new MouseEvent('mousedown'))
    }
  })

  enveloppe.append(champCompte, liste)
  cellCompte.append(enveloppe)

  // Libellé de ligne.
  const cellLibelle = el('td', 'col-libelle')
  cellLibelle.dataset['intitule'] = 'Libellé'
  const champLibelle = el('input', 'champ champ-libelle')
  champLibelle.value = ligne.libelle
  champLibelle.addEventListener('input', () => {
    ligne.libelle = champLibelle.value
  })
  cellLibelle.append(champLibelle)

  // Montants.
  const cellDebit = el('td', 'col-montant')
  cellDebit.dataset['intitule'] = 'Débit'
  const champDebit = champMontant(ligne.debit, (valeur) => {
    ligne.debit = valeur
    if (valeur > 0) {
      ligne.credit = 0
      const autre = rang.querySelector<HTMLInputElement>('.champ-credit')
      if (autre) autre.value = ''
    }
    majDerive()
  })
  champDebit.classList.add('champ-debit')
  cellDebit.append(champDebit)

  const cellCredit = el('td', 'col-montant')
  cellCredit.dataset['intitule'] = 'Crédit'
  const champCredit = champMontant(ligne.credit, (valeur) => {
    ligne.credit = valeur
    if (valeur > 0) {
      ligne.debit = 0
      const autre = rang.querySelector<HTMLInputElement>('.champ-debit')
      if (autre) autre.value = ''
    }
    majDerive()
  })
  champCredit.classList.add('champ-credit')
  cellCredit.append(champCredit)

  // Suppression.
  const cellAction = el('td', 'col-action')
  const retirer = el('button', 'retirer', '×')
  retirer.type = 'button'
  retirer.title = 'Supprimer la ligne'
  retirer.setAttribute('aria-label', 'Supprimer la ligne')
  retirer.addEventListener('click', () => {
    if (brouillon.lignes.length <= 2) return
    brouillon.lignes = brouillon.lignes.filter((autre) => autre.id !== ligne.id)
    rendre()
  })
  cellAction.append(retirer)

  rang.append(cellCompte, cellLibelle, cellDebit, cellCredit, cellAction)
  return rang
}

function champMontant(valeur: Cents, surChangement: (valeur: Cents) => void): HTMLInputElement {
  const champ = el('input', 'champ chiffre nombre')
  champ.inputMode = 'decimal'
  champ.value = valeur === 0 ? '' : formatAmount(valeur)
  champ.placeholder = '0,00'
  champ.addEventListener('input', () => {
    const lu = parseAmount(champ.value)
    surChangement(lu != null && lu > 0 ? lu : 0)
  })
  champ.addEventListener('blur', () => {
    const lu = parseAmount(champ.value)
    champ.value = lu != null && lu > 0 ? formatAmount(lu) : ''
  })
  return champ
}

/** Met à jour ce qui se déduit de la saisie, sans reconstruire les champs. */
function majDerive(): void {
  const indicateur = document.querySelector<HTMLElement>('#indicateur')
  if (!indicateur) return

  const t = totaux(brouillon.lignes)
  indicateur.replaceChildren()

  const chiffres = el('div', 'indicateur-chiffres')
  chiffres.append(
    el('span', 'chiffre nombre', formatAmount(t.debit)),
    el('span', 'indicateur-sep', '/'),
    el('span', 'chiffre nombre', formatAmount(t.credit)),
  )
  indicateur.append(chiffres)

  const etatTexte = el('span', 'indicateur-etat')
  if (t.debit === 0 && t.credit === 0) {
    etatTexte.textContent = 'en attente'
    indicateur.dataset['etat'] = 'vide'
  } else if (t.ecart === 0) {
    etatTexte.textContent = 'équilibrée'
    indicateur.dataset['etat'] = 'ok'
  } else {
    const sens = t.ecart > 0 ? 'au débit' : 'au crédit'
    etatTexte.textContent = `${formatAmount(Math.abs(t.ecart))} de trop ${sens}`
    indicateur.dataset['etat'] = 'ko'
  }
  indicateur.append(etatTexte)

  const bouton = document.querySelector<HTMLButtonElement>('#valider, #verifier')
  if (bouton) bouton.disabled = !recevable(brouillon)

  // Comptes inventés : on le dit tout de suite, pas à l'enregistrement.
  for (const ligne of brouillon.lignes) {
    if (ligne.compte.length >= 3 && !existe(ligne.compte)) {
      indicateur.dataset['etat'] = 'ko'
      etatTexte.textContent = `Le compte ${ligne.compte} n’existe pas au plan comptable.`
      if (bouton) bouton.disabled = true
      break
    }
  }
}

function enregistrerEcriture(): void {
  if (!recevable(brouillon)) return
  const propre: EcritureSaisie = { ...brouillon, lignes: lignesUtiles(brouillon) }
  etat.ecritures.push(propre)
  brouillon = ecritureVide()
  brouillon.journal = propre.journal
  brouillon.date = propre.date
  messageCorrection = message('ok', 'Écriture enregistrée.', 'Elle apparaît au journal et alimente la balance, le bilan et le compte de résultat.')
  sauver()
  rendre()
}

function message(ton: 'ok' | 'ko' | 'info', titre: string, texte: string): HTMLElement {
  const bloc = el('div', 'message')
  bloc.dataset['ton'] = ton
  bloc.append(el('p', 'message-titre', titre), el('p', 'message-texte', texte))
  return bloc
}

// ── Aide TVA ────────────────────────────────────────────────────────────────

/**
 * Construit les trois lignes d'une opération soumise à TVA à partir du TTC.
 * C'est le calcul que l'étudiant doit savoir faire, mais qu'il refait vingt
 * fois par séance : l'atelier le propose, en montrant le détail.
 */
function ouvrirAideTva(): void {
  const fond = el('div', 'voile')
  const boite = el('div', 'carte boite')

  boite.append(el('p', 'surtitre', 'Aide TVA'))
  boite.append(
    el(
      'p',
      'aide',
      'Donnez le montant TTC et le taux : l’atelier calcule le HT et la TVA, et prépare les trois lignes.',
    ),
  )

  const champTtc = el('input', 'champ chiffre')
  champTtc.placeholder = '1 440,00'
  champTtc.inputMode = 'decimal'
  boite.append(bloc('Montant TTC', champTtc))

  const champTaux = el('select', 'champ')
  for (const [valeur, libelle] of [
    [TAUX.NORMAL, '20 %'],
    [TAUX.INTERMEDIAIRE, '10 %'],
    [TAUX.REDUIT, '5,5 %'],
    [TAUX.PARTICULIER, '2,1 %'],
  ] as const) {
    const option = el('option', undefined, libelle)
    option.value = String(valeur)
    champTaux.append(option)
  }
  boite.append(bloc('Taux', champTaux))

  const champSens = el('select', 'champ')
  for (const [valeur, libelle] of [
    ['achat', 'Achat — TVA déductible'],
    ['vente', 'Vente — TVA collectée'],
  ] as const) {
    const option = el('option', undefined, libelle)
    option.value = valeur
    champSens.append(option)
  }
  boite.append(bloc('Sens', champSens))

  const apercu = el('div', 'apercu')
  const majApercu = (): void => {
    const ttc = parseAmount(champTtc.value) ?? 0
    const taux = Number(champTaux.value)
    const ht = baseFromInclusive(ttc, taux)
    const tva = ttc - ht
    apercu.replaceChildren()
    if (ttc <= 0) {
      apercu.append(el('p', 'aide', 'Saisissez un montant.'))
      return
    }
    for (const [libelle, valeur] of [
      ['Hors taxes', ht],
      ['TVA', tva],
      ['Toutes taxes comprises', ttc],
    ] as const) {
      const ligne = el('div', 'apercu-ligne')
      ligne.append(el('span', '', libelle), el('span', 'chiffre nombre', formatAmount(valeur)))
      apercu.append(ligne)
    }
    apercu.append(
      el(
        'p',
        'aide',
        `Calcul : ${formatAmount(ttc)} ÷ ${1 + taux / 100_000} = ${formatAmount(ht)} de base, le reste est la TVA.`,
      ),
    )
  }
  champTtc.addEventListener('input', majApercu)
  champTaux.addEventListener('change', majApercu)
  majApercu()
  boite.append(apercu)

  const actions = el('div', 'barre-actions fin')
  const annuler = el('button', 'bouton discret', 'Annuler')
  annuler.type = 'button'
  annuler.addEventListener('click', () => fond.remove())

  const inserer = el('button', 'bouton', 'Insérer les lignes')
  inserer.type = 'button'
  inserer.addEventListener('click', () => {
    const ttc = parseAmount(champTtc.value) ?? 0
    if (ttc <= 0) return
    const taux = Number(champTaux.value)
    const ht = baseFromInclusive(ttc, taux)
    const tva = ttc - ht
    const vente = champSens.value === 'vente'

    const nouvelles: LigneSaisie[] = vente
      ? [
          { ...ligneVide(), compte: '411000', libelleCompte: 'Clients', libelle: 'Créance client', debit: ttc, credit: 0 },
          { ...ligneVide(), compte: '', libelleCompte: '', libelle: 'Produit — à compléter', debit: 0, credit: ht },
          { ...ligneVide(), compte: '445711', libelleCompte: 'TVA collectée 20 %', libelle: 'TVA collectée', debit: 0, credit: tva },
        ]
      : [
          { ...ligneVide(), compte: '', libelleCompte: '', libelle: 'Charge — à compléter', debit: ht, credit: 0 },
          { ...ligneVide(), compte: '445660', libelleCompte: 'TVA déductible', libelle: 'TVA déductible', debit: tva, credit: 0 },
          { ...ligneVide(), compte: '401000', libelleCompte: 'Fournisseurs', libelle: 'Dette fournisseur', debit: 0, credit: ttc },
        ]

    const restantes = brouillon.lignes.filter(
      (ligne) => ligne.compte.length > 0 || ligne.debit > 0 || ligne.credit > 0,
    )
    brouillon.lignes = [...restantes, ...nouvelles]
    fond.remove()
    rendre()
  })
  actions.append(annuler, inserer)
  boite.append(actions)

  fond.append(boite)
  fond.addEventListener('click', (evenement) => {
    if (evenement.target === fond) fond.remove()
  })
  document.body.append(fond)
  champTtc.focus()
}

// ── Vue : grand livre ───────────────────────────────────────────────────────

function vueGrandLivre(): HTMLElement {
  const zone = el('div', 'colonne')
  zone.append(titreEtat('Grand livre', 'Un compte par bloc, dans l’ordre du plan comptable, avec le solde après chaque mouvement.'))

  const lignes = lignesMoteur()
  if (lignes.length === 0) return zoneVide(zone, 'Aucun compte mouvementé pour l’instant.')

  const parCompte = new Map<string, StatementLine[]>()
  for (const ligne of lignes) {
    const groupe = parCompte.get(ligne.accountNumero) ?? []
    groupe.push(ligne)
    parCompte.set(ligne.accountNumero, groupe)
  }

  for (const numero of [...parCompte.keys()].sort()) {
    const groupe = parCompte.get(numero) ?? []
    const carte = el('article', 'carte defilant')
    const entete = el('div', 'ecriture-entete')
    entete.append(
      el('span', 'ecriture-titre', `${numero} — ${groupe[0]?.accountLibelle ?? ''}`),
    )
    const rows = runningLedger(groupe)
    const solde = rows[rows.length - 1]?.soldeProgressif ?? 0
    entete.append(
      el(
        'span',
        `etiquette ${solde >= 0 ? 'debiteur' : 'crediteur'}`,
        `Solde ${solde >= 0 ? 'débiteur' : 'créditeur'} ${formatAmount(Math.abs(solde))}`,
      ),
    )
    carte.append(entete)

    const table = el('table', 'table')
    const corps = el('tbody')
    for (const row of rows) {
      const rang = el('tr')
      rang.append(
        cellule(formatDate(row.date.toISOString().slice(0, 10)), 'chiffre sourdine'),
        cellule(row.libelle, 'libelle'),
        cellule(montant(row.debit), 'chiffre nombre debit'),
        cellule(montant(row.credit), 'chiffre nombre credit'),
        cellule(formatAmount(row.soldeProgressif), 'chiffre nombre'),
      )
      corps.append(rang)
    }
    table.append(corps)
    carte.append(table)
    zone.append(carte)
  }
  return zone
}

// ── Vue : balance ───────────────────────────────────────────────────────────

function vueBalance(): HTMLElement {
  const zone = el('div', 'colonne')
  zone.append(
    titreEtat(
      'Balance',
      'Quatre colonnes : les mouvements de chaque compte, puis son solde. Les totaux doivent s’égaler deux à deux.',
    ),
  )

  const lignes = lignesMoteur()
  if (lignes.length === 0) return zoneVide(zone, 'Rien à équilibrer pour l’instant.')

  const b = balanceQuatreColonnes(computeBalance(lignes))
  const carte = el('article', 'carte defilant')
  const table = el('table', 'table')

  const entetes = el('thead')
  const rang = el('tr')
  for (const titre of ['Compte', 'Libellé', 'Mvt débit', 'Mvt crédit', 'Solde débiteur', 'Solde créditeur']) {
    rang.append(el('th', 'surtitre', titre))
  }
  entetes.append(rang)

  const corps = el('tbody')
  for (const ligne of b.lignes) {
    const r = el('tr')
    r.append(
      cellule(ligne.numero, 'chiffre compte'),
      cellule(ligne.libelle, 'libelle'),
      cellule(montant(ligne.mouvementDebit), 'chiffre nombre'),
      cellule(montant(ligne.mouvementCredit), 'chiffre nombre'),
      cellule(montant(ligne.soldeDebiteur), 'chiffre nombre debit'),
      cellule(montant(ligne.soldeCrediteur), 'chiffre nombre credit'),
    )
    corps.append(r)
  }

  const pied = el('tfoot')
  const rangTotal = el('tr')
  rangTotal.append(
    cellule('', ''),
    cellule('Totaux', 'libelle sourdine'),
    cellule(formatAmount(b.totalMouvementDebit), 'chiffre nombre'),
    cellule(formatAmount(b.totalMouvementCredit), 'chiffre nombre'),
    cellule(formatAmount(b.totalSoldeDebiteur), 'chiffre nombre'),
    cellule(formatAmount(b.totalSoldeCrediteur), 'chiffre nombre'),
  )
  pied.append(rangTotal)
  table.append(entetes, corps, pied)
  carte.append(table)
  zone.append(carte)

  zone.append(
    b.equilibree
      ? message('ok', 'La balance est équilibrée.', 'Les mouvements s’égalisent, et les soldes aussi. La comptabilité est cohérente.')
      : message(
          'ko',
          'La balance n’est pas équilibrée.',
          'Une écriture du journal ne respecte pas la partie double : reprenez-la avant d’aller plus loin.',
        ),
  )
  return zone
}

// ── Vue : bilan ─────────────────────────────────────────────────────────────

function vueBilan(): HTMLElement {
  const zone = el('div', 'colonne')
  zone.append(
    titreEtat(
      'Bilan',
      'Généré depuis votre journal. L’actif est présenté en brut, amortissements et net ; le résultat figure dans les capitaux propres.',
    ),
  )

  const lignes = lignesMoteur()
  if (lignes.length === 0) return zoneVide(zone, 'Le bilan se dressera dès la première écriture.')

  const b = bilan(computeBalance(lignes))
  const grille = el('div', 'deux-colonnes')

  const habite = (bloc: { lignes: readonly { brut: Cents; net: Cents }[] }): boolean =>
    bloc.lignes.some((ligne) => ligne.brut !== 0 || ligne.net !== 0)

  const colonneActif = el('div', 'colonne')
  for (const bloc of b.actif) if (habite(bloc)) colonneActif.append(tableEtat(bloc.titre, bloc, true))
  colonneActif.append(totalEtat('Total actif', b.totalActif))

  const colonnePassif = el('div', 'colonne')
  for (const bloc of b.passif) if (habite(bloc)) colonnePassif.append(tableEtat(bloc.titre, bloc, false))
  colonnePassif.append(totalEtat('Total passif', b.totalPassif))

  grille.append(colonneActif, colonnePassif)
  zone.append(grille)

  zone.append(
    b.ecart === 0
      ? message(
          'ok',
          'Le bilan s’équilibre.',
          `Actif = passif = ${formatAmount(b.totalActif)}. Le résultat de l’exercice, ${formatAmount(b.resultat)}, ferme l’égalité.`,
        )
      : message(
          'ko',
          `Le bilan ne s’équilibre pas : ${formatAmount(Math.abs(b.ecart))} d’écart.`,
          'Cela vient toujours d’une écriture déséquilibrée au journal. Vérifiez la balance.',
        ),
  )

  for (const remarque of remarquesBilan(computeBalance(lignes))) zone.append(remarque)
  return zone
}

/**
 * Ce qu'un professeur dirait en regardant le bilan par-dessus l'épaule.
 * Ces situations ne sont pas des erreurs de calcul : ce sont des signes qu'il
 * manque une écriture, et c'est exactement ce qu'il faut apprendre à repérer.
 */
function remarquesBilan(balance: ReturnType<typeof computeBalance>): HTMLElement[] {
  const remarques: HTMLElement[] = []
  const solde = (prefixe: string): Cents =>
    balance
      .filter((compte) => compte.numero.startsWith(prefixe))
      .reduce((total, compte) => total + compte.solde, 0)

  if (solde('10') === 0 && balance.length > 0) {
    remarques.push(
      message(
        'info',
        'Aucun apport initial n’a été enregistré.',
        'Un bilan complet commence par une écriture d’ouverture : le capital au crédit du 101, la banque au débit du 512. Sans elle, le bilan ne décrit qu’une partie de l’entreprise.',
      ),
    )
  }

  const banque = solde('512')
  if (banque < 0) {
    remarques.push(
      message(
        'info',
        `Le compte banque est créditeur de ${formatAmount(Math.abs(banque))}.`,
        'Autrement dit, vous avez décaissé plus que ce qui est entré. Soit c’est un découvert, soit il manque les encaissements — vérifiez que les recettes ont bien été saisies.',
      ),
    )
  }

  const caisse = solde('530')
  if (caisse < 0) {
    remarques.push(
      message(
        'ko',
        'Le compte caisse est créditeur.',
        'C’est impossible : on ne peut pas sortir d’une caisse plus d’espèces qu’elle n’en contient. Il y a forcément une erreur de saisie.',
      ),
    )
  }

  return remarques
}

function tableEtat(titre: string, bloc: { lignes: readonly { libelle: string; brut: Cents; amortissements: Cents; net: Cents }[]; total: Cents }, colonnesTriple: boolean): HTMLElement {
  const carte = el('article', 'carte defilant')
  carte.append(el('p', 'surtitre', titre))
  const table = el('table', 'table')

  if (colonnesTriple) {
    const entetes = el('thead')
    const rang = el('tr')
    for (const t of ['', 'Brut', 'Amort. / dépr.', 'Net']) rang.append(el('th', 'surtitre', t))
    entetes.append(rang)
    table.append(entetes)
  }

  const corps = el('tbody')
  for (const ligne of bloc.lignes) {
    if (ligne.net === 0 && ligne.brut === 0) continue
    const rang = el('tr')
    rang.append(cellule(ligne.libelle, 'libelle'))
    if (colonnesTriple) {
      rang.append(
        cellule(montant(ligne.brut), 'chiffre nombre sourdine'),
        cellule(montant(ligne.amortissements), 'chiffre nombre sourdine'),
      )
    }
    rang.append(cellule(formatAmount(ligne.net), 'chiffre nombre'))
    corps.append(rang)
  }
  const pied = el('tfoot')
  const rangTotal = el('tr')
  rangTotal.append(cellule(`Total ${titre.toLowerCase()}`, 'libelle'))
  if (colonnesTriple) rangTotal.append(cellule('', ''), cellule('', ''))
  rangTotal.append(cellule(formatAmount(bloc.total), 'chiffre nombre'))
  pied.append(rangTotal)

  table.append(corps, pied)
  carte.append(table)
  return carte
}

function totalEtat(libelle: string, valeur: Cents): HTMLElement {
  const bloc = el('div', 'total-etat')
  bloc.append(el('span', 'total-libelle', libelle), el('span', 'chiffre total-valeur', formatAmount(valeur)))
  return bloc
}

// ── Vue : compte de résultat ────────────────────────────────────────────────

function vueResultat(): HTMLElement {
  const zone = el('div', 'colonne')
  zone.append(
    titreEtat(
      'Compte de résultat',
      'Charges à gauche, produits à droite, par nature. Le résultat est la différence.',
    ),
  )

  const lignes = lignesMoteur()
  if (lignes.length === 0) return zoneVide(zone, 'Le compte de résultat se dressera dès la première écriture.')

  const cr = compteDeResultat(computeBalance(lignes))
  const grille = el('div', 'deux-colonnes')

  grille.append(
    tableEtat('Charges', { lignes: cr.charges.filter((ligne) => ligne.net !== 0), total: cr.totalCharges }, false),
    tableEtat('Produits', { lignes: cr.produits.filter((ligne) => ligne.net !== 0), total: cr.totalProduits }, false),
  )
  zone.append(grille)

  zone.append(
    message(
      cr.beneficiaire ? 'ok' : 'ko',
      cr.beneficiaire
        ? `Bénéfice de ${formatAmount(cr.resultat)}`
        : `Perte de ${formatAmount(Math.abs(cr.resultat))}`,
      `${formatAmount(cr.totalProduits)} de produits − ${formatAmount(cr.totalCharges)} de charges. Ce montant se retrouve au passif du bilan, dans les capitaux propres.`,
    ),
  )
  return zone
}

// ── Vue : exercices ─────────────────────────────────────────────────────────

function vueExercices(): HTMLElement {
  const zone = el('div', 'colonne')
  zone.append(
    titreEtat(
      'Exercices',
      `${EXERCICES.length} énoncés corrigés, du plus simple au plus exigeant. Choisissez-en un : l’énoncé s’affiche au-dessus du journal, et la correction détaille chaque écart.`,
    ),
  )

  const progres = el('p', 'aide', `${etat.reussis.length} sur ${EXERCICES.length} réussis.`)
  zone.append(progres)

  for (const theme of Object.keys(THEMES) as (keyof typeof THEMES)[]) {
    const duTheme = EXERCICES.filter((exercice) => exercice.theme === theme)
    if (duTheme.length === 0) continue

    const carte = el('article', 'carte')
    carte.append(el('p', 'surtitre', THEMES[theme]))
    const liste = el('div', 'liste-exercices')

    for (const exercice of duTheme) {
      const bouton = el('button', 'exercice')
      bouton.type = 'button'
      if (etat.reussis.includes(exercice.id)) bouton.dataset['reussi'] = 'oui'

      const tete = el('div', 'exercice-tete')
      tete.append(
        el('span', 'exercice-titre', exercice.titre),
        el('span', 'etiquette', '•'.repeat(exercice.niveau)),
      )
      bouton.append(tete)
      bouton.append(el('p', 'exercice-enonce', exercice.enonce))
      bouton.addEventListener('click', () => commencerExercice(exercice))
      liste.append(bouton)
    }
    carte.append(liste)
    zone.append(carte)
  }
  return zone
}

function commencerExercice(exercice: Exercice): void {
  exerciceEnCours = exercice
  indiceEcritureExercice = 0
  messageCorrection = null
  brouillon = {
    ...ecritureVide(),
    date: exercice.date,
    journal: exercice.journal,
    libelle: exercice.attendu[0]?.libelle ?? exercice.titre,
    lignes: [ligneVide(), ligneVide(), ligneVide()],
  }
  etat.onglet = 'journal'
  sauver()
  rendre()
}

function bandeauExercice(exercice: Exercice): HTMLElement {
  const carte = el('section', 'carte enonce')

  const entete = el('div', 'ecriture-entete')
  const gauche = el('div', 'ecriture-titre')
  gauche.append(
    el('span', 'surtitre', `Exercice · ${THEMES[exercice.theme]}`),
    el('span', 'enonce-titre', exercice.titre),
  )
  const quitter = el('button', 'lien', 'Quitter l’exercice')
  quitter.type = 'button'
  quitter.addEventListener('click', () => {
    exerciceEnCours = null
    indiceEcritureExercice = 0
    messageCorrection = null
    brouillon = ecritureVide()
    rendre()
  })
  entete.append(gauche, quitter)
  carte.append(entete)

  carte.append(el('p', 'enonce-texte', exercice.enonce))

  if (exercice.attendu.length > 1) {
    carte.append(
      el(
        'p',
        'aide',
        `Écriture ${indiceEcritureExercice + 1} sur ${exercice.attendu.length} — ${exercice.attendu[indiceEcritureExercice]?.libelle ?? ''}`,
      ),
    )
  }

  if (exercice.indice) {
    const details = el('details', 'indice')
    details.append(el('summary', '', 'Un indice'), el('p', 'aide', exercice.indice))
    carte.append(details)
  }

  return carte
}

function verifierExercice(): void {
  if (!exerciceEnCours) return
  const attendu = exerciceEnCours.attendu[indiceEcritureExercice]
  if (!attendu) return

  const resultat = corriger(
    lignesUtiles(brouillon).map((ligne) => ({
      compte: ligne.compte,
      debit: ligne.debit,
      credit: ligne.credit,
    })),
    attendu,
  )

  if (!resultat.juste) {
    const bloc = el('div', 'message')
    bloc.dataset['ton'] = 'ko'
    bloc.append(el('p', 'message-titre', `Pas encore — ${resultat.score} % de l’écriture est juste.`))
    const liste = el('ul', 'liste-ecarts')
    for (const ecart of resultat.ecarts) liste.append(el('li', '', ecart.message))
    bloc.append(liste)

    const voirCorrige = el('button', 'lien', 'Voir le corrigé')
    voirCorrige.type = 'button'
    voirCorrige.addEventListener('click', () => {
      bloc.append(el('p', 'message-texte corrige', exerciceEnCours!.corrige))
      voirCorrige.remove()
    })
    bloc.append(voirCorrige)

    messageCorrection = bloc
    rendre()
    return
  }

  // Écriture juste : on l'enregistre au journal, puis on passe à la suivante.
  etat.ecritures.push({
    ...brouillon,
    lignes: lignesUtiles(brouillon),
    exerciceId: exerciceEnCours.id,
  })

  const reste = indiceEcritureExercice + 1 < exerciceEnCours.attendu.length
  const bloc = el('div', 'message')
  bloc.dataset['ton'] = 'ok'
  bloc.append(
    el('p', 'message-titre', reste ? 'Juste. Passons à l’écriture suivante.' : 'Exercice réussi.'),
    el('p', 'message-texte corrige', exerciceEnCours.corrige),
  )
  messageCorrection = bloc

  if (reste) {
    indiceEcritureExercice += 1
    const suivante = exerciceEnCours.attendu[indiceEcritureExercice]
    brouillon = {
      ...ecritureVide(),
      date: exerciceEnCours.date,
      journal: exerciceEnCours.journal,
      libelle: suivante?.libelle ?? '',
      lignes: [ligneVide(), ligneVide(), ligneVide()],
    }
  } else {
    if (!etat.reussis.includes(exerciceEnCours.id)) etat.reussis.push(exerciceEnCours.id)
    exerciceEnCours = null
    indiceEcritureExercice = 0
    brouillon = ecritureVide()
  }

  sauver()
  rendre()
}

// ── Fragments partagés ──────────────────────────────────────────────────────

function titreEtat(titre: string, explication: string): HTMLElement {
  const bloc = el('div', 'tete-etat')
  bloc.append(el('h2', 'titre-section', titre), el('p', 'aide', explication))
  return bloc
}

function zoneVide(zone: HTMLElement, texte: string): HTMLElement {
  const vide = el('div', 'vide')
  vide.append(
    el('p', 'vide-titre', texte),
    el('p', 'vide-texte', 'Passez une écriture au journal : tout se recalcule aussitôt.'),
  )
  zone.append(vide)
  return zone
}

// ── Démarrage ───────────────────────────────────────────────────────────────

function effacerTout(): void {
  if (etat.ecritures.length === 0) return
  const confirme = window.confirm(
    `Effacer les ${etat.ecritures.length} écritures du journal ? Les exercices réussis sont conservés.`,
  )
  if (!confirme) return
  etat.ecritures = []
  brouillon = ecritureVide()
  sauver()
  rendre()
}

$<HTMLButtonElement>('#effacer').addEventListener('click', effacerTout)

document.addEventListener('keydown', (evenement) => {
  if (evenement.key === 'Escape') {
    document.querySelector('.voile')?.remove()
  }
})

etat = charger()
brouillon = ecritureVide()
rendre()

// Un exemple pour que l'atelier ne s'ouvre pas sur du vide au tout premier
// lancement : la classe de compte sert de garde-fou, on ne remplit rien si
// l'étudiant a déjà travaillé.
if (etat.ecritures.length === 0 && accountClass('607000') === 6) {
  const indicateur = document.querySelector<HTMLElement>('#indicateur')
  if (indicateur) majDerive()
}

export {}
