import { useEffect, useMemo, useRef } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import * as T from 'three'
import { DecalGeometry } from 'three/addons/geometries/DecalGeometry.js'
import { features, type PoseId } from './data'
import { createBody, createFace, createForelock, createMane, createMitten, createMouth, createPaw, createTailTip, faceDepth } from './lionGeometry'
import markUrl from './zhixin-mark.jpg'

type Euler3 = [number, number, number]
type PoseSpec = { yaw: number; head: Euler3; armL: Euler3; armR: Euler3; wristL: Euler3; wristR: Euler3; legL: Euler3; legR: Euler3; ankleL: Euler3; ankleR: Euler3; tail: Euler3; lift: number }
const POSES: Record<PoseId, PoseSpec> = {
  stand: { yaw: 0, head: [0, 0, 0], armL: [-0.1, 0, -0.34], armR: [-0.1, 0, 0.34], wristL: [0, 0, 0.12], wristR: [0, 0, -0.12], legL: [0, 0, -0.06], legR: [0, 0, 0.06], ankleL: [0, 0, 0], ankleR: [0, 0, 0], tail: [0, 0, 0], lift: 0 },
  cheer: { yaw: -0.06, head: [-0.045, 0.04, -0.035], armL: [0.05, -0.12, -2.3], armR: [0.05, 0.12, 2.3], wristL: [0, Math.PI, 0.16], wristR: [0, -Math.PI, -0.16], legL: [-1.25, -0.08, -0.2], legR: [0.32, 0, 0.15], ankleL: [0.12, 0, 0], ankleR: [0.55, 0, 0], tail: [0.12, -0.18, 0.12], lift: 0.22 },
  glance: { yaw: -0.64, head: [0.015, 0.72, 0.075], armL: [-0.12, 0, -0.25], armR: [-0.25, 0.1, 2.03], wristL: [0, 0, 0.1], wristR: [0, -Math.PI, -0.12], legL: [0, 0, -0.07], legR: [0.08, 0, 0.07], ankleL: [0, 0, 0], ankleR: [0.12, 0, 0], tail: [0.1, 0.55, 0.25], lift: 0 },
}
const GOLD = '#f6a610', CREAM = '#fff3df'

export function getFeatureFraming(pose: PoseId, id: number) {
  const spec = POSES[pose], feature = features[id]
  const point = new T.Vector3(...feature.point).sub(new T.Vector3(0, 0.135, 0))
  const rotation = new T.Quaternion().setFromEuler(new T.Euler(0, spec.yaw, 0))
  if (id <= 2) {
    const pivot = new T.Vector3(0, 1.85, 0.02)
    const headRotation = new T.Quaternion().setFromEuler(new T.Euler(...spec.head))
    point.sub(pivot).applyQuaternion(headRotation).add(pivot)
    rotation.multiply(headRotation)
  } else if (id === 4) {
    point.set(0, -0.48 * (pose === 'cheer' ? 1.3 : 1), 0.018)
      .applyEuler(new T.Euler(...spec.armL)).add(new T.Vector3(-0.38, 1.13, 0.015))
  } else if (id === 5) {
    const pivot = new T.Vector3(0.29, 0.66, -0.28)
    point.sub(pivot).applyEuler(new T.Euler(...spec.tail)).add(pivot)
  }
  point.applyAxisAngle(new T.Vector3(0, 1, 0), spec.yaw).y += 0.135 + spec.lift
  const offset = new T.Vector3(...feature.camera).sub(new T.Vector3(...feature.point)).applyQuaternion(rotation)
  return { pos: point.clone().add(offset).toArray(), at: point.toArray() }
}

