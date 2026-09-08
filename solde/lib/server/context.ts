/**
 * Contexte d'exécution : quelle société, quel exercice, quel acteur.
 *
 * Better Auth n'est pas encore branché (§ 2) : la résolution de l'acteur passe
 * ici et nulle part ailleurs, de sorte que le jour où la session existe, seule
 * `acteurCourant()` change. Tout le reste du code — services, actions,
 * piste d'audit — consomme déjà un acteur avec un rôle et des droits réels.
 */

import { cache } from 'react'
import { db } from '@/lib/db'
import { can, isRole, type Permission, type Role } from '@/lib/accounting/roles'

export interface Acteur {
  readonly userId: string
  readonly nom: string
  readonly email: string
  readonly role: Role
}

export interface Contexte {
  readonly companyId: string
  readonly companyNom: string
  readonly siren: string
  readonly fiscalYearId: string
  readonly exercice: { readonly dateDebut: Date; readonly dateFin: Date; readonly statut: 'ouvert' | 'en_cloture' | 'cloture' }
  readonly acteur: Acteur
}

export class ContexteError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ContexteError'
  }
}

export class DroitRefuse extends Error {
  constructor(permission: Permission, role: Role) {
    super(`Le rôle « ${role} » ne permet pas cette action (${permission}).`)
    this.name = 'DroitRefuse'
  }
}

function statutExercice(valeur: string): 'ouvert' | 'en_cloture' | 'cloture' {
  return valeur === 'cloture' || valeur === 'en_cloture' ? valeur : 'ouvert'
}

/**
 * `cache` déduplique l'appel sur toute la durée d'un rendu : dix composants
 * peuvent demander le contexte, la base n'est interrogée qu'une fois.
 */
export const contexteCourant = cache(async (): Promise<Contexte> => {
  const company = await db.company.findFirst({ orderBy: { createdAt: 'asc' } })
  if (!company) {
    throw new ContexteError('Aucune société. Lancez `npm run db:seed`.')
  }

  const exercice =
    (await db.fiscalYear.findFirst({
      where: { companyId: company.id, statut: 'ouvert' },
      orderBy: { dateDebut: 'desc' },
    })) ??
    (await db.fiscalYear.findFirst({
      where: { companyId: company.id },
      orderBy: { dateDebut: 'desc' },
    }))
  if (!exercice) {
    throw new ContexteError(`Aucun exercice ouvert pour ${company.nom}.`)
  }

  // Seam Better Auth : remplacer par la session. SOLDE_ACTEUR permet de tester
  // les rôles en développement sans écran de connexion.
  const emailSouhaite = process.env.SOLDE_ACTEUR
  const membership =
    (emailSouhaite
      ? await db.membership.findFirst({
          where: { companyId: company.id, user: { email: emailSouhaite } },
          include: { user: true },
        })
      : null) ??
    (await db.membership.findFirst({
      where: { companyId: company.id, role: 'expert' },
      include: { user: true },
    })) ??
    (await db.membership.findFirst({ where: { companyId: company.id }, include: { user: true } }))

  if (!membership) {
    throw new ContexteError(`Aucun utilisateur rattaché à ${company.nom}.`)
  }

  return {
    companyId: company.id,
    companyNom: company.nom,
    siren: company.siren,
    fiscalYearId: exercice.id,
    exercice: {
      dateDebut: exercice.dateDebut,
      dateFin: exercice.dateFin,
      statut: statutExercice(exercice.statut),
    },
    acteur: {
      userId: membership.user.id,
      nom: membership.user.name,
      email: membership.user.email,
      role: isRole(membership.role) ? membership.role : 'lecture',
    },
  }
})

/** Lève si l'acteur n'a pas le droit demandé. Appelée par chaque service. */
export function exigerDroit(contexte: Contexte, permission: Permission): void {
  if (!can(contexte.acteur.role, permission)) {
    throw new DroitRefuse(permission, contexte.acteur.role)
  }
}
