import {createReplayFixture} from '../../stage-14-dance-blackboard/core/replay-body.mjs'
export function createRotationFixture(scale=1,restTwist=.2){
 const body=createReplayFixture(scale,restTwist),old=body.bvh,values=new Float32Array(old.frameCount*old.joints.length*6);
 const joints=old.joints.map((j,i)=>({...j,channels:['Xposition','Yposition','Zposition','Xrotation','Yrotation','Zrotation'],channelStart:i*6}));
 for(let f=0;f<old.frameCount;f++)for(let i=0;i<joints.length;i++){
  const pos=old.joints[i].offset.slice();if(i===0)pos[0]+=.01*f;if(joints[i].name==='Hand_L')pos[1]=.1;
  values.set(pos,f*joints.length*6+i*6);
  const phase=f/(old.frameCount-1),angle=joints[i].name==='UpperArm_L'?90*phase:joints[i].name==='Hand_L'?45*phase:joints[i].name==='Toes_R'?30*phase:0;
  values[f*joints.length*6+i*6+3]=angle;
 }
 body.nodes.leftHand.position.y=.1*scale;body.vrm.humanoid.normalizedRestPose.leftHand.position[1]=.1*scale;
 body.vrm.scene.updateMatrixWorld(true);body.bvh={...old,joints,channelCount:joints.length*6,values};return body;
}
