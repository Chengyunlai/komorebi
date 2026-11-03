import assert from 'node:assert/strict'
import {Vector3} from 'three'
import {projectGarmentPoint} from '../../../src/motion/garment-clearance.mjs'
import {createFreestyleMotionPlayer} from '../../../src/motion/freestyle-motion.mjs'

// Synthetic geometry and recording; no avatar, song or research material required.
const volume={top:0,bottom:-.3,radiusX:.2,radiusZ:.16}
const before=projectGarmentPoint(new Vector3(.1,-.1,.06),volume)
const after=projectGarmentPoint(before.point,volume)
assert.ok(before.depth>0);assert.ok(after.depth<1e-7)
const frames=Array.from({length:600},(_,i)=>{
 const a=.5*Math.sin(2*Math.PI*i/15),q=[Math.sin(a/2),0,0,Math.cos(a/2)]
 return {rotations:{hips:[0,0,0,1],chest:q,leftUpperArm:q,leftUpperLeg:q},hips:[0,0,0],feet:{left:[.1,0,0],right:[-.1,0,0]}}
})
const player=createFreestyleMotionPlayer(frames)
let pose,maxPulse=0
for(let i=0;i<120;i++){
 pose=player.step({dt:1/60,active:true,bpm:100,musicReliable:false,onset:i%30===0,onsetStrength:.9})
 assert.equal(pose.rhythm.rate,1,'an uncertain 100 BPM must not slow unknown source tempo')
 maxPulse=Math.max(maxPulse,pose.rhythm.pulse)
}
assert.ok(maxPulse>.2)
console.log(JSON.stringify({schema:'garment-rhythm-example/v1',synthetic:true,proxyDepthBefore:before.depth,proxyDepthAfter:after.depth,nativeRate:pose.rhythm.rate,musicMode:pose.rhythm.mode,maxPulse},null,2))
