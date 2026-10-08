import * as T from 'three'
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js'

// The mascot is sculpted in model units. Its face has an actual open lip loop,
// rather than a dark oval laid over (or pushed through) a complete sphere.
const TAU = Math.PI * 2
type Surface = (u: number, v: number) => T.Vector3

function surfaceGeometry(surface: Surface, columns = 144, rows = 56) {
  const positions: number[] = [], indices: number[] = []
  for (let j = 0; j <= rows; j++) {
    for (let i = 0; i <= columns; i++) {
      const p = surface(i / columns, j / rows)
      positions.push(p.x, p.y, p.z)
    }
  }
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < columns; i++) {
      const a = j * (columns + 1) + i, b = a + columns + 1
      indices.push(a, a + 1, b, b, a + 1, b + 1)
    }
  }
  const source = new T.BufferGeometry()
  source.setAttribute('position', new T.Float32BufferAttribute(positions, 3))
  source.setIndex(indices)
  // Weld the periodic seam and poles before calculating the shading normals.
  const geometry = mergeVertices(source, 0.00001)
  source.dispose()
  const welded = geometry.getIndex()!, triangles: number[] = []
  for (let i = 0; i < welded.count; i += 3) {
    const a = welded.getX(i), b = welded.getX(i + 1), c = welded.getX(i + 2)
    if (a !== b && b !== c && a !== c) triangles.push(a, b, c)
  }
  geometry.setIndex(triangles)
  geometry.computeVertexNormals()
  return geometry
}

export function gradient(geometry: T.BufferGeometry, low: string, high: string, min: number, max: number) {
  const positions = geometry.getAttribute('position'), colors: number[] = []
  const a = new T.Color(low), b = new T.Color(high), color = new T.Color()
  for (let i = 0; i < positions.count; i++) {
    color.copy(a).lerp(b, T.MathUtils.smoothstep(positions.getY(i), min, max))
    colors.push(color.r, color.g, color.b)
  }
  geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3))
  return geometry
}

export function createMane() {
  const lobes = Array.from({ length: 11 }, (_, i) => {
    const angle = Math.PI / 2 + i * TAU / 11
    return { angle, radius: 0.31 + Math.max(0, Math.sin(angle)) * 0.025 }
  })
  const geometry = surfaceGeometry((u, v) => {
    const a = -u * TAU, p = v * Math.PI
    const r = Math.sin(p), scallop = Math.cos(11 * (a - Math.PI / 2))
    // Polar envelope of rounded lobes, softly joined in the valleys.
    const radii = lobes.flatMap(lobe => {
      const delta = a - lobe.angle, along = 0.69 * Math.cos(delta)
      const discriminant = lobe.radius ** 2 - (0.69 * Math.sin(delta)) ** 2
      return discriminant >= 0 && along > 0 ? [along + Math.sqrt(discriminant)] : []
    })
    const max = Math.max(...radii)
    const outline = max + 0.012 * Math.log(radii.reduce((sum, value) => sum + Math.exp((value - max) / 0.012), 0))
    const radius = r * (0.88 + (outline - 0.88) * r ** 3)
    const front = Math.cos(p)
    return new T.Vector3(
      Math.cos(a) * radius,
      Math.sin(a) * radius * (Math.sin(a) > 0 ? 1.04 : 0.95),
      front * (0.31 + 0.075 * scallop * r ** 4) - 0.14,
    )
  }, 220, 72)
  return gradient(geometry, '#df7907', '#ffc222', -0.95, 0.8)
}

function outerFace(a: number) {
  const y = Math.sign(Math.sin(a)) * Math.abs(Math.sin(a)) ** (2 / 2.4) * 0.655
  const x = Math.sign(Math.cos(a)) * Math.abs(Math.cos(a)) ** (2 / 2.4)
  return new T.Vector2(x * 0.68 * (1 - 0.16 * Math.max(0, y / 0.655)), y)
}

export function faceDepth(x: number, y: number) {
  const width = 0.68 * (1 - 0.16 * Math.max(0, y / 0.655))
  const q = Math.max(0, 1 - Math.abs(x / width) ** 2.4 - Math.abs(y / 0.655) ** 2.4)
  const cheek = Math.exp(-(((Math.abs(x) - 0.39) / 0.18) ** 2 + ((y + 0.12) / 0.2) ** 2))
  const socket = Math.exp(-(((Math.abs(x) - 0.26) / 0.15) ** 2 + ((y - 0.19) / 0.18) ** 2))
  return 0.16 + 0.48 * Math.sqrt(q) + cheek * 0.03 - socket * 0.023
}

export function mouthOutline(a: number) {
  const x = Math.cos(a) * 0.408
  const y = -0.267 + Math.sin(a) * (Math.sin(a) > 0 ? 0.055 : 0.155) + Math.abs(Math.cos(a)) ** 3 * 0.035
  return new T.Vector3(x, y, faceDepth(x, y) + 0.006)
}

