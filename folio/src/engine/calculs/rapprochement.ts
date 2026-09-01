import { somme, type Centimes } from '../core/montant'
import type { DateComptable } from '../core/dates'
import type { Ecriture } from '../types/ecriture'

export interface LigneReleve {
  id: string
  date: DateComptable
  libelle: string
  /** Débit du relevé : ce que la banque nous retire. */
  debit: Centimes
  credit: Centimes
  pointee?: boolean
}

export interface LigneComptable {
  ecritureId: string
  ligneIndex: number
  date: DateComptable
  numeroPiece: string
  libelle: string
  debit: Centimes
  credit: Centimes
  pointee?: boolean
}

export interface EtatDeRapprochement {
  compteBanque: string
  dateArrete: DateComptable
  /** Solde du compte 512 en comptabilité, positif débiteur. */
  soldeComptable: Centimes
  /** Solde du relevé, du point de vue de la banque. */
  soldeReleve: Centimes
  /** Écritures comptabilisées absentes du relevé. */
  enComptabiliteSeulement: LigneComptable[]
  /** Opérations du relevé non encore comptabilisées. */
  surReleveSeulement: LigneReleve[]
  soldeComptableRapproche: Centimes
  soldeReleveRapproche: Centimes
  /** Zéro quand le rapprochement est juste. */
  ecart: Centimes
  justifie: boolean
}

export function lignesDuCompte(
  ecritures: readonly Ecriture[],
  compteBanque: string,
): LigneComptable[] {
  const lignes: LigneComptable[] = []
  for (const ecriture of ecritures) {
    ecriture.lignes.forEach((ligne, ligneIndex) => {
      if (!ligne.compteNumero.startsWith(compteBanque)) return
      lignes.push({
        ecritureId: ecriture.id,
        ligneIndex,
        date: ecriture.date,
        numeroPiece: ecriture.numeroPiece,
        libelle: ligne.libelle || ecriture.libelle,
        debit: ligne.debit,
        credit: ligne.credit,
        ...(ligne.pointee ? { pointee: true } : {}),
      })
    })
  }
  return lignes.sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * Pointage automatique : rapproche les opérations de même montant et de sens
 * opposé, le relevé étant tenu du point de vue de la banque. Un encaissement
 * porté au débit du 512 apparaît au crédit du relevé.
 */
export function pointageAutomatique(
  lignesComptables: readonly LigneComptable[],
  lignesReleve: readonly LigneReleve[],
): { comptables: LigneComptable[]; releve: LigneReleve[] } {
  const releveDisponible = lignesReleve.map((ligne) => ({ ...ligne }))
  const comptables = lignesComptables.map((ligne) => ({ ...ligne }))

  for (const comptable of comptables) {
    if (comptable.pointee) continue
    const correspondance = releveDisponible.find(
      (releve) =>
        !releve.pointee &&
        ((comptable.debit > 0 && releve.credit === comptable.debit) ||
          (comptable.credit > 0 && releve.debit === comptable.credit)),
    )
    if (!correspondance) continue
    comptable.pointee = true
    correspondance.pointee = true
  }

  return { comptables, releve: releveDisponible }
}

export function etatDeRapprochement(parametres: {
  compteBanque: string
  dateArrete: DateComptable
  lignesComptables: readonly LigneComptable[]
  lignesReleve: readonly LigneReleve[]
  /** Solde du relevé à la date d'arrêté, positif quand le compte est créditeur chez la banque. */
  soldeReleve: Centimes
}): EtatDeRapprochement {
  const soldeComptable = somme(
    parametres.lignesComptables.map((ligne) => ligne.debit - ligne.credit),
  )
  const enComptabiliteSeulement = parametres.lignesComptables.filter((ligne) => !ligne.pointee)
  const surReleveSeulement = parametres.lignesReleve.filter((ligne) => !ligne.pointee)

  const ajustementComptable = somme(
    surReleveSeulement.map((ligne) => ligne.credit - ligne.debit),
  )
  const ajustementReleve = somme(
    enComptabiliteSeulement.map((ligne) => ligne.debit - ligne.credit),
  )

  const soldeComptableRapproche = soldeComptable + ajustementComptable
  const soldeReleveRapproche = parametres.soldeReleve + ajustementReleve
  const ecart = soldeComptableRapproche - soldeReleveRapproche

  return {
    compteBanque: parametres.compteBanque,
    dateArrete: parametres.dateArrete,
    soldeComptable,
    soldeReleve: parametres.soldeReleve,
    enComptabiliteSeulement,
    surReleveSeulement,
    soldeComptableRapproche,
    soldeReleveRapproche,
    ecart,
    justifie: ecart === 0,
  }
}
