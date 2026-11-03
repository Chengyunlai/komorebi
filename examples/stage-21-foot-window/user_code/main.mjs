import {Vector3,Quaternion,Matrix4} from 'three'
import {createRotationFixture} from '../../stage-15-rotation-retarget/core/rotation-body.mjs'
import {buildSourceMotionMaterial} from '../../../src/motion/source-material.mjs'
import {sourcePoseToSkeleton} from '../../../src/motion/material-skeleton.mjs'
import {createMaterialSequence} from '../../../src/motion/material-sequence.mjs'
import {createFootWindowAssessment} from '../../../src/motion/foot-window-assessment.mjs'
import {createVRMRotationRetarget} from '../../../src/motion-lab/rotation-retarget.mjs'
const {vrm,bvh}=createRotationFixture(),m=buildSourceMotionMaterial(bvh,{metersPerUnit:1}),adapter=createVRMRotationRetarget(vrm,bvh,{rootMode:'source'}),sequence=createMaterialSequence(m,{outgoingStart:.1,incomingStart:.7,total:1.5,transitionStart:.5,transitionDuration:.3}),assessment=createFootWindowAssessment({sourceToTargetYaw:0,sourceMetresToTargetMetres:adapter.scale,sourceToTargetRotation:adapter.sourceToTargetRotation});
for(let i=0;i<=90;i++){const time=i/60,item=sequence.sample(time),skeleton=sourcePoseToSkeleton(m,item.pose);adapter.applyFrame(skeleton);vrm.update(0);const sourceFeet={},targetFeet={};for(const [side,name] of [['left','Foot_L'],['right','Foot_R']]){const index=m.rig.findIndex(j=>j.name===name),bone=vrm.humanoid.getNormalizedBoneNode(side+'Foot');sourceFeet[side]={position:skeleton.positions[index],rotation:new Quaternion().setFromRotationMatrix(new Matrix4().fromArray(skeleton.matrices[index]).transpose()).toArray(),evidence:item.evidence[side]};targetFeet[side]={position:bone.getWorldPosition(new Vector3()).toArray(),rotation:bone.getWorldQuaternion(new Quaternion()).toArray()};}assessment.push({time,sourceFeet,targetFeet,phase:item.phase});}
console.log(JSON.stringify({body:'original synthetic body; no sole geometry',...assessment.finish()},null,2));
