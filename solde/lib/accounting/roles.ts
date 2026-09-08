/**
 * Rôles et droits. Un rôle ne se négocie pas côté client : chaque server
 * action rappelle `can()` avant d'agir, et la piste d'audit enregistre l'acteur.
 */

export const ROLES = ['lecture', 'saisie', 'reviseur', 'expert'] as const
export type Role = (typeof ROLES)[number]

export const PERMISSIONS = [
  'entry.read',
  'entry.draft',
  'entry.validate',
  'entry.reverse',
  'lettering.write',
  'bank.import',
  'invoice.write',
  'vat.declare',
  'asset.write',
  'closing.run',
  'export.fec',
  'settings.write',
  'user.manage',
] as const
export type Permission = (typeof PERMISSIONS)[number]

const MATRIX: Record<Role, readonly Permission[]> = {
  lecture: ['entry.read'],
  saisie: ['entry.read', 'entry.draft', 'lettering.write', 'bank.import', 'invoice.write'],
  reviseur: [
    'entry.read',
    'entry.draft',
    'entry.validate',
    'entry.reverse',
    'lettering.write',
    'bank.import',
    'invoice.write',
    'vat.declare',
    'asset.write',
    'export.fec',
  ],
  expert: [...PERMISSIONS],
}

export function can(role: Role, permission: Permission): boolean {
  return MATRIX[role].includes(permission)
}

export function permissionsOf(role: Role): readonly Permission[] {
  return MATRIX[role]
}

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value)
}

export const ROLE_LABELS: Record<Role, string> = {
  lecture: 'Lecture seule',
  saisie: 'Saisie',
  reviseur: 'Révision',
  expert: 'Expert-comptable',
}
