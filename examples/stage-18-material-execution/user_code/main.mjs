import {createRotationFixture} from '../../stage-15-rotation-retarget/core/rotation-body.mjs'
import {buildSourceMotionMaterial,sampleSourceMaterial} from '../../../src/motion/source-material.mjs'
import {sourcePoseToSkeleton} from '../../../src/motion/material-skeleton.mjs'
import {planMovingTransition} from '../../../src/motion/moving-transition.mjs'
import {createVRMRotationRetarget} from '../../../src/motion-lab/rotation-retarget.mjs'
import {capturePoseRecord,comparePoseRecords} from '../../../src/motion/motion-record.mjs'
const {vrm,bvh}=createRotationFixture(),material=buildSourceMotionMaterial(bvh,{metersPerUnit:.01,sourceId:'original-fixture'});
const adapter=createVRMRotationRetarget(vrm,bvh,{rootMode:'source'});
const plan=planMovingTransition({outgoing:t=>sampleSourceMaterial(material,t),incoming:t=>sampleSourceMaterial(material,.5+t),duration:.3});
const poses=[];let residual=0;
for(let i=0;i<=30;i++){const skeleton=sourcePoseToSkeleton(material,plan.sample(i*.3/30),{frame:i});const report=adapter.applyFrame(skeleton);vrm.update(0);residual=Math.max(residual,report.rotationResidual.maxRadians);poses.push(capturePoseRecord(vrm));}
console.log(JSON.stringify({schema:'material-execution-example/v1',samples:poses.length,mappedBones:adapter.mappedBones.length,maxCalibrationResidual:residual,targetChange:comparePoseRecords(poses[0],poses.at(-1)),scope:'synthetic target execution; no skinning/contacts/music assertion'},null,2));
