import {readFileSync} from 'node:fs'
import {parseBVH} from '../../../src/motion-lab/bvh.mjs'
import {buildSourceMotionMaterial} from '../../../src/motion/source-material.mjs'
import {annotateDanceStructure} from '../../../src/motion/dance-structure.mjs'

const file = process.argv[2]
if (!file) throw Error('Pass a local BVH path; the example does not bundle source motion')
const bvh = parseBVH(readFileSync(file, 'utf8'))
const material = buildSourceMotionMaterial(bvh, {
  sourceId: 'local-bvh-research',
  metersPerUnit: .01,
  provenance: {license: 'CC BY-NC 4.0 - local research only, not redistributed', unitAssumption: 'centimetres declared explicitly'},
})
const structure = annotateDanceStructure(material, {fps: 1 / bvh.frameTime})
console.log(JSON.stringify(structure, null, 2))
