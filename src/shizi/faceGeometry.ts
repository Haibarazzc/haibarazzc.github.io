import * as T from 'three'

export function createEyeGeometry() {
  const geometry = new T.SphereGeometry(1, 48, 32)
  const positions = geometry.getAttribute('position')
  const colors = new Float32Array(positions.count * 3)
  const center = new T.Color('#492a20')
  const edge = new T.Color('#865337')
  const tint = new T.Color()
  for (let i = 0; i < positions.count; i++) {
    const radius = Math.hypot(positions.getX(i), positions.getY(i))
    tint.copy(center).lerp(edge, T.MathUtils.smoothstep(radius, 0.25, 1))
    colors.set([tint.r, tint.g, tint.b], i * 3)
  }
  geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3))
  return geometry
}

export function createTeethGeometry() {
  // A tapered ribbon with an elliptical cross section follows the mouth roof.
  const segments = 48, sides = 12
  const vertices: number[] = [], indices: number[] = []
  for (let i = 0; i <= segments; i++) {
    const u = i / segments * 2 - 1
    const taper = Math.sqrt(1 - u * u)
    for (let j = 0; j < sides; j++) {
      const angle = j / sides * Math.PI * 2
      vertices.push(
        u * 0.28,
        1.502 + u * u * 0.014 + Math.sin(angle) * 0.017 * taper,
        0.783 - u * u * 0.105 + Math.cos(angle) * 0.010 * taper,
      )
    }
  }
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < sides; j++) {
      const a = i * sides + j, b = (i + 1) * sides + j
      const c = i * sides + (j + 1) % sides, d = (i + 1) * sides + (j + 1) % sides
      indices.push(a, b, c, b, d, c)
    }
  }
  const geometry = new T.BufferGeometry()
  geometry.setAttribute('position', new T.Float32BufferAttribute(vertices, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

export function createEyelidGeometry() {
  const segments = 32, rows = 4
  const vertices: number[] = [], indices: number[] = []
  const colors: number[] = []
  const inner = new T.Color('#ad8c65'), outer = new T.Color('#d8c49f'), tint = new T.Color()
  for (let i = 0; i <= segments; i++) {
    const angle = i / segments * Math.PI
    const arch = Math.sin(angle)
    for (let j = 0; j <= rows; j++) {
      const across = j / rows
      vertices.push(
        Math.cos(angle) * (0.111 + across * arch * 0.026),
        arch * (0.126 + across * arch * 0.017),
        arch * (0.018 - across * 0.042) + Math.sin(across * Math.PI) * arch * 0.004,
      )
      tint.copy(inner).lerp(outer, T.MathUtils.smoothstep(across, 0, 0.85))
      colors.push(tint.r, tint.g, tint.b)
    }
  }
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < rows; j++) {
      const a = i * (rows + 1) + j, b = (i + 1) * (rows + 1) + j
      indices.push(a, a + 1, b, a + 1, b + 1, b)
    }
  }
  const geometry = new T.BufferGeometry()
  geometry.setAttribute('position', new T.Float32BufferAttribute(vertices, 3))
  geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

export function createTongueGeometry() {
  const geometry = new T.SphereGeometry(1, 48, 28)
  const positions = geometry.getAttribute('position')
  const colors = new Float32Array(positions.count * 3)
  const root = new T.Color('#aa6062'), tip = new T.Color('#eda19c'), tint = new T.Color()
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i)
    const front = T.MathUtils.smoothstep(z, -0.6, 0.65)
    const width = 0.68 + 0.32 * T.MathUtils.smoothstep(z, -0.7, 0.4)
    const groove = y > 0 ? Math.exp(-((x / 0.12) ** 2)) * front * 0.004 : 0
    const lift = 0.033 * (1 - front) + 0.017 * front
    positions.setXYZ(i, x * 0.225 * width, y * 0.045 + lift - groove, z * 0.19)
    tint.copy(root).lerp(tip, front)
    colors.set([tint.r, tint.g, tint.b], i * 3)
  }
  geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3))
  geometry.computeVertexNormals()
  return geometry
}
