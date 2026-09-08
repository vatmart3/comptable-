'use server'

/**
 * Server actions de la saisie.
 *
 * Toute entrée est revalidée ici par Zod : ce qui vient du client n'est jamais
 * digne de confiance, même si le même parseur a tourné dans le navigateur.
 * Les erreurs métier sont renvoyées comme données — jamais lancées vers le
 * client — pour que l'interface puisse les rendre au bon endroit.
 */

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { contexteCourant, DroitRefuse } from '@/lib/server/context'
import {
  CompteInconnu,
  EcritureVerrouillee,
  JournalInconnu,
  contrepasser,
  creerBrouillon,
  supprimerBrouillon,
  validerEcriture,
} from '@/lib/server/entries'
import { EntryValidationError } from '@/lib/accounting/entry'

const ligneSchema = z.object({
  accountNumero: z.string().min(3),
  debit: z.number().int().min(0),
  credit: z.number().int().min(0),
  libelle: z.string().min(1).max(200),
  partnerCode: z.string().nullable().optional(),
})

const ecritureSchema = z.object({
  journalCode: z.string().min(1).max(8),
  /** ISO « AAAA-MM-JJ » : une date traverse le réseau en texte, jamais en objet. */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  libelle: z.string().min(1).max(200),
  pieceRef: z.string().max(60).nullable().optional(),
  lines: z.array(ligneSchema).min(2),
  valider: z.boolean().default(true),
})

export type EnregistrerInput = z.input<typeof ecritureSchema>

export type EnregistrerResultat =
  | { readonly ok: true; readonly id: string; readonly numero: number | null; readonly message: string }
  | { readonly ok: false; readonly erreur: string; readonly champs?: readonly string[] }

export async function enregistrerEcriture(input: EnregistrerInput): Promise<EnregistrerResultat> {
  const parse = ecritureSchema.safeParse(input)
  if (!parse.success) {
    return {
      ok: false,
      erreur: 'La saisie est incomplète ou mal formée.',
      champs: parse.error.issues.map((issue) => issue.path.join('.')),
    }
  }
  const donnees = parse.data

  try {
    const contexte = await contexteCourant()
    const brouillon = await creerBrouillon(contexte, {
      journalCode: donnees.journalCode,
      date: new Date(`${donnees.date}T00:00:00.000Z`),
      libelle: donnees.libelle,
      pieceRef: donnees.pieceRef ?? null,
      lines: donnees.lines.map((ligne) => ({
        accountNumero: ligne.accountNumero,
        debit: ligne.debit,
        credit: ligne.credit,
        libelle: ligne.libelle,
        partnerCode: ligne.partnerCode ?? null,
      })),
    })

    if (!donnees.valider) {
      revalidatePath('/saisie')
      return { ok: true, id: brouillon.id, numero: null, message: 'Brouillon enregistré.' }
    }

    const validee = await validerEcriture(contexte, brouillon.id)
    revalidatePath('/saisie')
    return {
      ok: true,
      id: validee.id,
      numero: validee.numero,
      message: `Écriture ${donnees.journalCode}-${validee.numero} validée et chaînée.`,
    }
  } catch (erreur) {
    return { ok: false, erreur: messageErreur(erreur) }
  }
}

export async function supprimerEcriture(id: string): Promise<EnregistrerResultat> {
  try {
    const contexte = await contexteCourant()
    await supprimerBrouillon(contexte, id)
    revalidatePath('/saisie')
    return { ok: true, id, numero: null, message: 'Brouillon supprimé.' }
  } catch (erreur) {
    return { ok: false, erreur: messageErreur(erreur) }
  }
}

export async function validerBrouillon(id: string): Promise<EnregistrerResultat> {
  try {
    const contexte = await contexteCourant()
    const validee = await validerEcriture(contexte, id)
    revalidatePath('/saisie')
    return {
      ok: true,
      id: validee.id,
      numero: validee.numero,
      message: `Écriture n° ${validee.numero} validée et chaînée.`,
    }
  } catch (erreur) {
    return { ok: false, erreur: messageErreur(erreur) }
  }
}

export async function contrepasserEcriture(id: string, motif: string): Promise<EnregistrerResultat> {
  try {
    const contexte = await contexteCourant()
    const extourne = await contrepasser(contexte, id, { motif })
    revalidatePath('/saisie')
    return {
      ok: true,
      id: extourne.id,
      numero: extourne.numero,
      message: `Extourne n° ${extourne.numero} enregistrée.`,
    }
  } catch (erreur) {
    return { ok: false, erreur: messageErreur(erreur) }
  }
}

/** Traduit une exception métier en une phrase que l'utilisateur peut lire. */
function messageErreur(erreur: unknown): string {
  if (erreur instanceof EntryValidationError) {
    return erreur.problems.map((probleme) => probleme.message).join(' ')
  }
  if (
    erreur instanceof CompteInconnu ||
    erreur instanceof JournalInconnu ||
    erreur instanceof EcritureVerrouillee ||
    erreur instanceof DroitRefuse
  ) {
    return erreur.message
  }
  console.error(erreur)
  return 'L’enregistrement a échoué. L’écriture n’a pas été prise en compte.'
}
