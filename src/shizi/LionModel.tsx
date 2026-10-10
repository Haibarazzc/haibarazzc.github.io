import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { useGLTF } from '@react-three/drei'
import { createPortal, useFrame, type ThreeEvent } from '@react-three/fiber'
import * as T from 'three'
import { DecalGeometry } from 'three/addons/geometries/DecalGeometry.js'
import useEmblemTexture from './useEmblemTexture'
import { createBlinkGeometry, createClosedEyeGeometry, updateBlinkGeometry, createEyeGeometry, createEyelidGeometry, createTeethGeometry, createTongueGeometry } from './faceGeometry'
import { animateLionRig, BODY_PIVOT, CHEER_DURATION, CHEER_PEAK_TIME, createLionRig, HEAD_PIVOT } from './lionMotion'
import type { PoseId } from './data'

const modelUrl = `${import.meta.env.BASE_URL}models/shixiaoxin-30k.glb`
const LION_GROUND = 0.15

// Coordinates are local to the normalized, three-unit-high model.
export function lionPart({ x, y, z }: { x: number; y: number; z: number }) {
  if (y > 2.05 && Math.abs(x) < 0.27 && z > 0.52) return 1
  if (y > 1.14) return z > 0.36 && Math.abs(x) < 0.8 && y < 2.4 ? 2 : 0
  if (x > 0.64 && z < -0.25 && y > 0.22) return 5
  if (y > 0.46 && Math.abs(x) < 0.38 && z > 0.14) return 3
  return 4
}

function Eye({ x, blink }: { x: number; blink: RefObject<number> }) {
  const geometry = useMemo(createEyeGeometry, [])
  const eyelid = useMemo(createEyelidGeometry, [])
  const lidGeometry = useMemo(createBlinkGeometry, [])
  const closedGeometry = useMemo(createClosedEyeGeometry, [])
  const iris = useRef<T.Group>(null)
  const lid = useRef<T.Mesh>(null)
  const crease = useRef<T.Mesh<T.BufferGeometry, T.MeshStandardMaterial>>(null)
  const lastBlink = useRef(-1)
  useEffect(() => () => { geometry.dispose(); eyelid.dispose(); lidGeometry.dispose(); closedGeometry.dispose() }, [geometry, eyelid, lidGeometry, closedGeometry])
  useFrame(() => {
    const closure = blink.current
    if (closure === lastBlink.current) return
    lastBlink.current = closure
    if (iris.current) iris.current.scale.y = 1 - closure * 0.95
    if (lid.current) lid.current.visible = closure > 0.002
    if (crease.current) {
      crease.current.visible = closure > 0.70
      crease.current.material.opacity = T.MathUtils.smoothstep(closure, 0.70, 0.94)
    }
    if (closure > 0.002) updateBlinkGeometry(lidGeometry, closure)
  })
  return (
    <group position={[x, 1.8, 0.556]} rotation={[0, Math.sign(x) * 0.15, 0]}>
      <group ref={iris}>
        <mesh geometry={geometry} scale={[0.109, 0.13, 0.066]} castShadow>
          <meshPhysicalMaterial vertexColors roughness={0.32} clearcoat={0.35} clearcoatRoughness={0.24} specularIntensity={0.65} />
        </mesh>
        <mesh position={[-0.028, 0.039, 0.060]} scale={[0.014, 0.018, 0.005]}>
          <sphereGeometry args={[1, 20, 16]} />
          <meshBasicMaterial color="#fff4db" />
        </mesh>
        <mesh position={[0.032, -0.029, 0.061]} scale={[0.005, 0.007, 0.003]}>
          <sphereGeometry args={[1, 12, 10]} />
          <meshBasicMaterial color="#dab990" transparent opacity={0.55} depthWrite={false} />
        </mesh>
      </group>
      <mesh geometry={eyelid} castShadow receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.7} />
      </mesh>
      <mesh ref={lid} geometry={lidGeometry} visible={false} frustumCulled={false}>
        <meshStandardMaterial color="#fff1d7" roughness={0.65} side={T.DoubleSide} />
      </mesh>
      <mesh ref={crease} geometry={closedGeometry} visible={false}>
        <meshStandardMaterial color="#79563d" roughness={0.75} transparent depthWrite={false} />
      </mesh>
    </group>
  )
}

