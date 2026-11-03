import {Vector3,Quaternion,Matrix4} from 'three'
import {createRotationFixture} from '../../stage-15-rotation-retarget/core/rotation-body.mjs'
import {buildSourceMotionMaterial,sampleSourceMaterial} from '../../../src/motion/source-material.mjs'
import {sourcePoseToSkeleton} from '../../../src/motion/material-skeleton.mjs'
import {createMaterialSequence} from '../../../src/motion/material-sequence.mjs'
import {createFootWindowAssessment} from '../../../src/motion/foot-window-assessment.mjs'
import {createSourceAnkleTracker} from '../../../src/motion/source-ankle-tracker.mjs'
import {createVRMRotationRetarget} from '../../../src/motion-lab/rotation-retarget.mjs'
function run(enabled){
 const {vrm,bvh,nodes}=createRotationFixture();
 for(const side of ['left','right'])for(const [name,factor] of [['LowerLeg',.8],['Foot',1.2]]){nodes[side+name].position.y*=factor;vrm.humanoid.normalizedRestPose[side+name].position=nodes[side+name].position.toArray()}
 for(let f=0;f<bvh.frameCount;f++)for(const name of ['UpperLeg_L','LowerLeg_L','UpperLeg_R','LowerLeg_R']){const j=bvh.joints.find(j=>j.name===name);bvh.values[f*bvh.channelCount+j.channelStart+3]=(name.includes('Lower')?20:25)*Math.sin(f*.06)}
 for(const side of ['left','right']){nodes[side+'UpperLeg'].position.y-=.12;vrm.humanoid.normalizedRestPose[side+'UpperLeg'].position=nodes[side+'UpperLeg'].position.toArray()}
 const hipSource=bvh.joints.find(j=>j.name==='Hips');for(let f=0;f<bvh.frameCount;f++)bvh.values[f*bvh.channelCount+hipSource.channelStart+3]=10*Math.sin(f*.06);
 vrm.scene.updateMatrixWorld(true);const m=buildSourceMotionMaterial(bvh,{metersPerUnit:1}),adapter=createVRMRotationRetarget(vrm,bvh,{rootMode:'source'}),sequence=createMaterialSequence(m,{outgoingStart:.1,incomingStart:.7,total:1.5,transitionStart:.5,transitionDuration:.3});
 const mapping={sourceToTargetYaw:0,sourceMetresToTargetMetres:adapter.scale,sourceToTargetRotation:adapter.sourceToTargetRotation},assessment=createFootWindowAssessment(mapping);
 const feet=s=>Object.fromEntries([['left','Foot_L'],['right','Foot_R']].map(([side,name])=>[side,s.positions[m.rig.findIndex(j=>j.name===name)]]));
 const socket=s=>{const ids=['UpperLeg_L','UpperLeg_R'].map(name=>m.rig.findIndex(j=>j.name===name));return s.positions[ids[0]].map((v,i)=>(v+s.positions[ids[1]][i])*.5)};
 const first=sourcePoseToSkeleton(m,sampleSourceMaterial(m,m.range.start));adapter.applyFrame(first);vrm.update(0);const tracker=createSourceAnkleTracker(vrm,{...mapping,sourceSocketAnchor:socket(first),targetSocketAnchor:vrm.humanoid.getNormalizedBoneNode('leftUpperLeg').getWorldPosition(new Vector3()).add(vrm.humanoid.getNormalizedBoneNode('rightUpperLeg').getWorldPosition(new Vector3())).multiplyScalar(.5).toArray(),maxRootShift:.3,sourceAnchor:feet(first),targetAnchor:Object.fromEntries(['left','right'].map(side=>[side,vrm.humanoid.getNormalizedBoneNode(side+'Foot').getWorldPosition(new Vector3()).toArray()]))});
 let maxDesiredError=0,maxRotationRewriteRadians=0,projectedCount=0,maxRootShift=0;
 for(let i=0;i<=90;i++){const time=i/60,item=sequence.sample(time),s=sourcePoseToSkeleton(m,item.pose);adapter.applyFrame(s);vrm.update(0);if(enabled){const report=tracker.apply(feet(s),{sourceSocketMidpoint:socket(s)});maxDesiredError=Math.max(maxDesiredError,report.maxDesiredError);maxRootShift=Math.max(maxRootShift,report.rootShiftMagnitude);maxRotationRewriteRadians=Math.max(maxRotationRewriteRadians,report.maxRotationRewriteRadians);projectedCount+=report.projectedCount;vrm.update(0)}const sourceFeet={},targetFeet={};for(const [side,name] of [['left','Foot_L'],['right','Foot_R']]){const index=m.rig.findIndex(j=>j.name===name),bone=vrm.humanoid.getNormalizedBoneNode(side+'Foot');sourceFeet[side]={position:s.positions[index],rotation:new Quaternion().setFromRotationMatrix(new Matrix4().fromArray(s.matrices[index]).transpose()).normalize().toArray(),evidence:item.evidence[side]};targetFeet[side]={position:bone.getWorldPosition(new Vector3()).toArray(),rotation:bone.getWorldQuaternion(new Quaternion()).toArray()};}assessment.push({time,sourceFeet,targetFeet,phase:item.phase});}
 return {enabled,tracking:{maxDesiredError,maxRotationRewriteRadians,projectedCount,maxRootShift},...assessment.finish()};
}
console.log(JSON.stringify({schema:'ankle-tracking-example/v1',body:'original synthetic; upper/lower leg proportions and pelvis-to-socket offset differ from source',baseline:run(false),tracking:run(true),scope:'ankle trajectory only; no soles/contact/music assertion'},null,2));
