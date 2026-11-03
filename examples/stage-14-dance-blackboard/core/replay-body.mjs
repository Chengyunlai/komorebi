import {Object3D,Euler} from 'three'
export function createReplayFixture(size=1,restTwist=.12){
 const scene=new Object3D(),nodes={};
 const parent={spine:'hips',chest:'spine',neck:'chest',head:'neck',leftUpperArm:'chest',leftLowerArm:'leftUpperArm',leftHand:'leftLowerArm',rightUpperArm:'chest',rightLowerArm:'rightUpperArm',rightHand:'rightLowerArm',leftUpperLeg:'hips',leftLowerLeg:'leftUpperLeg',leftFoot:'leftLowerLeg',leftToes:'leftFoot',rightUpperLeg:'hips',rightLowerLeg:'rightUpperLeg',rightFoot:'rightLowerLeg',rightToes:'rightFoot'};
 const positions={hips:[0,.9,0],spine:[0,.2,0],chest:[0,.2,0],neck:[0,.12,0],head:[0,.12,0],leftUpperArm:[.15,.1,0],leftLowerArm:[.26,0,0],leftHand:[.24,0,0],rightUpperArm:[-.15,.1,0],rightLowerArm:[-.26,0,0],rightHand:[-.24,0,0],leftUpperLeg:[.09,0,0],leftLowerLeg:[0,-.42,.04],leftFoot:[0,-.42,-.04],leftToes:[0,-.04,.12],rightUpperLeg:[-.09,0,0],rightLowerLeg:[0,-.42,.04],rightFoot:[0,-.42,-.04],rightToes:[0,-.04,.12]};
 const names=Object.keys(positions);for(const name of names){const bone=nodes[name]=new Object3D();(nodes[parent[name]]||scene).add(bone);bone.name=name;bone.position.fromArray(positions[name]).multiplyScalar(size);if(name==='spine')bone.quaternion.setFromEuler(new Euler(0,restTwist,0))}
 const rest=Object.fromEntries(names.map(n=>[n,{position:nodes[n].position.toArray(),rotation:nodes[n].quaternion.toArray()}]));
 const vrm={scene,humanoid:{normalizedRestPose:rest,getNormalizedBoneNode:n=>nodes[n],getRawBoneNode:n=>nodes[n],resetNormalizedPose(){for(const n of names){nodes[n].position.fromArray(rest[n].position);nodes[n].quaternion.fromArray(rest[n].rotation)}},update(){}},update(){scene.updateMatrixWorld(true)}};
 const sourceNames=['Hips','Spine','Chest','Neck','Head','UpperArm_L','LowerArm_L','Hand_L','UpperArm_R','LowerArm_R','Hand_R','UpperLeg_L','LowerLeg_L','Foot_L','Toes_L','UpperLeg_R','LowerLeg_R','Foot_R','Toes_R'];
 const joints=sourceNames.map((name,i)=>({name,parent:parent[names[i]]?names.indexOf(parent[names[i]]):-1,offset:positions[names[i]],channels:['Xposition','Yposition','Zposition'],channelStart:i*3}));
 const bvh={joints,channelCount:names.length*3,frameCount:80,frameTime:1/30,duration:80/30,values:new Float32Array(names.length*3*80)};
 for(let f=0;f<80;f++)for(let i=0;i<names.length;i++){const p=[...positions[names[i]]];if(i===0)p[0]+=.01*f;if(names[i]==='leftLowerArm')p[1]=Math.sin(f*.1)*.12;bvh.values.set(p,f*bvh.channelCount+i*3)}
 scene.updateMatrixWorld(true);return {vrm,bvh,nodes};
}
