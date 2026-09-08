'use client'

/**
 * LA BALANCE — signature § 7.1.
 *
 * Une balance à deux plateaux, matériau mat, 180 px. Le plateau gauche porte le
 * débit, le droit le crédit. Elle penche proportionnellement à l'écart, en
 * temps réel. À l'équilibre parfait elle se stabilise et le bouton de
 * validation s'ouvre.
 *
 * Aucun message d'erreur textuel n'accompagne le déséquilibre : on le voit.
 */

import { Canvas, useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Group, Mesh, MeshStandardMaterial } from 'three'
import { ANGLE_MAX, auRepos, avancer, inclinaison, type EtatRessort } from './ressort'

export interface BalanceProps {
  /** Total débit, en centimes. */
  readonly debit: number
  /** Total crédit, en centimes. */
  readonly credit: number
  /** Vrai quand il n'y a encore rien à peser. */
  readonly vide: boolean
}

interface Teintes {
  readonly structure: string
  readonly plateau: string
  readonly equilibre: string
  readonly desequilibre: string
  readonly fond: string
}

function lireTeintes(): Teintes {
  if (typeof window === 'undefined') {
    return {
      structure: '#3A3A38',
      plateau: '#6E6A5F',
      equilibre: '#4A6B54',
      desequilibre: '#C4553B',
      fond: '#F7F5F1',
    }
  }
  const style = getComputedStyle(document.documentElement)
  const lire = (nom: string, defaut: string): string => style.getPropertyValue(nom).trim() || defaut
  return {
    structure: lire('--c-graphite', '#3A3A38'),
    plateau: lire('--c-encre-douce', '#6E6A5F'),
    equilibre: lire('--c-vert-sourd', '#4A6B54'),
    desequilibre: lire('--c-terre', '#C4553B'),
    fond: lire('--c-papier', '#F7F5F1'),
  }
}

function Mecanisme({ cible, equilibree, teintes }: { cible: number; equilibree: boolean; teintes: Teintes }) {
  const fleau = useRef<Group>(null)
  const plateauGauche = useRef<Group>(null)
  const plateauDroit = useRef<Group>(null)
  const temoin = useRef<Mesh>(null)
  const etat = useRef<EtatRessort>({ valeur: 0, vitesse: 0 })
  const clac = useRef(0)
  const etaitEquilibree = useRef(equilibree)

  useEffect(() => {
    // Le « clac » : déclenché à l'instant précis où l'équilibre est atteint.
    if (equilibree && !etaitEquilibree.current) clac.current = 1
    etaitEquilibree.current = equilibree
  }, [equilibree])

  useFrame((_, delta) => {
    const angleCible = cible * ANGLE_MAX
    etat.current = avancer(etat.current, angleCible, delta)
    const angle = etat.current.valeur

    if (fleau.current) fleau.current.rotation.z = angle
    // Les plateaux restent horizontaux : ils pendent, ils ne basculent pas.
    if (plateauGauche.current) {
      plateauGauche.current.position.y = -0.55 + Math.sin(angle) * 1.15
      plateauGauche.current.rotation.z = -angle
    }
    if (plateauDroit.current) {
      plateauDroit.current.position.y = -0.55 - Math.sin(angle) * 1.15
      plateauDroit.current.rotation.z = -angle
    }

    if (temoin.current) {
      const materiau = temoin.current.material as MeshStandardMaterial
      const pose = auRepos(etat.current, angleCible)
      materiau.color.set(equilibree && pose ? teintes.equilibre : teintes.desequilibre)
      // Le clac : une pulsation courte, une seule, jamais deux rebonds.
      clac.current = Math.max(0, clac.current - delta * 4)
      const pulsation = 1 + clac.current * 0.9
      temoin.current.scale.setScalar(pulsation)
    }
  })

  const materiauStructure = useMemo(
    () => ({ color: teintes.structure, roughness: 0.92, metalness: 0.04 }),
    [teintes.structure],
  )
  const materiauPlateau = useMemo(
    () => ({ color: teintes.plateau, roughness: 0.88, metalness: 0.06 }),
    [teintes.plateau],
  )

  return (
    <group position={[0, -0.35, 0]}>
      {/* Socle et colonne */}
      <mesh position={[0, -1.5, 0]} receiveShadow>
        <cylinderGeometry args={[0.62, 0.78, 0.14, 48]} />
        <meshStandardMaterial {...materiauStructure} />
      </mesh>
      <mesh position={[0, -0.6, 0]}>
        <cylinderGeometry args={[0.07, 0.09, 1.7, 24]} />
        <meshStandardMaterial {...materiauStructure} />
      </mesh>

      {/* Témoin d'équilibre, au sommet de la colonne */}
      <mesh ref={temoin} position={[0, 0.36, 0]}>
        <sphereGeometry args={[0.11, 24, 24]} />
        <meshStandardMaterial roughness={0.7} metalness={0.1} />
      </mesh>

      {/* Fléau */}
      <group ref={fleau} position={[0, 0.25, 0]}>
        <mesh>
          <boxGeometry args={[2.5, 0.075, 0.075]} />
          <meshStandardMaterial {...materiauStructure} />
        </mesh>
        <mesh position={[-1.22, 0, 0]}>
          <sphereGeometry args={[0.06, 16, 16]} />
          <meshStandardMaterial {...materiauStructure} />
        </mesh>
        <mesh position={[1.22, 0, 0]}>
          <sphereGeometry args={[0.06, 16, 16]} />
          <meshStandardMaterial {...materiauStructure} />
        </mesh>
      </group>

      {/* Plateaux */}
      <group ref={plateauGauche} position={[-1.22, -0.55, 0]}>
        <Plateau materiau={materiauPlateau} structure={materiauStructure} />
      </group>
      <group ref={plateauDroit} position={[1.22, -0.55, 0]}>
        <Plateau materiau={materiauPlateau} structure={materiauStructure} />
      </group>
    </group>
  )
}