export function createFace() {
  const geometry = surfaceGeometry((u, v) => {
    const a = -u * TAU, outer = outerFace(a), lip = mouthOutline(a)
    if (v <= 0.65) {
      const t = v / 0.65
      const x = T.MathUtils.lerp(lip.x, outer.x, t)
      const y = T.MathUtils.lerp(lip.y, outer.y, t)
      // A small lip roll, then the continuous cheek/forehead surface.
      return new T.Vector3(x, y, faceDepth(x, y) + 0.012 * Math.exp(-t * 28))
    }
    const p = (v - 0.65) / 0.35 * Math.PI / 2
    return new T.Vector3(outer.x * Math.cos(p), outer.y * Math.cos(p), 0.16 - Math.sin(p) * 0.30)
  }, 160, 80)
  const positions = geometry.getAttribute('position'), colors: number[] = []
  const cream = new T.Color('#fff3df'), rose = new T.Color('#eda58e'), color = new T.Color()
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i)
    const blush = Math.exp(-(((Math.abs(x) - 0.38) / 0.085) ** 2 + ((y + 0.035) / 0.038) ** 2))
    color.copy(cream).lerp(rose, blush * T.MathUtils.smoothstep(z, 0.35, 0.5) * 0.65)
    colors.push(color.r, color.g, color.b)
  }
  geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3))
  return geometry
}

export function createMouth() {
  const geometry = surfaceGeometry((u, v) => {
    const lip = mouthOutline(u * TAU)
    return new T.Vector3(lip.x * (1 - v), T.MathUtils.lerp(lip.y, -0.29, v), T.MathUtils.lerp(lip.z + 0.005, 0.39, Math.sin(v * Math.PI / 2)))
  }, 160, 24)
  const positions = geometry.getAttribute('position'), colors: number[] = []
  const dark = new T.Color('#582b26'), edge = new T.Color('#a45a49'), color = new T.Color()
  for (let i = 0; i < positions.count; i++) {
    color.copy(dark).lerp(edge, T.MathUtils.smoothstep(positions.getZ(i), 0.4, 0.61) * 0.8)
    colors.push(color.r, color.g, color.b)
  }
  geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3))
  return geometry
}

// Two curved caps sharing a single silhouette. Used for the flame and spade,
// so their side views remain rounded and no primitive intersections show.
export function pillow(shape: T.Shape, center: T.Vector2, depth: number, samples = 96) {
  const outline = shape.getSpacedPoints(samples).slice(0, samples)
  if (!T.ShapeUtils.isClockWise(outline)) outline.reverse()
  return surfaceGeometry((u, v) => {
    const index = u * samples, a = Math.floor(index) % samples, b = (a + 1) % samples
    const edge = outline[a].clone().lerp(outline[b], index % 1)
    const angle = v * Math.PI, r = Math.sin(angle)
    return new T.Vector3(T.MathUtils.lerp(center.x, edge.x, r), T.MathUtils.lerp(center.y, edge.y, r), Math.cos(angle) * depth)
  }, samples, 40)
}

export function createForelock() {
  const shape = new T.Shape()
  shape.moveTo(-0.035, -0.1)
  shape.bezierCurveTo(-0.12, -0.03, -0.245, 0.15, -0.20, 0.31)
  shape.bezierCurveTo(-0.175, 0.43, -0.10, 0.44, -0.075, 0.565)
  shape.bezierCurveTo(-0.05, 0.66, 0.06, 0.62, 0.13, 0.52)
  shape.bezierCurveTo(0.30, 0.28, 0.20, 0.06, -0.035, -0.1)
  const geometry = pillow(shape, new T.Vector2(0, 0.25), 0.17)
  return gradient(geometry, '#f49a09', '#ffd52b', -0.07, 0.56)
}

export function createTailTip() {
  const shape = new T.Shape()
  shape.moveTo(0, -0.12)
  shape.bezierCurveTo(-0.2, -0.04, -0.14, 0.105, -0.03, 0.12)
  shape.bezierCurveTo(0.045, 0.14, 0.115, 0.18, 0.14, 0.23)
  shape.bezierCurveTo(0.115, 0.085, 0.2, -0.045, 0, -0.12)
  return gradient(pillow(shape, new T.Vector2(0, 0.045), 0.085), '#9e4230', '#c27150', -0.12, 0.22)
}

export function createBody() {
  const geometry = new T.SphereGeometry(1, 72, 56), positions = geometry.getAttribute('position')
  for (let i = 0; i < positions.count; i++) {
    const y = positions.getY(i), fullness = 1 - y * 0.13
    positions.setXYZ(i, positions.getX(i) * 0.44 * fullness, y * 0.55, positions.getZ(i) * 0.37 * fullness)
  }
  geometry.computeVertexNormals()
  return gradient(geometry, '#e99408', '#ffb915', -0.5, 0.45)
}

export function createPaw() {
  const geometry = new T.SphereGeometry(1, 56, 40), positions = geometry.getAttribute('position')
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i)
    const grooves = Math.exp(-(((x - 0.32) / 0.07) ** 2)) + Math.exp(-(((x + 0.32) / 0.07) ** 2))
    const toe = Math.max(0, z) ** 4
    positions.setXYZ(i, x * 0.17, Math.max(-0.078, y * 0.105 - grooves * toe * 0.012), z * 0.23 - grooves * toe * 0.018)
  }
  geometry.computeVertexNormals()
  return geometry
}

export function createMitten() {
  const shape = new T.Shape()
  shape.moveTo(-0.085, 0.065)
  shape.bezierCurveTo(-0.12, -0.005, -0.19, -0.16, -0.13, -0.235)
  shape.bezierCurveTo(-0.09, -0.32, 0.10, -0.30, 0.135, -0.225)
  shape.bezierCurveTo(0.17, -0.15, 0.115, -0.075, 0.16, -0.03)
  shape.bezierCurveTo(0.205, 0.04, 0.17, 0.09, 0.135, 0.055)
  shape.bezierCurveTo(0.085, 0.018, 0.075, -0.03, 0.055, 0.065)
  shape.closePath()
  return pillow(shape, new T.Vector2(0, -0.12), 0.09)
}
