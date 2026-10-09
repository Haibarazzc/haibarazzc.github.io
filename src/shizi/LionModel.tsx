import { useEffect, useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import * as T from 'three'
import { DecalGeometry } from 'three/addons/geometries/DecalGeometry.js'
import useEmblemTexture from './useEmblemTexture'
import { createEyeGeometry, createEyelidGeometry, createTeethGeometry, createTongueGeometry } from './faceGeometry'

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

function Eye({ x }: { x: number }) {
  const geometry = useMemo(createEyeGeometry, [])
  const eyelid = useMemo(createEyelidGeometry, [])
  useEffect(() => () => { geometry.dispose(); eyelid.dispose() }, [geometry, eyelid])
  return (
    <group position={[x, 1.8, 0.556]} rotation={[0, Math.sign(x) * 0.15, 0]}>
      <mesh geometry={geometry} scale={[0.109, 0.13, 0.066]} castShadow>
        <meshPhysicalMaterial vertexColors roughness={0.32} clearcoat={0.35} clearcoatRoughness={0.24} specularIntensity={0.65} />
      </mesh>
      <mesh geometry={eyelid} castShadow receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.7} />
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
  )
}

function FaceDetails() {
  const teeth = useMemo(createTeethGeometry, [])
  const tongue = useMemo(createTongueGeometry, [])
  useEffect(() => () => { teeth.dispose(); tongue.dispose() }, [teeth, tongue])
  return (
    <group>
      <Eye x={-0.38} />
      <Eye x={0.36} />
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

export default function LionModel({ onSelect, onReady }: {
  onSelect: (id: number) => void
  onReady: () => void
}) {
  const { nodes } = useGLTF(modelUrl)
  const source = nodes.Shixiaoxin as T.Mesh<T.BufferGeometry>
  const texture = useEmblemTexture()
  const geometry = useMemo(() => source.geometry.clone(), [source])
  const emblem = useMemo(() => new DecalGeometry(
    new T.Mesh(source.geometry), new T.Vector3(0, 0.77, 0.53), new T.Euler(0, 0, 0), new T.Vector3(0.5, 0.25, 0.24),
  ), [source])
  useEffect(() => () => { geometry.dispose() }, [geometry])
  useEffect(() => () => { emblem.dispose() }, [emblem])
  useEffect(() => { onReady() }, [onReady])
  useEffect(() => () => { document.body.style.cursor = '' }, [])

  function select(event: ThreeEvent<MouseEvent>) {
    event.stopPropagation()
    if (event.delta >= 6) return
    // Raycast the visible surface, so the back of the mane cannot select the face.
    const point = event.eventObject.worldToLocal(event.point.clone())
    onSelect(lionPart(point))
  }

  return (
    <group position={[0, LION_GROUND, 0]}>
      <mesh geometry={geometry} castShadow receiveShadow onClick={select}
        onPointerOver={event => { event.stopPropagation(); document.body.style.cursor = 'pointer' }}
        onPointerOut={() => { document.body.style.cursor = '' }}>
        <meshPhysicalMaterial vertexColors roughness={0.5} metalness={0.02} clearcoat={0.18} clearcoatRoughness={0.5} />
      </mesh>
      <group onClick={event => { event.stopPropagation(); if (event.delta < 6) onSelect(2) }}>
        <FaceDetails />
      </group>
      <mesh geometry={emblem} onClick={event => { event.stopPropagation(); if (event.delta < 6) onSelect(3) }}>
        <meshStandardMaterial map={texture} transparent alphaTest={0.08} roughness={0.58} depthWrite={false}
          polygonOffset polygonOffsetFactor={-4} />
      </mesh>
    </group>
  )
}
