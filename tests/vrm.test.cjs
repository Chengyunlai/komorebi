const {test}=require('node:test');const assert=require('node:assert/strict');const {inspectVRM}=require('../electron/vrm-model.cjs');
function glb(json){const text=Buffer.from(JSON.stringify(json).padEnd(Math.ceil(JSON.stringify(json).length/4)*4,' '));const result=Buffer.alloc(20+text.length);result.write('glTF');result.writeUInt32LE(2,4);result.writeUInt32LE(result.length,8);result.writeUInt32LE(text.length,12);result.writeUInt32LE(0x4e4f534a,16);text.copy(result,20);return result;}
const bones=['hips','head','leftUpperArm','leftLowerArm','rightUpperArm','rightLowerArm','leftUpperLeg','leftLowerLeg','rightUpperLeg','rightLowerLeg','leftFoot','rightFoot'];
function model(){return {extensions:{VRM:{meta:{author:'Fixture'},humanoid:{humanBones:bones.map(bone=>({bone,node:0}))}}}}}
test('VRM local importer validates humanoid and blocks external resources',()=>{assert.equal(inspectVRM(glb(model())).bones.length,12);const external=model();external.images=[{uri:'https://example.com/private'}];assert.throws(()=>inspectVRM(glb(external)),/外部资源/);const missing=model();missing.extensions.VRM.humanoid.humanBones.pop();assert.throws(()=>inspectVRM(glb(missing)),/缺少全身骨骼/);const truncated=glb(model()).subarray(0,30);assert.throws(()=>inspectVRM(truncated),/有效/)});
test('VRM retarget tracks independent arm and knee directions without accumulating pose',async()=>{
 const THREE=await import('three');const {createVRMRetarget}=await import('../src/motion-lab/vrm-retarget.mjs');const {skeletonAt}=await import('../src/motion-lab/bvh.mjs');
 const scene=new THREE.Object3D(),nodes={};const names=['hips','spine','chest','neck','head','leftUpperArm','leftLowerArm','leftHand','rightUpperArm','rightLowerArm','rightHand','leftUpperLeg','leftLowerLeg','leftFoot','leftToes','rightUpperLeg','rightLowerLeg','rightFoot','rightToes'];
 const parent={spine:'hips',chest:'spine',neck:'chest',head:'neck',leftUpperArm:'chest',leftLowerArm:'leftUpperArm',leftHand:'leftLowerArm',rightUpperArm:'chest',rightLowerArm:'rightUpperArm',rightHand:'rightLowerArm',leftUpperLeg:'hips',leftLowerLeg:'leftUpperLeg',leftFoot:'leftLowerLeg',leftToes:'leftFoot',rightUpperLeg:'hips',rightLowerLeg:'rightUpperLeg',rightFoot:'rightLowerLeg',rightToes:'rightFoot'};
 for(const name of names){const n=nodes[name]=new THREE.Object3D();(nodes[parent[name]]||scene).add(n);n.position.set(/left/.test(name)?.3:/right/.test(name)?-.3:0,/Leg|Foot/.test(name)?-.4:.2,/Toes/.test(name)?.2:0)}scene.updateMatrixWorld(true);
 const rest=Object.fromEntries(names.map(n=>[n,nodes[n].quaternion.clone()]));const vrm={scene,humanoid:{getNormalizedBoneNode:n=>nodes[n],resetNormalizedPose:()=>{for(const n of names)nodes[n].quaternion.copy(rest[n])}}};
 const sourceNames=['Hips','Spine','Chest','Neck','Head','UpperArm_L','LowerArm_L','Hand_L','UpperArm_R','LowerArm_R','Hand_R','UpperLeg_L','LowerLeg_L','Foot_L','Toes_L','UpperLeg_R','LowerLeg_R','Foot_R','Toes_R'];
 const joints=sourceNames.map((name,i)=>({name,parent:i?Math.max(0,i-1):-1,offset:[0,0,0],channels:['Xposition','Yposition','Zposition'],channelStart:i*3}));
 // Set source positions relative to fixture parents, matching the target rest geometry.
 for(let i=0;i<names.length;i++){joints[i].parent=parent[names[i]]?names.indexOf(parent[names[i]]):-1;joints[i].offset=nodes[names[i]].position.toArray()}
 const bvh={joints,channelCount:names.length*3,frameCount:2,frameTime:1,duration:2,values:new Float32Array(names.length*6)};
 for(let f=0;f<2;f++)for(let i=0;i<names.length;i++)bvh.values.set(joints[i].offset,f*names.length*3+i*3);
 bvh.values.set([0,.5,0],names.length*3+6*3);bvh.values.set([0,-.2,.3],names.length*3+12*3);
 const adapter=createVRMRetarget(vrm,bvh);adapter.apply(0);const before=nodes.leftUpperArm.quaternion.clone();adapter.apply(1);assert.ok(before.angleTo(nodes.leftUpperArm.quaternion)>.2);assert.ok(nodes.leftLowerLeg.quaternion.angleTo(rest.leftLowerLeg)>.2);
 const once=nodes.leftUpperArm.quaternion.clone();adapter.apply(1);assert.ok(once.angleTo(nodes.leftUpperArm.quaternion)<1e-7);for(const n of names)assert.ok(nodes[n].quaternion.toArray().every(Number.isFinite));
 assert.equal(adapter.apply(1).bones,13);
});
