import sharp from 'sharp'

// Keep the supplied GLB untouched. These colors are applied only to its web copy.
export const lionPalette = {
  body: '#FF9C00',
  forelock: '#FBC700',
  gloves: '#FFFFFF',
  face: '#F6EAD2',
  tail: '#A85A3C',
}
const names = ['original', ...Object.keys(lionPalette)]

function accessorValues(document, views, index) {
  const accessor = document.accessors[index]
  const components = { SCALAR: 1, VEC2: 2, VEC3: 3 }[accessor.type]
  const bytesPerComponent = { 5123: 2, 5125: 4, 5126: 4 }[accessor.componentType]
  if (!components || !bytesPerComponent || accessor.sparse) throw new Error('Unsupported palette accessor.')
  const bytes = views[accessor.bufferView]
  const stride = document.bufferViews[accessor.bufferView].byteStride || components * bytesPerComponent
  const read = accessor.componentType === 5126 ? 'readFloatLE'
    : accessor.componentType === 5125 ? 'readUInt32LE' : 'readUInt16LE'
  return Array.from({ length: accessor.count }, (_, vertex) => Array.from({ length: components }, (_, axis) =>
    bytes[read]((accessor.byteOffset || 0) + vertex * stride + axis * bytesPerComponent)))
}

function colorFamily(r, g, b) {
  const high = Math.max(r, g, b), low = Math.min(r, g, b), range = high - low
  const saturation = high ? range / high : 0
  let hue = range === 0 ? 0 : high === r ? (g - b) / range : high === g ? 2 + (b - r) / range : 4 + (r - g) / range
  hue = (hue * 60 + 360) % 360
  const orange = hue >= 23 && hue <= 66 && saturation > 0.38
  const neutral = saturation < 0.30 && !(hue < 26 && saturation > 0.17)
  const brown = r > g * 1.10 && g >= b * 0.85 && hue < 27 && saturation > 0.25
  return { orange, neutral, brown }
}

function region(x, y, z, family) {
  if (family.orange) {
    if (Math.abs(x) < 0.38 && y > 2.02 && y < 2.82 && z > 0.235) return 2
    return 1
  }
  if (x > 0.84 && y > 0.33 && y < 0.70 && z < -0.55 && family.brown) return 5
  if (!family.neutral) return 0
  if (Math.abs(x) > 0.40 && y > 0.33 && y < 0.74 && z > -0.10 && z < 0.27) return 3
  if (y > 0.95) {
    // Preserve the painted eyes/highlights, nose, teeth, tongue and mouth.
    const eye = ((Math.abs(x) - 0.395) / 0.14) ** 2 + ((y - 1.79) / 0.15) ** 2 < 1 && z < 0.62
    const mouth = Math.abs(x) < 0.56 && y > 1.18 && y < 1.52 && z > 0.20 && z < 0.74
    const nose = Math.abs(x) < 0.15 && y > 1.53 && y < 1.75 && z > 0.68
    if (!eye && !mouth && !nose) return 4
  }
  return 0
}

