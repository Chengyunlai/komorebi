import {readFileSync} from 'node:fs'
import {createRotationFixture} from '../core/rotation-body.mjs'
import {parseBVH} from '../../../src/motion-lab/bvh.mjs'
import {createReplayExperiment} from '../../../src/motion/replay-experiment.mjs'
import {comparePoseRecords} from '../../../src/motion/motion-record.mjs'
const body=createRotationFixture(),bvh=process.argv[2]?parseBVH(readFileSync(process.argv[2],'utf8')):body.bvh,r=createReplayExperiment(body.vrm,bvh),times=process.argv[2]?[12.533,23.5,41.8]:[79*bvh.frameTime];
const rows=times.map(time=>{const a=r.evaluate({time,retargetMode:'direction'}),b=r.evaluate({time,retargetMode:'rotation'});r.evaluate({time:0,retargetMode:'rotation'});const again=r.evaluate({time,retargetMode:'rotation'});return {time:b.trace.time,mapped:b.trace.sourceMapping.mappedBones.length,directionResidual:a.trace.rotationResidual.maxRadians,rotationResidual:b.trace.rotationResidual.maxRadians,directionTwistComponent:a.trace.rotationResidual.maxTwistRadians,modeChange:comparePoseRecords(a.trace.retarget,b.trace.retarget).maxAngular,repeatable:JSON.stringify(again.trace)===JSON.stringify(b.trace)}});
console.log(JSON.stringify({body:'original synthetic rig; actual VRM verified separately in native app',source:process.argv[2]?'local research BVH':'original pure-twist fixture',calibration:r.profile.retargetModes.calibration,rows},null,2));
