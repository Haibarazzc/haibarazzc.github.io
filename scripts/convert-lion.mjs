import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import * as T from 'three'
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js'

// The exporter uses this browser API for its binary buffers, without any textures.
globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then(result => { this.result = result; this.onloadend?.() })
  }
}

const source = new URL('../assets/models/shixiaoxin-30k.obj', import.meta.url)
const output = new URL('../public/models/shixiaoxin-30k.glb', import.meta.url)
const vertices = []
const indices = []
for (const line of (await readFile(source, 'utf8')).split(/\r?\n/)) {
  const [kind, ...values] = line.trim().split(/\s+/)
  if (kind === 'v') vertices.push(...values.slice(0, 3).map(Number))
  if (kind === 'f') {
    const face = values.map(value => Number(value.split('/')[0]) - 1)
    for (let i = 1; i < face.length - 1; i++) indices.push(face[0], face[i], face[i + 1])
  }
}
if (!vertices.length || indices.some(index => index < 0 || index >= vertices.length / 3)) {
  throw new Error('The source OBJ must contain vertices and valid positive face indices.')
}

const geometry = new T.BufferGeometry()
geometry.setAttribute('position', new T.Float32BufferAttribute(vertices, 3))
geometry.setIndex(indices)
geometry.computeBoundingBox()
const bounds = geometry.boundingBox
const center = bounds.getCenter(new T.Vector3())
const scale = 3 / (bounds.max.z - bounds.min.z)
const position = geometry.attributes.position
for (let i = 0; i < position.count; i++) {
  const x = (position.getX(i) - center.x) * scale
  const y = (position.getZ(i) - bounds.min.z) * scale
  const z = -(position.getY(i) - center.y) * scale
  position.setXYZ(i, x, y, z)
}

// Taubin passes soften the triangulation on the face without shrinking the head.
// Connectivity, vertex count, silhouette, and the rest of the source stay intact.
const neighbors = Array.from({ length: position.count }, () => new Set())
for (let i = 0; i < indices.length; i += 3) {
  const [a, b, c] = indices.slice(i, i + 3)
  neighbors[a].add(b).add(c)
  neighbors[b].add(a).add(c)
  neighbors[c].add(a).add(b)
}
const weights = Array.from({ length: position.count }, (_, i) =>
  T.MathUtils.smoothstep(position.getZ(i), 0.25, 0.45)
  * T.MathUtils.smoothstep(position.getY(i), 1.05, 1.25)
  * (1 - T.MathUtils.smoothstep(position.getY(i), 2.4, 2.65))
  * (1 - T.MathUtils.smoothstep(Math.abs(position.getX(i)), 0.7, 0.9)),
)
for (let pass = 0; pass < 10; pass++) {
  const current = position.array.slice()
  const lambda = pass % 2 === 0 ? 0.45 : -0.47
  for (let i = 0; i < position.count; i++) {
    if (!weights[i] || !neighbors[i].size) continue
    for (let axis = 0; axis < 3; axis++) {
      let average = 0
      for (const neighbor of neighbors[i]) average += current[neighbor * 3 + axis]
      average /= neighbors[i].size
      position.array[i * 3 + axis] = current[i * 3 + axis] + lambda * weights[i] * (average - current[i * 3 + axis])
    }
  }
}
const colors = new Float32Array(position.count * 3)
const orange = new T.Color('#dd7c1a')
const cream = new T.Color('#fff1d7')
const brown = new T.Color('#653522')
const base = new T.Color('#715541')
const blush = new T.Color('#e5a094')
const mouth = new T.Color('#54261f')
const tongue = new T.Color('#eb9795')
const tint = new T.Color()
const mask = (distance, inner, outer) => 1 - T.MathUtils.smoothstep(distance, inner, outer)

// Seat the smooth iris caps inside the sculpted sockets, and tuck the original
// thick tooth ridge into the upper lip behind the thin replacement ribbon.
for (let i = 0; i < position.count; i++) {
  const x = position.getX(i), y = position.getY(i), z = position.getZ(i)
  const iris = Math.max(...[-0.38, 0.36].map(center => mask(Math.hypot((x - center) / 0.135, (y - 1.80) / 0.16), 0.8, 1.15)))
    * T.MathUtils.smoothstep(z, 0.48, 0.56)
  const tooth = mask(Math.abs(x), 0.18, 0.32) * mask(Math.abs(y - 1.465), 0.01, 0.04)
    * T.MathUtils.smoothstep(z, 0.55, 0.68)
  position.setY(i, y + tooth * 0.038)
  position.setZ(i, z - iris * 0.04 - tooth * 0.025)
}

for (let i = 0; i < position.count; i++) {
  const x = position.getX(i), y = position.getY(i), z = position.getZ(i)
  tint.copy(orange)
  const front = T.MathUtils.smoothstep(z, 0.34, 0.48)
  const face = mask(Math.hypot(x / 0.81, (y - 1.77) / 0.65), 0.92, 1.08) * front
  tint.lerp(cream, face)
  const forelock = T.MathUtils.smoothstep(y, 2.02, 2.09) * mask(Math.abs(x), 0.18, 0.29) * T.MathUtils.smoothstep(z, 0.48, 0.62)
  tint.lerp(orange, forelock)
  // Soft material masks follow the existing sculpt rather than adding geometry.
  const eyes = Math.max(...[-0.38, 0.36].map(center => mask(Math.hypot((x - center) / 0.125, (y - 1.80) / 0.15), 0.8, 1.08)))
  tint.lerp(brown, eyes * front)
  const nose = mask(Math.hypot(x / 0.13, (y - 1.655) / 0.065), 0.75, 1.1)
  tint.lerp(brown, nose * front)
  const cheeks = Math.max(...[-1, 1].map(side => mask(Math.hypot((x - side * 0.53) / 0.16, (y - 1.57) / 0.10), 0, 1)))
  tint.lerp(blush, cheeks * front * 0.32)
  const cavity = mask(Math.hypot(x / 0.48, (y - 1.40) / 0.14), 0.85, 1.05)
    * T.MathUtils.smoothstep(z, 0.10, 0.24) * (1 - T.MathUtils.smoothstep(z, 0.46, 0.66))
  tint.lerp(mouth, cavity)
  const tongueMask = mask(Math.hypot(x / 0.23, (y - 1.315) / 0.055), 0.75, 1.1) * T.MathUtils.smoothstep(z, 0.35, 0.50)
  tint.lerp(tongue, tongueMask)
  tint.lerp(base, 1 - T.MathUtils.smoothstep(y, 0.16, 0.19))
  colors.set([tint.r, tint.g, tint.b], i * 3)
}
geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3))
geometry.computeVertexNormals()
geometry.computeBoundingBox()
geometry.computeBoundingSphere()
const material = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.02 })
const mesh = new T.Mesh(geometry, material)
mesh.name = 'Shixiaoxin'
mesh.userData = { source: '狮小新_30k.obj', triangles: indices.length / 3, height: 3, originalUpAxis: 'Z' }
const binary = await new GLTFExporter().parseAsync(mesh, { binary: true })
await mkdir(new URL('../public/models/', import.meta.url), { recursive: true })
await writeFile(output, Buffer.from(binary))
console.log(`${position.count} vertices, ${indices.length / 3} triangles → ${fileURLToPath(output)} (${binary.byteLength} bytes)`)
geometry.dispose()
material.dispose()
