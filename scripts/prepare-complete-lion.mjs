import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { lionPalette, recolorLionTexture } from './lion-palette.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const originalPath = resolve(root, 'assets/models/shixiaoxin-complete.glb')
const outputPath = resolve(root, 'public/models/shixiaoxin-complete.glb')
const arguments_ = process.argv.slice(2)
const benchmark = arguments_.includes('--benchmark')
const sourceArgument = arguments_.find(argument => !argument.startsWith('--'))
if (arguments_.some(argument => argument.startsWith('--') && argument !== '--benchmark')) {
  throw new Error('Usage: npm run model:prepare -- [original.glb] [--benchmark]')
}
const sourcePath = sourceArgument ? resolve(sourceArgument) : originalPath
const sourceBytes = await readFile(sourcePath)
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
const originalHash = sha256(sourceBytes)

if (sourcePath !== originalPath) {
  await mkdir(dirname(originalPath), { recursive: true })
  try {
    const backup = await readFile(originalPath)
    if (!backup.equals(sourceBytes)) throw new Error('The original model backup differs; refusing to replace it.')
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
    await writeFile(originalPath, sourceBytes, { flag: 'wx' })
  }
}

function unpackGlb(bytes) {
  if (bytes.length < 20 || bytes.readUInt32LE(0) !== 0x46546c67 || bytes.readUInt32LE(4) !== 2
    || bytes.readUInt32LE(8) !== bytes.length) throw new Error('Expected a valid glTF 2.0 binary.')
  let document, binary
  for (let offset = 12; offset < bytes.length;) {
    const length = bytes.readUInt32LE(offset), type = bytes.readUInt32LE(offset + 4)
    const end = offset + 8 + length
    if (end > bytes.length || length % 4) throw new Error('Invalid GLB chunk length.')
    const data = bytes.subarray(offset + 8, end)
    if (type === 0x4e4f534a) document = JSON.parse(data.toString('utf8'))
    else if (type === 0x004e4942) binary = data
    else throw new Error('Unexpected GLB chunk; refusing to discard model data.')
    offset = end
  }
  if (!document || !binary || document.buffers?.length !== 1 || document.buffers[0].uri) {
    throw new Error('Expected one embedded binary buffer.')
  }
  return { document, binary }
}

const { document, binary } = unpackGlb(sourceBytes)
if (document.nodes?.some(node => node.matrix || node.translation || node.rotation || node.scale)) {
  throw new Error('Apply node transforms before preparing this model.')
}
const views = document.bufferViews.map(view => {
  const start = view.byteOffset || 0
  if (view.buffer !== 0 || start < 0 || start + view.byteLength > binary.length) throw new Error('Invalid buffer view.')
  return Buffer.from(binary.subarray(start, start + view.byteLength))
})
const positions = [...new Set(document.meshes.flatMap(mesh => mesh.primitives.map(primitive => primitive.attributes.POSITION)))]
const minimum = [Infinity, Infinity, Infinity], maximum = [-Infinity, -Infinity, -Infinity]
function visitPositions(callback) {
  for (const index of positions) {
    const accessor = document.accessors[index]
    if (!accessor || accessor.type !== 'VEC3' || accessor.componentType !== 5126 || accessor.sparse) {
      throw new Error('Expected non-sparse Float32 POSITION accessors.')
    }
    const view = document.bufferViews[accessor.bufferView], bytes = views[accessor.bufferView]
    const stride = view.byteStride || 12
    for (let vertex = 0; vertex < accessor.count; vertex++) {
      const offset = (accessor.byteOffset || 0) + vertex * stride
      callback(bytes, offset, accessor)
    }
  }
}
visitPositions((bytes, offset) => {
  for (let axis = 0; axis < 3; axis++) {
    const value = bytes.readFloatLE(offset + axis * 4)
    if (!Number.isFinite(value)) throw new Error('Non-finite vertex position.')
    minimum[axis] = Math.min(minimum[axis], value)
    maximum[axis] = Math.max(maximum[axis], value)
  }
})
const height = maximum[1] - minimum[1]
if (!(height > 0)) throw new Error('The model has no measurable height.')
const scale = 3 / height
const origin = [(minimum[0] + maximum[0]) / 2, minimum[1], (minimum[2] + maximum[2]) / 2]
for (const index of positions) {
  document.accessors[index].min = [Infinity, Infinity, Infinity]
  document.accessors[index].max = [-Infinity, -Infinity, -Infinity]
}
visitPositions((bytes, offset, accessor) => {
  for (let axis = 0; axis < 3; axis++) {
    bytes.writeFloatLE((bytes.readFloatLE(offset + axis * 4) - origin[axis]) * scale, offset + axis * 4)
    const value = bytes.readFloatLE(offset + axis * 4)
    accessor.min[axis] = Math.min(accessor.min[axis], value)
    accessor.max[axis] = Math.max(accessor.max[axis], value)
  }
})

