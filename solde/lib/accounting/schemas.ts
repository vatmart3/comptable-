/**
 * Schémas Zod des entrées non couvertes par `entry.ts`.
 *
 * Ils vivent à part pour une raison de poids : `ligne.ts` et la physique de
 * La Balance sont embarqués dans le bundle de saisie hors ligne (§ 2), et ils
 * n'ont besoin ni de Zod ni de validation d'entrée — la validation, elle, se
 * refait côté serveur. Laisser un seul `z.object()` dans `vat.ts` tirait
 * 300 ko de Zod dans un bundle qui doit rester léger.
 */

import { z } from 'zod'

export const vatPeriodSchema = z.object({
  regime: z.enum(['CA3', 'CA12']),
  periodeDebut: z.date(),
  periodeFin: z.date(),
  creditReporte: z.number().int().min(0).default(0),
})

export type VatPeriodInput = z.input<typeof vatPeriodSchema>