export async function recolorLionTexture(input, document, views) {
  const { data: original, info } = await sharp(input).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width, height, channels } = info
  if (channels !== 3) throw new Error('Expected RGB lion base-color texture.')
  const pixelCount = width * height
  const labels = new Uint8Array(pixelCount), covered = new Uint8Array(pixelCount)
  const families = new Uint8Array(pixelCount)
  for (let pixel = 0; pixel < pixelCount; pixel++) {
    const offset = pixel * 3
    const family = colorFamily(original[offset], original[offset + 1], original[offset + 2])
    families[pixel] = (family.orange ? 1 : 0) | (family.neutral ? 2 : 0) | (family.brown ? 4 : 0)
    // Orange atlas gutters also need the new fur color to avoid pale seams.
    if (family.orange) labels[pixel] = 1
  }
  for (const mesh of document.meshes) for (const primitive of mesh.primitives) {
    const positions = accessorValues(document, views, primitive.attributes.POSITION)
    const uvs = accessorValues(document, views, primitive.attributes.TEXCOORD_0)
    const indices = accessorValues(document, views, primitive.indices).flat()
    for (let triangle = 0; triangle < indices.length; triangle += 3) {
      const vertices = indices.slice(triangle, triangle + 3)
      // glTF texture UVs use the image's top-left convention (no vertical flip).
      const uv = vertices.map(vertex => [uvs[vertex][0] * width - 0.5, uvs[vertex][1] * height - 0.5])
      const [a, b, c] = uv
      const determinant = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1])
      if (Math.abs(determinant) < 1e-8) continue
      const minX = Math.max(0, Math.ceil(Math.min(a[0], b[0], c[0])))
      const maxX = Math.min(width - 1, Math.floor(Math.max(a[0], b[0], c[0])))
      const minY = Math.max(0, Math.ceil(Math.min(a[1], b[1], c[1])))
      const maxY = Math.min(height - 1, Math.floor(Math.max(a[1], b[1], c[1])))
      for (let row = minY; row <= maxY; row++) for (let column = minX; column <= maxX; column++) {
        const wa = ((b[1] - c[1]) * (column - c[0]) + (c[0] - b[0]) * (row - c[1])) / determinant
        const wb = ((c[1] - a[1]) * (column - c[0]) + (a[0] - c[0]) * (row - c[1])) / determinant
        const wc = 1 - wa - wb
        if (Math.min(wa, wb, wc) < -1e-5) continue
        const pixel = row * width + column, family = families[pixel]
        const p = positions[vertices[0]], q = positions[vertices[1]], r = positions[vertices[2]]
        labels[pixel] = region(
          wa * p[0] + wb * q[0] + wc * r[0],
          wa * p[1] + wb * q[1] + wc * r[1],
          wa * p[2] + wb * q[2] + wc * r[2],
          { orange: family & 1, neutral: family & 2, brown: family & 4 },
        )
        covered[pixel] = 1
      }
    }
  }

  // Extend a part's color into unused atlas texels, never across a painted feature.
  // Eight source pixels provide four web pixels of padding before mipmapping.
  let frontier = []
  for (let pixel = 0; pixel < pixelCount; pixel++) {
    if (covered[pixel] && labels[pixel] > 1) frontier.push(pixel)
  }
  for (let pass = 0; pass < 8; pass++) {
    const next = []
    for (const pixel of frontier) {
      const label = labels[pixel], column = pixel % width
      const neighbors = [pixel - width, pixel + width]
      if (column) neighbors.push(pixel - 1)
      if (column + 1 < width) neighbors.push(pixel + 1)
      for (const neighbor of neighbors) {
        if (neighbor < 0 || neighbor >= pixelCount || covered[neighbor]) continue
        const compatible = label === 2 ? families[neighbor] & 1
          : label === 5 ? families[neighbor] & 4 : families[neighbor] & 2
        if (!compatible) continue
        covered[neighbor] = 2
        labels[neighbor] = label
        next.push(neighbor)
      }
    }
    frontier = next
  }

  // A shared reference per part preserves the source's baked shadows and fine detail.
  // The 90th percentile represents its unshadowed paint, rather than a single hot pixel.
  const histograms = names.map(() => Array.from({ length: 3 }, () => new Uint32Array(256)))
  const counts = new Uint32Array(names.length)
  for (let pixel = 0; pixel < pixelCount; pixel++) {
    const label = labels[pixel]
    if (!label || covered[pixel] !== 1) continue
    counts[label]++
    for (let channel = 0; channel < 3; channel++) histograms[label][channel][original[pixel * 3 + channel]]++
  }
  const anchors = histograms.map((histogram, label) => histogram.map(channel => {
    let count = 0
    for (let value = 0; value < 256; value++) {
      count += channel[value]
      if (count >= counts[label] * 0.90) return Math.max(1, value)
    }
    return 255
  }))
  const colors = [[0, 0, 0], ...Object.values(lionPalette).map(hex => [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16)))]
  const output = Buffer.from(original)
  for (let pixel = 0; pixel < pixelCount; pixel++) {
    const label = labels[pixel]
    if (!label) continue
    for (let channel = 0; channel < 3; channel++) {
      output[pixel * 3 + channel] = Math.min(255, Math.round(original[pixel * 3 + channel] * colors[label][channel] / anchors[label][channel]))
    }
  }
  for (let label = 1; label < names.length; label++) {
    if (!counts[label]) throw new Error(`No texture pixels found for ${names[label]}.`)
  }
  return {
    input: output,
    raw: { width, height, channels },
    stats: Object.fromEntries(names.slice(1).map((name, index) => [name, {
      color: lionPalette[name], paintedPixels: counts[index + 1], sourceReference: anchors[index + 1],
    }])),
  }
}