sharp.cache(false)
const textureStats = []
let paletteStats
const baseColorImages = new Set(document.materials.flatMap(material => {
  const texture = material.pbrMetallicRoughness?.baseColorTexture
  return texture ? [document.textures[texture.index].source] : []
}))
for (const [index, image] of document.images.entries()) {
  if (image.uri || image.bufferView === undefined) throw new Error('Expected embedded model textures.')
  const input = views[image.bufferView]
  const metadata = await sharp(input, { failOn: 'error' }).metadata()
  const recolored = baseColorImages.has(index) ? await recolorLionTexture(input, document, views) : null
  if (recolored) paletteStats = recolored.stats
  const encode = size => sharp(recolored?.input || input, { failOn: 'error', ...(recolored ? { raw: recolored.raw } : {}) })
    .resize({ width: size, height: size, fit: 'inside', withoutEnlargement: true })
    .webp({ lossless: true, effort: 6 }).toBuffer({ resolveWithObject: true })
  const web = await encode(2048)
  const originalResolution = benchmark ? await encode(4096) : null
  views[image.bufferView] = web.data
  image.mimeType = 'image/webp'
  textureStats.push({
    image: image.name || index,
    original: `${metadata.width}×${metadata.height}`,
    web: `${web.info.width}×${web.info.height}`,
    originalPngBytes: input.length,
    webp2048Bytes: web.data.length,
    ...(originalResolution ? { webp4096Bytes: originalResolution.data.length } : {}),
  })
}
for (const texture of document.textures) {
  if (texture.source === undefined || !document.images[texture.source]) throw new Error('Texture image source is missing.')
  texture.extensions = { ...texture.extensions, EXT_texture_webp: { source: texture.source } }
  delete texture.source
}
for (const key of ['extensionsUsed', 'extensionsRequired']) {
  document[key] = [...new Set([...(document[key] || []), 'EXT_texture_webp'])]
}

const chunks = []
let byteLength = 0
for (const [index, bytes] of views.entries()) {
  const padding = (4 - byteLength % 4) % 4
  if (padding) { chunks.push(Buffer.alloc(padding)); byteLength += padding }
  document.bufferViews[index].byteOffset = byteLength
  document.bufferViews[index].byteLength = bytes.length
  chunks.push(bytes)
  byteLength += bytes.length
}
const endPadding = (4 - byteLength % 4) % 4
if (endPadding) { chunks.push(Buffer.alloc(endPadding)); byteLength += endPadding }
document.buffers[0].byteLength = byteLength
const binChunk = Buffer.concat(chunks, byteLength)
const json = Buffer.from(JSON.stringify(document), 'utf8')
const jsonChunk = Buffer.alloc(Math.ceil(json.length / 4) * 4, 0x20)
json.copy(jsonChunk)
const output = Buffer.alloc(12 + 8 + jsonChunk.length + 8 + binChunk.length)
output.writeUInt32LE(0x46546c67, 0)
output.writeUInt32LE(2, 4)
output.writeUInt32LE(output.length, 8)
output.writeUInt32LE(jsonChunk.length, 12)
output.writeUInt32LE(0x4e4f534a, 16)
jsonChunk.copy(output, 20)
const binHeader = 20 + jsonChunk.length
output.writeUInt32LE(binChunk.length, binHeader)
output.writeUInt32LE(0x004e4942, binHeader + 4)
binChunk.copy(output, binHeader + 8)
await mkdir(dirname(outputPath), { recursive: true })
await writeFile(outputPath, output)
const backupHash = sha256(await readFile(originalPath))
if (backupHash !== originalHash) throw new Error('The original model backup checksum changed.')

const bounds = positions.reduce((result, index) => {
  const accessor = document.accessors[index]
  for (let axis = 0; axis < 3; axis++) {
    result.min[axis] = Math.min(result.min[axis], accessor.min[axis])
    result.max[axis] = Math.max(result.max[axis], accessor.max[axis])
  }
  return result
}, { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] })
console.log(JSON.stringify({
  original: { path: 'assets/models/shixiaoxin-complete.glb', bytes: sourceBytes.length, sha256: originalHash, backupMatches: backupHash === originalHash },
  web: { path: 'public/models/shixiaoxin-complete.glb', bytes: output.length, sha256: sha256(output), reduction: `${(100 * (1 - output.length / sourceBytes.length)).toFixed(1)}%` },
  bounds, dimensions: bounds.max.map((value, axis) => value - bounds.min[axis]),
  vertices: positions.reduce((total, index) => total + document.accessors[index].count, 0),
  triangles: document.meshes.reduce((total, mesh) => total + mesh.primitives.reduce((count, primitive) => count + document.accessors[primitive.indices].count / 3, 0), 0),
  textures: textureStats,
  palette: lionPalette, paletteStats,
}, null, 2))
