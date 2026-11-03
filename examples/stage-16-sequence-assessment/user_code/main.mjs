import {readFileSync} from 'node:fs'
import {createRotationFixture} from '../../stage-15-rotation-retarget/core/rotation-body.mjs'
import {createReplayExperiment} from '../../../src/motion/replay-experiment.mjs'
import {assessReplaySegment} from '../../../src/motion/segment-assessment.mjs'
import {parseBVH} from '../../../src/motion-lab/bvh.mjs'
const body=createRotationFixture(),bvh=process.argv[2]?parseBVH(readFileSync(process.argv[2],'utf8')):body.bvh;
const experiment=createReplayExperiment(body.vrm,bvh),start=Number(process.argv[3]??(process.argv[2]?9:.1)),end=Number(process.argv[4]??(process.argv[2]?18:2.5));
const result=await assessReplaySegment(experiment,{start,end,frameTime:bvh.frameTime,rootMode:process.argv[5]||'height'});
console.log(JSON.stringify({body:'synthetic rig; actual local VRM is assessed separately in the native study',source:process.argv[2]?'local research BVH':'original fixture',...result},null,2));
