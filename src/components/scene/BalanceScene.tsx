import { useCallback, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, Lightformer } from '@react-three/drei'
import * as THREE from 'three'
import { heroScroll, useReducedMotion } from '../../lib/motion'
import { palette } from '../../config/site'

/* ─────────────────────────────────────────────────────────────────────────
   LA BALANCE

   Au chargement : le plateau de gauche s'effondre sous une pile de documents
   en désordre, le fléau penche, l'aiguille sort de la graduation. C'est
   inconfortable, et c'est l'état du visiteur.

   Au scroll : les documents se redressent un par un, se répartissent, le
   fléau remonte, l'aiguille revient au zéro. L'équilibre est atteint pile
   au moment où le hero se termine.

   Aucune texture, aucun modèle chargé : toute la scène est générée. Rien à
   télécharger, rien à décompresser, rien qui puisse manquer en production.
   ───────────────────────────────────────────────────────────────────────── */

const BEAM_Y = 1.24
const ARM = 2.02 // demi-longueur du fléau
const HANG = 0.95 // hauteur des suspentes
const PAN_R = 0.78
const MAX_TILT = 0.3 // radians, plateau gauche effondré

const UP = new THREE.Vector3(0, 1, 0)

/** Position d'un plateau pour une inclinaison donnée. Le plateau pend toujours
 *  à la verticale : seule sa position change, jamais son orientation. */
function panPos(side: -1 | 1, tilt: number, out: THREE.Vector3) {
  return out.set(side * ARM * Math.cos(tilt), BEAM_Y - side * ARM * Math.sin(tilt) - HANG, 0)
}

/** Les trois suspentes d'un plateau. Géométrie constante — calculée une fois. */
function useRigging() {
  return useMemo(() => {
    const rig: { position: THREE.Vector3; quaternion: THREE.Quaternion; length: number }[] = []
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + Math.PI / 6
      const foot = new THREE.Vector3(Math.cos(a) * (PAN_R - 0.06), 0.02, Math.sin(a) * (PAN_R - 0.06))
      const head = new THREE.Vector3(0, HANG, 0)
      const dir = head.clone().sub(foot)
      const length = dir.length()
      rig.push({
        position: foot.clone().add(head).multiplyScalar(0.5),
        quaternion: new THREE.Quaternion().setFromUnitVectors(UP, dir.clone().normalize()),
        length,
      })
    }
    return rig
  }, [])
}

function Pan({ groupRef }: { groupRef: React.RefObject<THREE.Group | null> }) {
  const rig = useRigging()
  return (
    <group ref={groupRef}>
      <mesh>
        <cylinderGeometry args={[PAN_R, PAN_R * 0.94, 0.035, 48]} />
        <meshStandardMaterial color="#39433E" metalness={0.82} roughness={0.36} />
      </mesh>
      {/* Rebord : c'est lui qui accroche la lumière rasante. */}
      <mesh position={[0, 0.03, 0]}>
        <torusGeometry args={[PAN_R, 0.016, 10, 60]} />
        <meshStandardMaterial color="#4A554F" metalness={0.86} roughness={0.28} />
      </mesh>
      {rig.map((r, i) => (
        <mesh key={i} position={r.position} quaternion={r.quaternion}>
          <cylinderGeometry args={[0.008, 0.008, r.length, 6]} />
          <meshStandardMaterial color="#525C56" metalness={0.8} roughness={0.42} />
        </mesh>
      ))}
    </group>
  )
}

interface DocSeed {
  /** Désordre : sur le plateau gauche, de travers, certains encore en l'air. */
  messy: { x: number; y: number; z: number; rx: number; ry: number; rz: number }
  /** Ordre : répartis, empilés, à plat. */
  tidy: { side: -1 | 1; x: number; y: number; z: number; ry: number }
  tint: number
}

function useDocSeeds(count: number): DocSeed[] {
  return useMemo(() => {
    // Générateur déterministe : la scène est identique à chaque chargement.
    let s = 20110419
    const rnd = () => {
      s = (s * 1664525 + 1013904223) % 4294967296
      return s / 4294967296
    }

    const perSide = [0, 0]
    return Array.from({ length: count }, (_, i) => {
      const airborne = i > count - 6
      const side: -1 | 1 = i % 2 === 0 ? -1 : 1
      const k = perSide[side === -1 ? 0 : 1]++
      return {
        messy: {
          x: (rnd() - 0.5) * 1.02,
          y: airborne ? 1.1 + rnd() * 1.5 : 0.04 + k * 0.05 + rnd() * 0.07,
          z: (rnd() - 0.5) * 0.92,
          rx: (rnd() - 0.5) * 0.9,
          ry: (rnd() - 0.5) * Math.PI,
          rz: (rnd() - 0.5) * 0.9,
        },
        tidy: {
          side,
          x: (rnd() - 0.5) * 0.03,
          y: 0.04 + k * 0.022,
          z: (rnd() - 0.5) * 0.03,
          ry: (rnd() - 0.5) * 0.04,
        },
        tint: 0.9 + rnd() * 0.1,
      }
    })
  }, [count])
}

