import {readFileSync} from 'node:fs'
import {parseBVH} from '../../../src/motion-lab/bvh.mjs'
import {buildSourceMotionMaterial,sampleSourceMaterial,describeSourceMaterialBoundary} from '../../../src/motion/source-material.mjs'
import {signedAngularVelocity} from '../../../src/motion/source-material.mjs'
import {planMovingTransition} from '../../../src/motion/moving-transition.mjs'

const file=process.argv[2];
const fixture={joints:[{name:'Hips',parent:-1,offset:[0,0,0],channels:['Xposition','Zrotation'],channelStart:0}],channelCount:2,frameCount:61,frameTime:1/30,values:Float32Array.from({length:122},(_,i)=>i%2?Math.floor(i/2):Math.floor(i/2)/30)};
const bvh=file?parseBVH(readFileSync(file,'utf8')):fixture;
const material=buildSourceMotionMaterial(bvh,{sourceId:file?'local-research':'original-constant-velocity',metersPerUnit:file?Number(process.argv[3]):1,provenance:{usage:file?'local research only':'original synthetic fixture'}});
const duration=Math.min(.3,material.range.duration/4),start=file?Math.min(9,material.range.end-duration):material.range.start;
// Same source window provides an identity control: no alignment/IK should rewrite it.
const sampler=t=>({...sampleSourceMaterial(material,start+t),contacts:{left:{state:'unknown'},right:{state:'unknown'}}});
const transition=planMovingTransition({outgoing:sampler,incoming:sampler,duration});
// Compare two distinct source windows; no contact or music compatibility is asserted.
const secondStart=Math.min(material.range.end-duration,Math.max(start,material.range.duration*.2));
const incoming=t=>({...sampleSourceMaterial(material,secondStart+t),contacts:{left:{state:'unknown'},right:{state:'unknown'}}});
const distinct=planMovingTransition({outgoing:sampler,incoming,duration});
const h=1e-5;
const jointVelocity=(fn,a,b)=>{const x=fn(a),y=fn(b);return Object.fromEntries(Object.keys(x.joints).map(id=>[id,signedAngularVelocity(x.joints[id].rotation,y.joints[id].rotation,b-a)]))};
const boundaryError=(source,a,b)=>{const x=jointVelocity(distinct.sample,a,b),y=jointVelocity(source,a,b);return Math.max(...Object.keys(x).map(id=>Math.hypot(...x[id].map((v,k)=>v-y[id][k]))))};
const distinctSummary={duration,secondStart,samples:Array.from({length:31},(_,i)=>distinct.sample(i*duration/30)).length,maxJointBoundaryAngularVelocityError:{start:boundaryError(sampler,0,h),end:boundaryError(incoming,duration-h,duration)},contacts:'unknown; no planting constraints applied',scope:'numerical endpoint control; no claim of compatible choreography'};
const end=describeSourceMaterialBoundary(material,'end');
console.log(JSON.stringify({schema:'source-material-example/v1',sourceId:material.sourceId,frameCount:material.frames.length,sourceFrames:bvh.frameCount,range:material.range,coordinate:material.coordinate,annotations:material.annotations,boundaryHasSignedVelocity:!!end.root?.angularVelocity,identityMovingWindow:transition.diagnoseBoundaries(),distinctMovingWindows:distinctSummary,scope:'aggregate only; no derived poses exported; identity transition does not validate different-segment choreography'},null,2));
