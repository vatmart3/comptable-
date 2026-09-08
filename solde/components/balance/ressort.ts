/**
 * Intégrateur de ressort — le même que celui déclaré dans les tokens
 * (raideur 260, amortissement 30). Motion l'applique au DOM ; ici il faut
 * l'appliquer à une rotation Three.js, image par image, sans passer par le CSS.
 *
 * Rien dans SOLDE ne bouge en `ease-in-out` : un plateau de balance a une
 * masse, il dépasse légèrement puis se pose. C'est cette physique-là qu'on
 * intègre, pas une courbe de Bézier.
 */

export interface EtatRessort {
  valeur: number
  vitesse: number
}

export const RAIDEUR = 260
export const AMORTISSEMENT = 30

/**
 * Avance l'état d'un pas de temps. `delta` est borné : un onglet en arrière-plan
 * rend des deltas énormes qui feraient exploser l'intégration.
 */
export function avancer(etat: EtatRessort, cible: number, delta: number): EtatRessort {
  const pas = Math.min(delta, 1 / 30)
  const acceleration = -RAIDEUR * (etat.valeur - cible) - AMORTISSEMENT * etat.vitesse
  const vitesse = etat.vitesse + acceleration * pas
  const valeur = etat.valeur + vitesse * pas
  return { valeur, vitesse }
}

/** Le ressort est posé : plus de mouvement perceptible. */
export function auRepos(etat: EtatRessort, cible: number): boolean {
  return Math.abs(etat.valeur - cible) < 0.0005 && Math.abs(etat.vitesse) < 0.005
}

/** Angle maximal du fléau, en radians. Au-delà, la balance devient illisible. */
export const ANGLE_MAX = 0.32

/**
 * Écart normalisé entre -1 et 1, positif quand le débit l'emporte.
 *
 * La normalisation est relative au plus gros plateau : un écart d'un centime
 * sur 12 € doit se voir, le même centime sur 120 000 € ne doit pas coucher la
 * balance. La racine carrée garde les petits écarts visibles tout en faisant
 * saturer les gros — une balance qui touche la butée dit « déséquilibrée »,
 * elle n'a pas à dire de combien.
 */
export function inclinaison(debit: number, credit: number): number {
  const ecart = debit - credit
  if (ecart === 0) return 0
  const echelle = Math.max(debit, credit, 1)
  const ratio = ecart / echelle
  const signe = ratio < 0 ? -1 : 1
  return signe * Math.min(1, Math.sqrt(Math.abs(ratio)))
}
