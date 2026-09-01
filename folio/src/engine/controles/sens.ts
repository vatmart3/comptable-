import { classeDe } from '../referentiel/plan-comptable'
import { estCompteDeBilan, estCompteDeGestion, estImmobilisation } from './aides'
import { creerEcart, type Ecart } from './catalogue'

/**
 * Confusions de comptes relevant de l'affectation.
 * Les paires de TVA et les comptes de réduction, de port et de consignation
 * sont traités par leurs familles respectives, appelées avant celle-ci.
 */
export function classerConfusionDeCompte(compteConstate: string, compteAttendu: string): Ecart {
  const details = { compteConstate, compteAttendu }

  if (paire(compteConstate, compteAttendu, '401', '404')) {
    return creerEcart('SENS_CONFUSION_401_404', details)
  }
  if (paire(compteConstate, compteAttendu, '411', '462')) {
    return creerEcart('SENS_CONFUSION_411_462', details)
  }

  const constateEstImmo = estImmobilisation(compteConstate)
  const attenduEstImmo = estImmobilisation(compteAttendu)
  const constateEstGestion = estCompteDeGestion(compteConstate)
  const attenduEstGestion = estCompteDeGestion(compteAttendu)

  if ((constateEstImmo && attenduEstGestion) || (attenduEstImmo && constateEstGestion)) {
    return creerEcart('SENS_CONFUSION_CHARGE_IMMOBILISATION', details)
  }

  if (constateEstGestion !== attenduEstGestion) {
    return creerEcart('SENS_CONFUSION_BILAN_GESTION', {
      ...details,
      precision: estCompteDeBilan(compteConstate) ? 'bilan' : 'gestion',
    })
  }

  return creerEcart('SENS_CLASSE_VOISINE', details)
}

/** Le compte est juste, le montant est juste, mais l'écriture est passée à l'envers. */
export function classerSensInverse(
  compte: string,
  sensConstate: 'debit' | 'credit',
): Ecart {
  return creerEcart('SENS_INVERSE', {
    compteConstate: compte,
    precision:
      sensConstate === 'debit'
        ? 'Le compte est débité alors que l’opération le crédite.'
        : 'Le compte est crédité alors que l’opération le débite.',
  })
}

function paire(a: string, b: string, x: string, y: string): boolean {
  const ra = racineTiers(a)
  const rb = racineTiers(b)
  return (ra === x && rb === y) || (ra === y && rb === x)
}

/** Racine à trois chiffres, pour comparer 401VIDAL à 404. */
function racineTiers(numero: string): string {
  return classeDe(numero) === 4 ? numero.slice(0, 3) : numero
}
