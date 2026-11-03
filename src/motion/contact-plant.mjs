import {Vector3,Quaternion} from 'three'
import {solveLeg} from './foot-ik.mjs'
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
/** Source ankle heights + contact anchors. Kinematic constraints, not body physics. */
export function createContactPlant(vrm){
 const node=name=>vrm.humanoid.getNormalizedBoneNode(name),legs={},hips=node('hips');vrm.scene.updateMatrixWorld(true);
 for(const side of ['left','right']){const foot=node(side+'Foot'),upper=node(side+'UpperLeg'),lower=node(side+'LowerLeg');legs[side]={upper,lower,foot,floor:foot.getWorldPosition(new Vector3()).y,length:upper.getWorldPosition(new Vector3()).distanceTo(lower.getWorldPosition(new Vector3()))+lower.getWorldPosition(new Vector3()).distanceTo(foot.getWorldPosition(new Vector3())),anchor:null,rotation:null,wasRaised:false}}
 let lastLanding=null;
 return {apply(pose){let maxError=null,locked=0,skipped=0,rejected=0,drop=0;const targets={};
  vrm.scene.updateMatrixWorld(true);
  for(const side of ['left','right']){const leg=legs[side],position=leg.foot.getWorldPosition(new Vector3()),full=pose.weight>=.95;
   if(!full||pose.contacts?.[side]!==true)leg.anchor=null;
   if(full&&pose.contacts?.[side]===true&&!leg.anchor){
    if(Math.abs(position.y-leg.floor)>.14&&!Number.isFinite(pose.footHeights?.[side]))skipped++;
    else{leg.anchor=position.clone();leg.anchor.y=leg.floor;leg.rotation=leg.foot.getWorldQuaternion(new Quaternion())}
   }
   let target=leg.anchor?.clone();
   if(!target&&full&&Number.isFinite(pose.footHeights?.[side])){target=position.clone();target.y=leg.floor+clamp(pose.footHeights[side],0,.6)}
   // Even an unconfirmed contact may not pass through the reference ankle plane.
   if(!target&&position.y<leg.floor){target=position.clone();target.y=leg.floor}
   if(!target)continue;targets[side]={position:target,rotation:leg.rotation&&leg.anchor?leg.rotation:leg.foot.getWorldQuaternion(new Quaternion())};
   const hip=leg.upper.getWorldPosition(new Vector3()),horizontal=(hip.x-target.x)**2+(hip.z-target.z)**2;
   if(horizontal<leg.length**2)drop=Math.max(drop,hip.y-target.y-Math.sqrt(Math.max(0,(leg.length-.001)**2-horizontal)));
  }
  if(drop>0){const shift=new Vector3(0,-clamp(drop,0,.1),0).applyQuaternion(hips.parent.getWorldQuaternion(new Quaternion()).invert());hips.position.add(shift);hips.updateWorldMatrix(false,true)}
  for(const side of ['left','right']){const leg=legs[side],target=targets[side];if(!target)continue;
   const hip=leg.upper.getWorldPosition(new Vector3()),knee=leg.lower.getWorldPosition(new Vector3()),axis=target.position.clone().sub(hip).normalize(),pole=knee.clone().sub(hip);pole.addScaledVector(axis,-pole.dot(axis));if(pole.lengthSq()<1e-8)pole.set(0,0,1);pole.normalize();
   const result=solveLeg(leg.upper,leg.lower,leg.foot,target.position,pole);leg.foot.quaternion.copy(leg.foot.parent.getWorldQuaternion(new Quaternion()).invert().multiply(target.rotation));leg.foot.updateWorldMatrix(false,true);
   if(leg.anchor){maxError=Math.max(maxError??0,result.error);if(result.error<.01)locked++;else{rejected++;leg.anchor=null}}
  }
  const heights={};for(const side of ['left','right']){const leg=legs[side],height=leg.foot.getWorldPosition(new Vector3()).y-leg.floor;heights[side]=height;
   if(pose.weight<.95){leg.wasRaised=false;continue}
   if(height>.06)leg.wasRaised=true;
   if(leg.wasRaised&&height<=.025){leg.wasRaised=false;if(Number.isFinite(pose.beat))lastLanding={side,beat:pose.beat,offsetBeats:pose.beat-Math.round(pose.beat)}}
  }
  return {error:maxError,locked,skipped,rejected,heights,lastLanding};
 }};
}