function FaceDetails({ blink }: { blink: RefObject<number> }) {
  const teeth = useMemo(createTeethGeometry, [])
  const tongue = useMemo(createTongueGeometry, [])
  useEffect(() => () => { teeth.dispose(); tongue.dispose() }, [teeth, tongue])
  return (
    <group>
      <Eye x={-0.38} blink={blink} />
      <Eye x={0.36} blink={blink} />
      <mesh position={[0, 1.655, 0.895]} scale={[0.115, 0.06, 0.05]} castShadow>
        <sphereGeometry args={[1, 40, 24]} />
        <meshPhysicalMaterial color="#6b3827" roughness={0.35} clearcoat={0.5} clearcoatRoughness={0.3} />
      </mesh>
      <mesh geometry={teeth}>
        <meshStandardMaterial color="#fff5e4" roughness={0.58} />
      </mesh>
      <mesh geometry={tongue} position={[0, 1.285, 0.45]}>
        <meshPhysicalMaterial vertexColors roughness={0.58} clearcoat={0.08} clearcoatRoughness={0.5} />
      </mesh>
    </group>
  )
}

export default function LionModel({ pose, reduced, animated, cheerRevision, onSelect, onReady }: {
  pose: PoseId
  reduced: boolean
  animated: boolean
  cheerRevision: number
  onSelect: (id: number) => void
  onReady: () => void
}) {
  const { nodes } = useGLTF(modelUrl)
  const source = nodes.Shixiaoxin as T.Mesh<T.BufferGeometry>
  const texture = useEmblemTexture()
  const rig = useMemo(() => createLionRig(source.geometry), [source])
  const elapsed = useRef(0)
  const reactionAt = useRef(-100)
  const cheerAt = useRef(-100)
  const cheerQueued = useRef(false)
  const blink = useRef(0)
  const emblem = useMemo(() => new DecalGeometry(
    new T.Mesh(source.geometry), new T.Vector3(0, 0.77, 0.53), new T.Euler(0, 0, 0), new T.Vector3(0.5, 0.25, 0.24),
  ), [source])
  useEffect(() => () => { rig.dispose() }, [rig])
  useEffect(() => () => { emblem.dispose() }, [emblem])
  useEffect(() => { onReady() }, [onReady])
  useEffect(() => () => { document.body.style.cursor = '' }, [])
  useEffect(() => {
    if (!cheerRevision) return
    if (elapsed.current - cheerAt.current < CHEER_DURATION) cheerQueued.current = true
    else cheerAt.current = elapsed.current
  }, [cheerRevision])
  useEffect(() => {
    if (reduced) {
      cheerAt.current = -100
      cheerQueued.current = false
      animateLionRig(rig, 0, 100, pose, pose === 'cheer' && cheerRevision > 0 ? CHEER_PEAK_TIME : 100)
      blink.current = 0
    }
  }, [reduced, pose, cheerRevision, rig])
  useFrame((_, dt) => {
    if (reduced || !animated) { blink.current = 0; return }
    if (document.hidden) return
    elapsed.current += Math.min(dt, 0.05)
    if (cheerQueued.current && elapsed.current - cheerAt.current >= CHEER_DURATION) {
      cheerAt.current = elapsed.current
      cheerQueued.current = false
    }
    blink.current = animateLionRig(rig, elapsed.current, elapsed.current - reactionAt.current, pose, elapsed.current - cheerAt.current)
  })

  function respond(id: number) {
    if (!reduced && animated) reactionAt.current = elapsed.current
    onSelect(id)
  }

  function select(event: ThreeEvent<MouseEvent>) {
    event.stopPropagation()
    if (event.delta >= 6) return
    if (event.face) {
      const skinIndex = rig.mesh.geometry.getAttribute('skinIndex')
      const skinWeight = rig.mesh.geometry.getAttribute('skinWeight')
      let armWeight = 0
      for (const vertex of [event.face.a, event.face.b, event.face.c]) {
        for (let slot = 0; slot < 4; slot++) {
          if (rig.armIndices.includes(skinIndex.array[vertex * 4 + slot])) armWeight += skinWeight.array[vertex * 4 + slot]
        }
      }
      if (armWeight > 1.05) { respond(4); return }
    }
    // Raycast the visible surface, so the back of the mane cannot select the face.
    const point = event.eventObject.worldToLocal(event.point.clone())
    respond(lionPart(point))
  }

  return (
    <group position={[0, LION_GROUND, 0]}>
      <primitive object={rig.mesh} dispose={null} onClick={select}
        onPointerOver={(event: ThreeEvent<PointerEvent>) => { event.stopPropagation(); document.body.style.cursor = 'pointer' }}
        onPointerOut={() => { document.body.style.cursor = '' }} />
      {createPortal(<group position={[0, -HEAD_PIVOT, 0]} onClick={event => { event.stopPropagation(); if (event.delta < 6) respond(2) }}>
        <FaceDetails blink={blink} />
      </group>, rig.head)}
      {createPortal(<mesh geometry={emblem} position={[0, -BODY_PIVOT, 0]} onClick={event => { event.stopPropagation(); if (event.delta < 6) respond(3) }}>
        <meshStandardMaterial map={texture} transparent alphaTest={0.08} roughness={0.58} depthWrite={false}
          polygonOffset polygonOffsetFactor={-4} />
      </mesh>, rig.body)}
    </group>
  )
}
