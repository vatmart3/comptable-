import { balance } from '../calculs/balance'
import { comptesSoldesNonLettres } from '../calculs/lettrage'
import { bilan, compteDeResultat, type Bilan, type CompteDeResultat } from '../calculs/etats-financiers'
import type { Ecriture } from '../types/ecriture'
import type { OptionsRestitution } from '../calculs/grand-livre'
import { creerEcart, type Ecart } from './catalogue'

/** Comptes qui doivent être soldés avant l'établissement des comptes annuels. */
const COMPTES_DATTENTE = ['471', '472', '473', '476', '477', '478', '580']

/**
 * Contrôles de cohérence portant sur le dossier entier, à conduire avant la
 * clôture. Ils ne portent pas sur une écriture mais sur ce qu'elles produisent
 * ensemble.
 */
export function controlerDossier(
  ecritures: readonly Ecriture[],
  options: OptionsRestitution = {},
): Ecart[] {
  const ecarts: Ecart[] = []
  const balanceCalculee = balance(ecritures, options)

  if (!balanceCalculee.equilibree) {
    ecarts.push(
      creerEcart('GLOB_BALANCE_DESEQUILIBREE', {
        montantConstate: Math.abs(balanceCalculee.ecart),
      }),
    )
  }

  for (const ligne of balanceCalculee.lignes) {
    if (!COMPTES_DATTENTE.some((racine) => ligne.numero.startsWith(racine))) continue
    const solde = ligne.soldeDebiteur - ligne.soldeCrediteur
    if (solde !== 0) {
      ecarts.push(
        creerEcart('GLOB_COMPTE_ATTENTE_NON_SOLDE', {
          compteConstate: ligne.numero,
          montantConstate: solde,
        }),
      )
    }
  }

  for (const numero of comptesSoldesNonLettres(
    ecritures.filter((e) => (options.seulementValidees ?? true ? e.validee : true)),
  )) {
    ecarts.push(creerEcart('GLOB_TIERS_SOLDE_NON_LETTRE', { compteConstate: numero }))
  }

  const etatBilan = bilan(ecritures, options)
  const etatResultat = compteDeResultat(ecritures, options)
  ecarts.push(...controlerConcordanceResultat(etatBilan, etatResultat))
  if (!etatBilan.equilibre) {
    ecarts.push(
      creerEcart('GLOB_BALANCE_DESEQUILIBREE', {
        montantConstate: Math.abs(etatBilan.totalActif - etatBilan.totalPassif),
      }),
    )
  }

  return ecarts
}

/**
 * Le résultat du compte de résultat et celui obtenu par différence au bilan
 * procèdent des mêmes comptes : tout écart signale un compte mal classé.
 */
export function controlerConcordanceResultat(
  etatBilan: Pick<Bilan, 'resultatParDifference'>,
  etatResultat: Pick<CompteDeResultat, 'resultatNet'>,
): Ecart[] {
  if (etatBilan.resultatParDifference === etatResultat.resultatNet) return []
  return [
    creerEcart('GLOB_RESULTAT_DISCORDANT', {
      montantConstate: etatResultat.resultatNet,
      montantAttendu: etatBilan.resultatParDifference,
    }),
  ]
}