function Satin({ color = '#ffffff', vertexColors = false, roughness = 0.38, selected = false }: { color?: string; vertexColors?: boolean; roughness?: number; selected?: boolean }) {
  return <meshPhysicalMaterial color={color} vertexColors={vertexColors} roughness={roughness} metalness={0} clearcoat={0.23} clearcoatRoughness={0.3} envMapIntensity={0.75} emissive="#efb65e" emissiveIntensity={selected ? 0.055 : 0} />
}
function dampRotation(object: T.Object3D | null, target: Euler3, dt: number, reduced: boolean) {
  if (!object) return
  if (reduced) { object.rotation.set(...target); return }
  object.rotation.x = T.MathUtils.damp(object.rotation.x, target[0], 6, dt)
  object.rotation.y = T.MathUtils.damp(object.rotation.y, target[1], 6, dt)
  object.rotation.z = T.MathUtils.damp(object.rotation.z, target[2], 6, dt)
}
function useSculptures() {
  const geometries = useMemo(() => ({ mane: createMane(), face: createFace(), mouth: createMouth(), tuft: createForelock(), body: createBody(), paw: createPaw(), mitten: createMitten(), tailTip: createTailTip() }), [])
  useEffect(() => () => Object.values(geometries).forEach(g => g.dispose()), [geometries])
  return geometries
}
function useEmblemTexture() {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 1024; canvas.height = 512
    const map = new T.CanvasTexture(canvas)
    map.colorSpace = T.SRGBColorSpace
    map.anisotropy = 8
    return map
  }, [])
  useEffect(() => {
    let cancelled = false
    const image = new Image()
    image.onload = () => {
      if (cancelled) return
      const canvas = texture.image as HTMLCanvasElement, ctx = canvas.getContext('2d')!
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height)
      for (let i = 0; i < pixels.data.length; i += 4) {
        const alpha = T.MathUtils.smoothstep(pixels.data[i], 24, 100)
        pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = 255
        pixels.data[i + 3] = Math.round(alpha * 255)
      }
      ctx.putImageData(pixels, 0, 0)
      texture.needsUpdate = true
    }
    image.src = markUrl
    return () => { cancelled = true; image.onload = null; texture.dispose() }
  }, [texture])
  return texture
}
function Emblem({ body }: { body: T.BufferGeometry }) {
  const texture = useEmblemTexture()
  const geometry = useMemo(() => {
    const mesh = new T.Mesh(body)
    mesh.position.set(0, 0.86, 0)
    mesh.updateMatrixWorld(true)
    const decal = new DecalGeometry(mesh, new T.Vector3(0, 0.97, 0.37), new T.Euler(), new T.Vector3(0.59, 0.295, 0.22))
    ;(mesh.material as T.Material).dispose()
    return decal
  }, [body])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <mesh geometry={geometry} renderOrder={1}><meshStandardMaterial map={texture} transparent depthWrite={false} polygonOffset polygonOffsetFactor={-3} roughness={0.48} /></mesh>
}
function Eye({ side }: { side: number }) {
  const x = side * 0.265, y = 0.19
  return (
    <group position={[x, y, faceDepth(x, y) - 0.004]} rotation={[0, side * 0.15, side * -0.045]}>
      <mesh scale={[0.108, 0.133, 0.046]}><sphereGeometry args={[1, 40, 32]} /><meshPhysicalMaterial color="#663021" roughness={0.24} clearcoat={0.75} clearcoatRoughness={0.12} envMapIntensity={0.5} /></mesh>
      <mesh position={[-side * 0.005, -0.014, 0.033]} scale={[0.071, 0.091, 0.023]}><sphereGeometry args={[1, 32, 24]} /><meshPhysicalMaterial color="#9c5030" roughness={0.25} clearcoat={0.8} envMapIntensity={0.35} /></mesh>
      <mesh position={[-side * 0.006, 0.004, 0.05]} scale={[0.047, 0.064, 0.012]}><sphereGeometry args={[1, 32, 24]} /><meshPhysicalMaterial color="#3e201a" roughness={0.12} clearcoat={1} envMapIntensity={0.25} /></mesh>
      <mesh position={[-0.03, 0.048, 0.05]} scale={[0.028, 0.034, 0.01]}><sphereGeometry args={[1, 24, 16]} /><meshBasicMaterial color="#fff9eb" /></mesh>
      <mesh position={[0.035, -0.045, 0.05]} scale={0.011}><sphereGeometry args={[1, 16, 12]} /><meshBasicMaterial color="#efbb80" /></mesh>
    </group>
  )
}
function Ear({ side }: { side: number }) {
  return (
    <group position={[side * 0.565, 0.41, 0.27]} rotation={[0, side * 0.3, side * -0.25]}>
      <mesh scale={[0.173, 0.18, 0.11]} castShadow><sphereGeometry args={[1, 40, 28]} /><Satin color={CREAM} /></mesh>
      <mesh position={[0, 0, 0.085]} scale={[0.091, 0.10, 0.035]}><sphereGeometry args={[1, 32, 24]} /><Satin color="#b97664" roughness={0.6} /></mesh>
    </group>
  )
}
function Nose() {
  const geometry = useMemo(() => {
    const shape = new T.Shape()
    shape.moveTo(-0.083, 0.023)
    shape.bezierCurveTo(-0.075, 0.06, 0.075, 0.06, 0.083, 0.023)
    shape.bezierCurveTo(0.083, -0.015, 0.026, -0.05, 0, -0.047)
    shape.bezierCurveTo(-0.026, -0.05, -0.083, -0.015, -0.083, 0.023)
    return new T.ExtrudeGeometry(shape, { depth: 0.025, bevelEnabled: true, bevelSegments: 5, steps: 1, bevelSize: 0.018, bevelThickness: 0.018, curveSegments: 20 })
  }, [])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <mesh geometry={geometry} position={[0, -0.067, 0.645]} castShadow><meshPhysicalMaterial color="#7a3b2c" roughness={0.3} clearcoat={0.45} clearcoatRoughness={0.25} /></mesh>
}

