import {readFileSync} from 'node:fs'
import {parseBVH} from '../../../src/motion-lab/bvh.mjs'
import {buildSourceMotionMaterial} from '../../../src/motion/source-material.mjs'
import {annotateDanceStructure} from '../../../src/motion/dance-structure.mjs'
import {planDancePhrases} from '../../../src/motion/dance-planner.mjs'

const file = process.argv[2]
if (!file) throw Error('Pass a local BVH path; the example does not bundle source motion')
const bpm = Number(process.argv[3] || 120)
const musicDuration = Number(process.argv[4] || 30)

const bvh = parseBVH(readFileSync(file, 'utf8'))
const material = buildSourceMotionMaterial(bvh, {
  sourceId: 'local-bvh-research',
  metersPerUnit: .01,
  provenance: {license: 'CC BY-NC 4.0 - local research only, not redistributed', unitAssumption: 'centimetres declared explicitly'},
})
const structure = annotateDanceStructure(material, {fps: 1 / bvh.frameTime})
// Flat medium energy by default; callers can replace this curve with real analyzer features.
const energy = []
for (let time = 0; time <= musicDuration; time += .5) energy.push({time, value: .5})
const plan = planDancePhrases({structure, music: {bpm, duration: musicDuration, energy}})
console.log(JSON.stringify(plan, null, 2))
