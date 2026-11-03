import {Vector3,Quaternion} from 'three'
const sides=['left','right'];
const vector=(value,name)=>{if(!Array.isArray(value)||value.length!==3||!value.every(Number.isFinite))throw Error(`Invalid ${name}`);return new Vector3(...value)};
const angle=(a,b)=>a.angleTo(b);
/** Apply after baseline rotation retargeting. All anchors and endpoints are world metres.
 * Rotated parents and uniform world scale are supported; nonuniform parent scale is unsupported.
 * `reachable` describes the guarded solve domain; `geometricReachable` includes exact extension. */
export function createSourceAnkleTracker(vrm,mapping){
 if(!mapping||!Number.isFinite(mapping.sourceToTargetYaw)||!Number.isFinite(mapping.sourceMetresToTargetMetres)||mapping.sourceMetresToTargetMetres<=0)throw Error('Invalid source mapping');
 const yaw=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),mapping.sourceToTargetYaw),scale=mapping.sourceMetresToTargetMetres;
 const anchors={},legs={};
 for(const side of sides){anchors[side]={source:vector(mapping.sourceAnchor?.[side],'source anchor'),target:vector(mapping.targetAnchor?.[side],'target anchor')};const upper=vrm.humanoid.getNormalizedBoneNode(side+'UpperLeg'),lower=vrm.humanoid.getNormalizedBoneNode(side+'LowerLeg'),foot=vrm.humanoid.getNormalizedBoneNode(side+'Foot');if(!upper||!lower||!foot||!upper.parent)throw Error('Missing leg bones');legs[side]={upper,lower,foot}}
 const socketEnabled=mapping.sourceSocketAnchor!==undefined||mapping.targetSocketAnchor!==undefined;
 const socketSource=socketEnabled?vector(mapping.sourceSocketAnchor,'source socket anchor'):null,socketTarget=socketEnabled?vector(mapping.targetSocketAnchor,'target socket anchor'):null,maxRootShift=mapping.maxRootShift??.3;
 if(!Number.isFinite(maxRootShift)||maxRootShift<0)throw Error('Invalid maxRootShift');
 const hips=socketEnabled?vrm.humanoid.getNormalizedBoneNode('hips'):null;
 if(socketEnabled&&(!hips||!hips.parent))throw Error('Missing hips bone');
 return {apply(sourceFeet,{sourceSocketMidpoint}={}){
  // Validate the complete sample before touching either leg.
  const targets={};for(const side of sides)targets[side]=vector(sourceFeet?.[side],'source foot').sub(anchors[side].source).multiplyScalar(scale).applyQuaternion(yaw).add(anchors[side].target);
  const desiredSocket=socketEnabled?vector(sourceSocketMidpoint,'source socket midpoint').sub(socketSource).multiplyScalar(scale).applyQuaternion(yaw).add(socketTarget):null;
  if(!socketEnabled&&sourceSocketMidpoint!==undefined)vector(sourceSocketMidpoint,'source socket midpoint');
  vrm.scene.updateMatrixWorld(true);
  const rootShift=new Vector3();let rootShiftClamped=false;
  if(socketEnabled){const current=legs.left.upper.getWorldPosition(new Vector3()).add(legs.right.upper.getWorldPosition(new Vector3())).multiplyScalar(.5);rootShift.copy(desiredSocket).sub(current);rootShiftClamped=rootShift.length()>maxRootShift;if(rootShiftClamped)rootShift.setLength(maxRootShift)}
  const plans={};
  for(const side of sides){const {upper,lower,foot}=legs[side],hip=upper.getWorldPosition(new Vector3()).add(rootShift),knee=lower.getWorldPosition(new Vector3()).add(rootShift),ankle=foot.getWorldPosition(new Vector3()).add(rootShift),a=hip.distanceTo(knee),b=knee.distanceTo(ankle);if(a<1e-6||b<1e-6)throw Error('Invalid leg lengths');
   const desired=targets[side],axis=desired.clone().sub(hip),rawDistance=axis.length(),margin=Math.min(a,b)*1e-4,min=Math.abs(a-b)+margin,max=a+b-margin,distance=Math.max(min,Math.min(max,rawDistance));
   if(rawDistance>1e-10)axis.divideScalar(rawDistance);else{axis.copy(ankle).sub(hip);if(axis.lengthSq()<1e-12)axis.set(0,-1,0);axis.normalize()}
   const pole=knee.clone().sub(hip).addScaledVector(axis,-knee.clone().sub(hip).dot(axis));let poleFallback=pole.lengthSq()<1e-10;
   if(poleFallback){const candidate=Math.abs(axis.z)<.8?new Vector3(0,0,1):new Vector3(1,0,0);pole.copy(candidate).addScaledVector(axis,-candidate.dot(axis))}pole.normalize();
   const along=(a*a-b*b+distance*distance)/(2*distance),height=Math.sqrt(Math.max(0,a*a-along*along));
   plans[side]={desired,knee:hip.clone().addScaledVector(axis,along).addScaledVector(pole,height),target:hip.clone().addScaledVector(axis,distance),poleFallback,reachMargin:margin,geometricReachable:rawDistance>=Math.abs(a-b)-1e-9&&rawDistance<=a+b+1e-9,projectedDistance:Math.abs(rawDistance-distance),before:{upper:upper.quaternion.clone(),lower:lower.quaternion.clone(),foot:foot.quaternion.clone()},footWorld:foot.getWorldQuaternion(new Quaternion())};
  }
  // Plans and lengths are validated before translating the shared pelvis.
  if(socketEnabled){const world=hips.getWorldPosition(new Vector3()).add(rootShift);hips.position.copy(hips.parent.worldToLocal(world));hips.updateWorldMatrix(false,true)}
  const aim=(bone,child,target)=>{const from=bone.getWorldPosition(new Vector3()),direction=child.getWorldPosition(new Vector3()).sub(from).normalize(),wanted=target.clone().sub(from).normalize(),world=new Quaternion().setFromUnitVectors(direction,wanted).multiply(bone.getWorldQuaternion(new Quaternion()));bone.quaternion.copy(bone.parent.getWorldQuaternion(new Quaternion()).invert().multiply(world));bone.updateWorldMatrix(false,true)};
  const report={rootShift:rootShift.toArray(),rootShiftMagnitude:rootShift.length(),rootShiftClamped,perSide:{},maxDesiredError:0,maxRotationRewriteRadians:0,maxProjectedDistance:0,projectedCount:0};
  for(const side of sides){const l=legs[side],p=plans[side];aim(l.upper,l.lower,p.knee);aim(l.lower,l.foot,p.target);l.foot.quaternion.copy(l.foot.parent.getWorldQuaternion(new Quaternion()).invert().multiply(p.footWorld));l.foot.updateWorldMatrix(false,true);
   const rotationRewriteRadians={};for(const bone of ['upper','lower','foot'])rotationRewriteRadians[bone]=angle(p.before[bone],l[bone].quaternion);
   const desiredError=l.foot.getWorldPosition(new Vector3()).distanceTo(p.desired),projected=p.projectedDistance>1e-9;
   report.perSide[side]={reachable:!projected,geometricReachable:p.geometricReachable,reachMargin:p.reachMargin,projected,projectedDistance:p.projectedDistance,desiredError,rotationRewriteRadians,poleFallback:p.poleFallback};report.maxDesiredError=Math.max(report.maxDesiredError,desiredError);report.maxProjectedDistance=Math.max(report.maxProjectedDistance,p.projectedDistance);report.maxRotationRewriteRadians=Math.max(report.maxRotationRewriteRadians,...Object.values(rotationRewriteRadians));report.projectedCount+=Number(projected);
  }return report;
 }}
}