export default function LionModel({ pose, reduced, selected, onSelect }: { pose: PoseId; reduced: boolean; selected: number; onSelect: (id: number) => void }) {
  const root = useRef<T.Group>(null), head = useRef<T.Group>(null), eyes = useRef<T.Group>(null)
  const armL = useRef<T.Group>(null), armR = useRef<T.Group>(null), wristL = useRef<T.Group>(null), wristR = useRef<T.Group>(null)
  const legL = useRef<T.Group>(null), legR = useRef<T.Group>(null), ankleL = useRef<T.Group>(null), ankleR = useRef<T.Group>(null), tail = useRef<T.Group>(null)
  const time = useRef(0), lift = useRef(0), sculpt = useSculptures()
  const tailCurve = useMemo(() => new T.CatmullRomCurve3([
    new T.Vector3(0, 0, 0), new T.Vector3(0.17, -0.18, -0.06), new T.Vector3(0.39, -0.28, -0.055), new T.Vector3(0.62, -0.15, 0), new T.Vector3(0.75, 0.065, 0.03),
  ]), [])
  const interact = (part: number) => ({
    onClick: (event: ThreeEvent<MouseEvent>) => { if (event.delta < 6) { event.stopPropagation(); onSelect(part) } },
    onPointerOver: (event: ThreeEvent<PointerEvent>) => { event.stopPropagation(); if (event.nativeEvent.target instanceof HTMLElement) event.nativeEvent.target.style.cursor = 'pointer' },
    onPointerOut: (event: ThreeEvent<PointerEvent>) => { if (event.nativeEvent.target instanceof HTMLElement) event.nativeEvent.target.style.cursor = 'grab' },
  })
  useEffect(() => () => { document.body.style.cursor = '' }, [])
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05), spec = POSES[pose]
    if (!reduced) time.current += dt
    const t = time.current
    const pairs: [T.Group | null, Euler3][] = [[head.current, spec.head], [armL.current, spec.armL], [armR.current, spec.armR], [wristL.current, spec.wristL], [wristR.current, spec.wristR], [legL.current, spec.legL], [legR.current, spec.legR], [ankleL.current, spec.ankleL], [ankleR.current, spec.ankleR], [tail.current, spec.tail]]
    pairs.forEach(([group, angles]) => dampRotation(group, angles, dt, reduced))
    lift.current = reduced ? spec.lift : T.MathUtils.damp(lift.current, spec.lift, 5, dt)
    if (root.current) {
      root.current.rotation.y = reduced ? spec.yaw : T.MathUtils.damp(root.current.rotation.y, spec.yaw, 5, dt)
      root.current.position.y = 0.135 + lift.current + (reduced ? 0 : Math.sin(t * 1.7) * (pose === 'cheer' ? 0.022 : 0.002))
    }
    if (tail.current && !reduced) tail.current.rotation.y += Math.sin(t * 1.8) * 0.007
    for (const arm of [armL.current, armR.current]) {
      if (arm) arm.scale.y = reduced ? (pose === 'cheer' ? 1.3 : 1) : T.MathUtils.damp(arm.scale.y, pose === 'cheer' ? 1.3 : 1, 5, dt)
    }
    if (eyes.current) {
      const blink = t % 5.3
      const amount = !reduced && blink > 4.9 && blink < 5.13 ? Math.sin((blink - 4.9) / 0.23 * Math.PI) : 0
      eyes.current.scale.y = 1 - amount * 0.94
    }
  })
  return (
    <group ref={root} position={[0, 0.135, 0]}>
      <group ref={head} position={[0, 1.85, 0.02]}>
        <mesh geometry={sculpt.mane} position={[0, 0.12, -0.085]} castShadow receiveShadow {...interact(0)}><Satin vertexColors selected={selected === 0} /></mesh>
        <group {...interact(2)}>
          <Ear side={-1} /><Ear side={1} />
          <mesh geometry={sculpt.face} castShadow receiveShadow><Satin vertexColors roughness={0.48} selected={selected === 2} /></mesh>
          <mesh geometry={sculpt.mouth}><meshStandardMaterial vertexColors roughness={0.75} /></mesh>
          <mesh position={[0, -0.352, 0.48]} rotation={[0.18, 0, 0]} scale={[0.255, 0.043, 0.05]}><sphereGeometry args={[1, 48, 28]} /><meshPhysicalMaterial color="#db8f80" roughness={0.42} clearcoat={0.25} /></mesh>
          <group position={[0, 0.19, 0]} ref={eyes}><group position={[0, -0.19, 0]}><Eye side={-1} /><Eye side={1} /></group></group>
          <Nose />
        </group>
        <mesh geometry={sculpt.tuft} position={[0, 0.40, 0.5]} rotation={[-0.22, 0, -0.035]} castShadow {...interact(1)}><Satin vertexColors roughness={0.33} selected={selected === 1} /></mesh>
      </group>
      <group {...interact(3)}>
        <mesh position={[0, 1.29, 0]} scale={[0.28, 0.2, 0.25]} castShadow><sphereGeometry args={[1, 32, 24]} /><Satin color={GOLD} /></mesh>
        <mesh geometry={sculpt.body} position={[0, 0.86, 0]} castShadow receiveShadow><Satin vertexColors selected={selected === 3} /></mesh>
        <Emblem body={sculpt.body} />
      </group>
      {([-1, 1] as const).map(side => (
        <group key={side} ref={side < 0 ? armL : armR} position={[side * 0.38, 1.13, 0.015]} rotation={side < 0 ? POSES.stand.armL : POSES.stand.armR} {...interact(4)}>
          <mesh position={[0, -0.17, 0]} castShadow><capsuleGeometry args={[0.10, 0.27, 12, 28]} /><Satin color={GOLD} selected={selected === 4} /></mesh>
          <group position={[0, -0.36, 0.018]} ref={side < 0 ? wristL : wristR}>
            <mesh geometry={sculpt.mitten} scale={[-side, 1, 1]} castShadow><Satin color={CREAM} roughness={0.48} /></mesh>
          </group>
        </group>
      ))}
      {([-1, 1] as const).map(side => (
        <group key={side} ref={side < 0 ? legL : legR} position={[side * 0.19, 0.43, 0.025]} {...interact(4)}>
          <mesh position={[0, -0.105, 0]} castShadow><capsuleGeometry args={[0.112, 0.24, 12, 28]} /><Satin color={GOLD} selected={selected === 4} /></mesh>
          <group ref={side < 0 ? ankleL : ankleR} position={[0, -0.3, 0.045]}>
            <mesh geometry={sculpt.paw} position={[0, -0.045, 0.055]} castShadow receiveShadow><Satin color={GOLD} /></mesh>
          </group>
        </group>
      ))}
      <group ref={tail} position={[0.29, 0.66, -0.28]} {...interact(5)}>
        <mesh castShadow><tubeGeometry args={[tailCurve, 72, 0.035, 16, false]} /><Satin color={GOLD} /></mesh>
        <mesh geometry={sculpt.tailTip} position={[0.755, 0.14, 0.03]} rotation={[0, 0, -0.2]} castShadow><Satin vertexColors selected={selected === 5} roughness={0.45} /></mesh>
      </group>
    </group>
  )
}
