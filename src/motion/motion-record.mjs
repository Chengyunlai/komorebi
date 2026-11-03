import { Quaternion, Vector3 } from 'three'
import { VRMHumanBoneName } from '@pixiv/three-vrm'

const COORDINATE = Object.freeze({unit:'metre',space:'normalized-local-absolute',quaternion:'xyzw'})
const NAMES = Object.values(VRMHumanBoneName)
const REQUIRED = new Set(['hips','spine','head','leftUpperLeg','leftLowerLeg','leftFoot','rightUpperLeg','rightLowerLeg','rightFoot','leftUpperArm','leftLowerArm','leftHand','rightUpperArm','rightLowerArm','rightHand'])
function nodesOf(vrm) {
 const humanoid=vrm?.humanoid
 if(!humanoid?.getNormalizedBoneNode) throw new TypeError('A normalized VRM humanoid is required')
 const nodes=Object.fromEntries(NAMES.map(name=>[name,humanoid.getNormalizedBoneNode(name)]).filter(([,node])=>node))
 if(!nodes.hips) throw new TypeError('Required normalized hips bone is missing')
 return nodes
}
function array(value,size,label) {
 if(!Array.isArray(value)||value.length!==size||!value.every(Number.isFinite)) throw new TypeError(`${label} must contain ${size} finite numbers`)
 if(size===4&&Math.abs(value.reduce((n,v)=>n+v*v,0)-1)>1e-5) throw new TypeError(`${label} must be a unit quaternion`)
 return value
}
function transform(value,label) {
 if(!value||typeof value!=='object') throw new TypeError(`${label} transform is required`)
 array(value.position,3,`${label}.position`);array(value.rotation,4,`${label}.rotation`)
}
function nonnegative(value,label) {if(!Number.isFinite(value)||value<0) throw new TypeError(`${label} must be finite and nonnegative`)}
function validate(record) {
 if(record?.schema!=='motion-record/v1') throw new TypeError('Unsupported motion record schema')
 if(Object.entries(COORDINATE).some(([key,value])=>record.coordinate?.[key]!==value)) throw new TypeError('Record coordinate must be metre normalized-local-absolute xyzw')
 if(typeof record.bodyId!=='string'||!record.bodyId) throw new TypeError('bodyId is required')
 if(typeof record.stage!=='string'||!record.stage) throw new TypeError('stage is required')
 nonnegative(record.time,'time');nonnegative(record.sourceTime,'sourceTime')
 if(record.root?.bone!=='hips') throw new TypeError('root bone must be hips')
 transform(record.root,'root')
 if(!record.joints||!Object.hasOwn(record.joints,'hips')) throw new TypeError('joints.hips is required')
 for(const [name,value] of Object.entries(record.joints)) {if(!NAMES.includes(name)) throw new TypeError(`Unknown normalized bone: ${name}`);transform(value,name)}
 const hips=record.joints.hips
 if(hips.position.some((v,i)=>v!==record.root.position[i])||hips.rotation.some((v,i)=>v!==record.root.rotation[i])) throw new TypeError('root and joints.hips must agree')
}
/** Rest transforms come from the humanoid rest snapshot, never its relative pose API. */
export function createBodyProfile(vrm,{id='vrm-local'}={}) {
 if(typeof id!=='string'||!id) throw new TypeError('Body id is required')
 const nodes=nodesOf(vrm),rest=vrm.humanoid.normalizedRestPose
 if(!rest) throw new TypeError('Normalized rest pose is required for a body profile')
 const namesByNode=new Map(Object.entries(nodes).map(([name,node])=>[node,name]))
 const bones=Object.entries(nodes).map(([name,node])=>{
  const position=array(rest[name]?.position,3,`${name}.rest.position`).slice(),quaternion=array(rest[name]?.rotation,4,`${name}.rest.rotation`).slice()
  let ancestor=node.parent;while(ancestor&&!namesByNode.has(ancestor)) ancestor=ancestor.parent
  return {name,parent:namesByNode.get(ancestor)??null,rest:{position,quaternion},length: new Vector3(...position).length()}
 })
 vrm.scene?.updateMatrixWorld(true)
 return {schema:'body-profile/v1',bodyId:id,coordinate:{...COORDINATE},hipsParentWorldMatrix:nodes.hips.parent?.matrixWorld.toArray()??null,bones,lengthDefinition:'rest-local-distance-to-parent',unknownJointLimits:null,soleOffsets:null,capabilities:{missingRequiredBones:[...REQUIRED].filter(name=>!nodes[name]),optionalBones:Object.keys(nodes).filter(name=>!REQUIRED.has(name)),physics:Boolean(vrm.springBoneManager)}}
}
/** Values are absolute normalized-node local transforms, including the rest transform. */
export function capturePoseRecord(vrm,{time=0,stage='capture',sourceTime=time,bodyId='vrm-local'}={}) {
 const nodes=nodesOf(vrm),joints=Object.fromEntries(Object.entries(nodes).map(([name,node])=>[name,{position:node.position.toArray(),rotation:node.quaternion.toArray()}]))
 const record={schema:'motion-record/v1',coordinate:{...COORDINATE},bodyId,time,sourceTime,stage,root:{bone:'hips',position:[...joints.hips.position],rotation:[...joints.hips.rotation]},joints}
 validate(record);return record
}
/** Validate the entire write set before modifying any node. Applying twice is idempotent.
 * This replays local positions too: bodyId is a label, not a rig fingerprint.
 * Callers must choose the same rig; cross-rig application can change bone lengths.
 */
export function applyPoseRecord(vrm,record) {
 validate(record);const nodes=nodesOf(vrm)
 for(const name of Object.keys(record.joints)) if(!nodes[name]) throw new TypeError(`Body is missing normalized bone: ${name}`)
 for(const [name,value] of Object.entries(record.joints)) {nodes[name].position.fromArray(value.position);nodes[name].quaternion.fromArray(value.rotation)}
 vrm.scene?.updateMatrixWorld(true)
 return vrm
}
function difference(a,b) {return {angularRadians:new Quaternion().fromArray(a.rotation).angleTo(new Quaternion().fromArray(b.rotation)),positionMetres:new Vector3(...a.position).distanceTo(new Vector3(...b.position))}}
export function comparePoseRecords(before,after) {
 validate(before);validate(after)
 if(before.bodyId!==after.bodyId) throw new TypeError('Cannot compare different body ids')
 const names=Object.keys(before.joints)
 if(names.length!==Object.keys(after.joints).length||names.some(name=>!Object.hasOwn(after.joints,name))) throw new TypeError('Compared records must contain the same joints')
 const perJoint=Object.fromEntries(names.map(name=>[name,difference(before.joints[name],after.joints[name])])),root=difference(before.root,after.root)
 return {perJoint,maxAngular:Math.max(...Object.values(perJoint).map(v=>v.angularRadians)),maxPosition:Math.max(...Object.values(perJoint).map(v=>v.positionMetres)),rootPosition:root.positionMetres,rootAngle:root.angularRadians}
}
