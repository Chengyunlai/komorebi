import assert from 'node:assert/strict'
import {createFreestyleMotionPlayer} from '../../../src/motion/freestyle-motion.mjs'

// Two synthetic recordings: hand-only noise and coordinated full-body movement.
const frames = Array.from({length: 600}, (_, i) => {
  const arm = Math.sin(i * .18) * .5, leg = i < 300 ? 0 : Math.sin(i * .1) * .4
  return {rotations: {hips:[0,0,0,1],leftUpperArm:[Math.sin(arm/2),0,0,Math.cos(arm/2)],leftUpperLeg:[Math.sin(leg/2),0,0,Math.cos(leg/2)]},
    hips:[0,0,0],feet:{left:[.1,0,0],right:[-.1,0,0]}}
})
const clips = [{id:'hand-only',start:0,end:299},{id:'body',start:300,end:599}]
const player = createFreestyleMotionPlayer(frames,{clips})
let pose, maxArmStep=0, previous
for(let i=0;i<1200;i++){
  pose=player.step({dt:1/60,active:i<1140,energy:i%2,accent:i%2,onset:i%15===0,bpm:120})
  assert.equal(pose.clip,1,'choose coordinated material rather than hand-only movement')
  if(previous)maxArmStep=Math.max(maxArmStep,Math.abs(pose.rotations.leftUpperArm[0]-previous.rotations.leftUpperArm[0]))
  previous=pose
}
assert.equal(pose.weight,0,'silence fades out')
console.log(JSON.stringify({schema:'motion-continuity-example/v1',synthetic:true,seconds:20,clips:player.bank.clips.length,selectedClip:clips[pose.clip].id,switches:pose.switches,stoppedWeight:pose.weight,maxArmQuaternionComponentStep:maxArmStep},null,2))