function Rig({ count, compact }: { count: number; compact: boolean }) {
  const reduced = useReducedMotion()
  const invalidate = useThree((s) => s.invalidate)

  const beam = useRef<THREE.Mesh>(null)
  const needle = useRef<THREE.Mesh>(null)
  const panL = useRef<THREE.Group>(null)
  const panR = useRef<THREE.Group>(null)
  const docs = useRef<THREE.InstancedMesh>(null)
  const root = useRef<THREE.Group>(null)

  const seeds = useDocSeeds(count)
  const smoothed = useRef(0)
  const look = useRef({ x: 0, y: 0 })

  const tmp = useMemo(
    () => ({
      obj: new THREE.Object3D(),
      l: new THREE.Vector3(),
      r: new THREE.Vector3(),
      color: new THREE.Color(),
    }),
    [],
  )

  /** Pose complète de la balance pour un avancement `p` ∈ [0,1]. */
  const applyPose = useCallback(
    (p: number) => {
      const tilt = MAX_TILT * (1 - p)

      if (beam.current) beam.current.rotation.z = tilt
      if (needle.current) needle.current.rotation.z = tilt

      panPos(-1, tilt, tmp.l)
      panPos(1, tilt, tmp.r)
      panL.current?.position.copy(tmp.l)
      panR.current?.position.copy(tmp.r)

      const mesh = docs.current
      if (!mesh) return

      for (let i = 0; i < seeds.length; i++) {
        const d = seeds[i]
        // Chaque document se range à son tour : le rangement se propage.
        const t = THREE.MathUtils.clamp((p - (i / seeds.length) * 0.42) / 0.5, 0, 1)
        const e = t * t * (3 - 2 * t) // smoothstep, sans rebond

        const from = tmp.l
        const to = d.tidy.side === -1 ? tmp.l : tmp.r

        tmp.obj.position.set(
          THREE.MathUtils.lerp(from.x + d.messy.x, to.x + d.tidy.x, e),
          THREE.MathUtils.lerp(from.y + d.messy.y, to.y + d.tidy.y, e),
          THREE.MathUtils.lerp(from.z + d.messy.z, to.z + d.tidy.z, e),
        )
        tmp.obj.rotation.set(
          THREE.MathUtils.lerp(d.messy.rx, 0, e),
          THREE.MathUtils.lerp(d.messy.ry, d.tidy.ry, e),
          THREE.MathUtils.lerp(d.messy.rz, 0, e),
        )
        tmp.obj.updateMatrix()
        mesh.setMatrixAt(i, tmp.obj.matrix)
      }
      mesh.instanceMatrix.needsUpdate = true
    },
    [seeds, tmp],
  )

  /* Teinte des documents : posée une fois, elle ne bouge plus. */
  useEffect(() => {
    const mesh = docs.current
    if (!mesh) return
    for (let i = 0; i < seeds.length; i++) {
      tmp.color.set(palette.paperHi).multiplyScalar(seeds[i].tint)
      mesh.setColorAt(i, tmp.color)
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [seeds, tmp])

  /* Mouvement réduit : la balance est posée à l'équilibre, une fois, et la
     boucle de rendu s'arrête là. Aucune frame n'est calculée ensuite. */
  useEffect(() => {
    if (!reduced) return
    applyPose(1)
    if (root.current) root.current.rotation.set(0, -0.34, 0)
    invalidate()
  }, [reduced, applyPose, invalidate])

  useFrame((_, delta) => {
    if (reduced) return
    const k = 1 - Math.pow(0.0016, delta) // amortissement indépendant du framerate

    smoothed.current += (heroScroll.progress - smoothed.current) * k
    applyPose(smoothed.current)

    // Parallaxe : 4° au maximum, amortie. Au-delà, ça devient un jouet.
    if (root.current) {
      look.current.x += (heroScroll.pointerX * 0.0698 - look.current.x) * k
      look.current.y += (heroScroll.pointerY * 0.0698 - look.current.y) * k
      root.current.rotation.y = -0.34 + look.current.x
      root.current.rotation.x = look.current.y * 0.5
    }
  })

  return (
    <group
      ref={root}
      position={compact ? [0, 0.9, 0] : [1.3, 0.35, 0]}
      rotation={[0, -0.34, 0]}
      scale={compact ? 0.52 : 0.78}
    >
      {/* Socle et colonne */}
      <mesh position={[0, -1.62, 0]}>
        <cylinderGeometry args={[1.02, 1.16, 0.12, 56]} />
        <meshStandardMaterial color="#2C3531" metalness={0.78} roughness={0.44} />
      </mesh>
      <mesh position={[0, -0.24, 0]}>
        <cylinderGeometry args={[0.07, 0.1, 2.64, 24]} />
        <meshStandardMaterial color="#39433E" metalness={0.82} roughness={0.32} />
      </mesh>

      {/* Graduation fixe : c'est elle qui rend le déséquilibre lisible. */}
      <group position={[0, BEAM_Y + 0.42, 0]}>
        {[-0.34, 0, 0.34].map((a, i) => (
          <mesh key={i} position={[Math.sin(a) * 0.5, Math.cos(a) * 0.5 - 0.5, -0.05]} rotation={[0, 0, -a]}>
            <boxGeometry args={[0.012, i === 1 ? 0.11 : 0.07, 0.012]} />
            <meshStandardMaterial color={palette.stamp} metalness={0.3} roughness={0.6} />
          </mesh>
        ))}
      </group>

      {/* Fléau + aiguille : même rotation, un seul angle pour toute la scène. */}
      <mesh ref={beam} position={[0, BEAM_Y, 0]}>
        <boxGeometry args={[ARM * 2, 0.075, 0.14]} />
        <meshStandardMaterial color="#4A554F" metalness={0.84} roughness={0.3} />
      </mesh>
      <mesh ref={needle} position={[0, BEAM_Y, 0]}>
        <boxGeometry args={[0.022, 0.86, 0.022]} />
        <meshStandardMaterial color={palette.stamp} metalness={0.4} roughness={0.5} />
      </mesh>
      <mesh position={[0, BEAM_Y, 0]}>
        <sphereGeometry args={[0.11, 24, 16]} />
        <meshStandardMaterial color="#5A6560" metalness={0.86} roughness={0.24} />
      </mesh>

      <Pan groupRef={panL} />
      <Pan groupRef={panR} />

      {/* Les documents. Une seule géométrie, instanciée. */}
      <instancedMesh ref={docs} args={[undefined, undefined, seeds.length]}>
        <boxGeometry args={[0.6, 0.009, 0.43]} />
        {/* Surtout pas `vertexColors` : la géométrie n'a pas d'attribut `color`,
            et le nuancier chercherait un attribut absent — les documents
            ressortaient noirs. C'est `instanceColor` qui teinte, tout seul. */}
        <meshStandardMaterial color={palette.paperHi} metalness={0} roughness={0.94} />
      </instancedMesh>

    </group>
  )
}

export default function BalanceScene({ compact = false }: { compact?: boolean }) {
  const reduced = useReducedMotion()

  return (
    <Canvas
      dpr={compact ? [1, 1.5] : [1, 2]}
      /* La caméra est franchement au-dessus du fléau : vue de face, les
         plateaux se réduiraient à deux traits et la balance paraîtrait plate. */
      camera={{ position: compact ? [0, 2.6, 12.6] : [0, 2.05, 9.2], fov: 33 }}
      gl={{ antialias: !compact, alpha: true, powerPreference: 'high-performance' }}
      /* Mouvement réduit : rendu à la demande. Une frame, puis plus rien. */
      frameloop={reduced ? 'demand' : 'always'}
      style={{ pointerEvents: 'none' }}
    >
      {/* Éclairage rasant : une clé très basse à gauche qui allonge les reflets
          sur le métal brossé, une contre-lumière froide à droite pour détacher
          la silhouette du fond papier. */}
      <ambientLight intensity={0.5} />
      <hemisphereLight args={[palette.paperHi, palette.ink, 0.55]} />
      <directionalLight position={[-6.5, 1.6, 3.2]} intensity={2.6} />
      <directionalLight position={[4.5, 2.4, -2.5]} intensity={0.75} color={palette.stamp} />

      {/* Un métal n'a pas de composante diffuse : sans réflexion, il est noir.
          L'environnement est donc construit ici, à la main, avec des surfaces
          lumineuses — aucune carte HDR n'est téléchargée, rien ne vient du
          réseau. Une nappe claire rasante à gauche, un rappel d'encre à droite,
          et le fond papier tout autour. */}
      <Environment resolution={128} frames={1}>
        <mesh scale={40}>
          <sphereGeometry args={[1, 16, 16]} />
          <meshBasicMaterial color={palette.paper} side={THREE.BackSide} />
        </mesh>
        <Lightformer
          intensity={3.2}
          position={[-5, 1.5, 2]}
          rotation={[0, Math.PI / 2.4, 0]}
          scale={[10, 6, 1]}
          color={palette.paperHi}
        />
        <Lightformer
          intensity={1.1}
          position={[4, 3, -3]}
          rotation={[0, -Math.PI / 3, 0]}
          scale={[8, 5, 1]}
          color={palette.stamp}
        />
        <Lightformer
          form="ring"
          intensity={1.6}
          position={[-1, 5, 1]}
          scale={5}
          color={palette.paperHi}
        />
      </Environment>

      <Rig count={compact ? 14 : 30} compact={compact} />
    </Canvas>
  )
}
