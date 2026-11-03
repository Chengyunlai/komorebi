import {readFileSync} from 'node:fs'
import {createRotationFixture} from '../../stage-15-rotation-retarget/core/rotation-body.mjs'
import {parseBVH} from '../../../src/motion-lab/bvh.mjs'
import {buildSourceMotionMaterial,sampleSourceMaterial} from '../../../src/motion/source-material.mjs'
import {estimatePlanarAlignment,applyPlanarAlignment} from '../../../src/motion/planar-alignment.mjs'
import {planMovingTransition} from '../../../src/motion/moving-transition.mjs'
import {sourcePoseToSkeleton} from '../../../src/motion/material-skeleton.mjs'
const file=process.argv[2],bvh=file?parseBVH(readFileSync(file,'utf8')):createRotationFixture().bvh;
const m=buildSourceMotionMaterial(bvh,{metersPerUnit:file?Number(process.argv[3]):1,sourceId:file?'local-research':'original-fixture'});
const outgoingTime=file?10.5:.2,incomingTime=file?12.6:.8,duration=.5;
const outgoing=t=>sampleSourceMaterial(m,outgoingTime+t),incoming=t=>sampleSourceMaterial(m,incomingTime+t);
const alignment=estimatePlanarAlignment(m,outgoing(0),incoming(0));
const aligned=t=>applyPlanarAlignment(m,incoming(t),alignment);
const a0=sourcePoseToSkeleton(m,outgoing(0)),b0=sourcePoseToSkeleton(m,aligned(0)),hi=m.rig.findIndex(j=>j.id===m.rootBones.anatomicalHips);
const measuredStart={planarError:Math.hypot(a0.positions[hi][0]-b0.positions[hi][0],a0.positions[hi][2]-b0.positions[hi][2])*m.metersPerUnit,heightDifference:(b0.positions[hi][1]-a0.positions[hi][1])*m.metersPerUnit};
const plan=planMovingTransition({outgoing,incoming:aligned,duration});
// Read the same transformed incoming window after blend end: no space reset.
const rawPlan=planMovingTransition({outgoing,incoming,duration});
const hipsIndex=m.rig.findIndex(j=>j.id===m.rootBones.anatomicalHips);
const peakPlanarSpeed=trajectory=>{let previous,peak=0;for(let i=0;i<=60;i++){const pose=sourcePoseToSkeleton(m,trajectory.sample(i*duration/60)),position=pose.positions[hipsIndex].map(v=>v*m.metersPerUnit);if(previous)peak=Math.max(peak,Math.hypot(position[0]-previous[0],position[2]-previous[2])*60/duration);previous=position;}return peak};
const planarHipSpeed={unaligned:peakPlanarSpeed(rawPlan),aligned:peakPlanarSpeed(plan),unit:'metre/second',samplingHz:60/duration};
const samples=Array.from({length:31},(_,i)=>sourcePoseToSkeleton(m,plan.sample(i*duration/30))).length;
const end=sourcePoseToSkeleton(m,plan.sample(duration)),next=sourcePoseToSkeleton(m,aligned(duration));
let boundaryError=0;for(let i=0;i<end.matrices.length;i++)for(let k=0;k<16;k++)boundaryError=Math.max(boundaryError,Math.abs(end.matrices[i][k]-next.matrices[i][k]));
console.log(JSON.stringify({schema:'planar-alignment-example/v1',sourceId:m.sourceId,sourceFrames:m.frames.length,outgoingTime,incomingTime,duration,alignment,measuredStart,boundaryMatrixError:boundaryError,planarHipSpeed,samples,scope:'aggregate; rigid planar alignment only; no contacts, music sync or aesthetics assertion'},null,2));
