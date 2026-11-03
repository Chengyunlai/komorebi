import {Vector3} from 'three'
import {createRotationFixture} from '../../stage-15-rotation-retarget/core/rotation-body.mjs'
import {createMotionBank} from '../../../src/motion/motion-bank.mjs'
/** Original whole-body translation fixture: FK endpoints move with the root. */
export function createTranslationBank(){
 const {vrm}=createRotationFixture(),rest=vrm.humanoid.normalizedRestPose,feet=Object.fromEntries(['left','right'].map(side=>[side,vrm.humanoid.getNormalizedBoneNode(side+'Foot').getWorldPosition(new Vector3()).toArray()]));
 const fps=15,frames=Array.from({length:240},(_,i)=>{const shift=.2*Math.sin(i/fps*5);return {rotations:Object.fromEntries(Object.entries(rest).map(([name,p])=>[name,p.rotation.slice()])),hips:[shift,0,0],feet:Object.fromEntries(['left','right'].map(side=>[side,feet[side].map((v,k)=>v+(k===0?shift:0))]))}});
 return {vrm,bank:createMotionBank(frames,{fps}),hipsRest:rest.hips.position};
}