function Plateau({
  materiau,
  structure,
}: {
  materiau: { color: string; roughness: number; metalness: number }
  structure: { color: string; roughness: number; metalness: number }
}) {
  return (
    <group>
      {/* Suspentes */}
      <mesh position={[-0.3, 0.36, 0]} rotation={[0, 0, 0.62]}>
        <cylinderGeometry args={[0.012, 0.012, 0.82, 8]} />
        <meshStandardMaterial {...structure} />
      </mesh>
      <mesh position={[0.3, 0.36, 0]} rotation={[0, 0, -0.62]}>
        <cylinderGeometry args={[0.012, 0.012, 0.82, 8]} />
        <meshStandardMaterial {...structure} />
      </mesh>
      {/* Plateau */}
      <mesh>
        <cylinderGeometry args={[0.52, 0.5, 0.055, 48]} />
        <meshStandardMaterial {...materiau} />
      </mesh>
    </group>
  )
}

export { inclinaison }

export function Balance3D({ debit, credit, vide }: BalanceProps) {
  const [teintes, setTeintes] = useState<Teintes>(() => lireTeintes())

  useEffect(() => {
    setTeintes(lireTeintes())
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const relire = (): void => setTeintes(lireTeintes())
    media.addEventListener('change', relire)
    return () => media.removeEventListener('change', relire)
  }, [])

  const cible = vide ? 0 : inclinaison(debit, credit)
  const equilibree = !vide && debit === credit && debit > 0

  return (
    <Canvas
      camera={{ position: [0, 0.35, 5.4], fov: 34 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      style={{ width: '100%', height: '100%' }}
    >
      <ambientLight intensity={1.15} />
      <directionalLight position={[3, 5, 4]} intensity={1.5} />
      <directionalLight position={[-4, 2, -3]} intensity={0.45} />
      <Mecanisme cible={cible} equilibree={equilibree} teintes={teintes} />
    </Canvas>
  )
}

export default Balance3D
