import assert from 'node:assert/strict'
import * as T from 'three'
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js'
import * as sculpt from '../src/shizi/lionGeometry.ts'

// Verify geometry that must survive arbitrary camera angles and close inspection.
const builders = ['createMane', 'createFace', 'createMouth', 'createForelock', 'createBody', 'createTailTip', 'createMitten', 'createPaw']
let totalTriangles = 0
for (const name of builders) {
  const geometry = sculpt[name]()
  for (const attribute of Object.values(geometry.attributes)) {
    assert.ok(Array.from(attribute.array).every(Number.isFinite), `${name}: invalid vertex attribute`)
  }
  geometry.computeBoundingBox()
  const size = geometry.boundingBox.getSize(new T.Vector3())
  assert.ok(size.x > 0 && size.y > 0 && size.z > 0, `${name}: collapsed volume`)
  const topology = geometry.clone()
  for (const key of Object.keys(topology.attributes)) if (key !== 'position') topology.deleteAttribute(key)
  const welded = mergeVertices(topology, 0.00001)
  const position = welded.attributes.position, index = welded.index.array, edges = new Map()
  let volume = 0
  for (let i = 0; i < index.length; i += 3) {
    const [a, b, c] = [index[i], index[i + 1], index[i + 2]]
    if (a === b || b === c || a === c) continue
    for (const [u, v] of [[a, b], [b, c], [c, a]]) {
      const key = `${Math.min(u, v)}:${Math.max(u, v)}`
      edges.set(key, (edges.get(key) ?? 0) + 1)
    }
    const va = new T.Vector3().fromBufferAttribute(position, a)
    const vb = new T.Vector3().fromBufferAttribute(position, b)
    const vc = new T.Vector3().fromBufferAttribute(position, c)
    volume += va.dot(vb.cross(vc)) / 6
  }
  assert.ok([...edges.values()].every(n => n <= 2), `${name}: non-manifold edge`)
  const boundaries = [...edges.values()].filter(n => n === 1).length
  assert.equal(boundaries, ['createFace', 'createMouth'].includes(name) ? 160 : 0, `${name}: unexpected hole or unwelded seam`)
  assert.ok(volume > 0, `${name}: inside-out surface`)
  totalTriangles += geometry.index.count / 3
  geometry.dispose(); topology.dispose(); welded.dispose()
}
assert.ok(totalTriangles < 110_000, `Sculpture exceeds the mobile geometry budget: ${totalTriangles}`)
console.log(`Verified ${builders.length} sculptures: finite attributes, outward winding, manifold surfaces and mouth opening. ${totalTriangles.toLocaleString()} triangles.`)
