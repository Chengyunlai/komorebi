const {test}=require('node:test');
const assert=require('node:assert/strict');
async function fixture(){
 const {Object3D,Vector3}=await import('three');
 const {createContactPlant}=await import('../src/motion/contact-plant.mjs');
 const scene=new Object3D(),hips=new Object3D(),bones={hips};scene.add(hips);hips.position.y=.9;
 for(const side of ['left','right']){
  const upper=new Object3D(),lower=new Object3D(),foot=new Object3D();
  upper.position.x=side==='left'?.12:-.12;lower.position.set(0,-.45,.1);foot.position.set(0,-.45,-.1);
  hips.add(upper);upper.add(lower);lower.add(foot);
  bones[side+'UpperLeg']=upper;bones[side+'LowerLeg']=lower;bones[side+'Foot']=foot;
 }
 scene.updateMatrixWorld(true);
 const vrm={scene,humanoid:{getNormalizedBoneNode:name=>bones[name]}};
 return {plant:createContactPlant(vrm),hips,bones,scene,Vector3};
}
test('contact lock retains the world ankle under reachable pelvis movement',async()=>{
 const {plant,hips,bones,scene,Vector3}=await fixture();
 const start=bones.leftFoot.getWorldPosition(new Vector3());
 assert.equal(plant.apply({weight:1,contacts:{left:true,right:false}}).locked,1);
 hips.position.x=.05;scene.updateMatrixWorld(true);
 const result=plant.apply({weight:1,contacts:{left:true,right:false}});
 assert.equal(result.locked,1);assert.ok(result.error<1e-6);
 assert.ok(bones.leftFoot.getWorldPosition(new Vector3()).distanceTo(start)<1e-6);
});
test('airborne, unknown and fade-out release the old world anchor',async()=>{
 for(const release of [{weight:1,contacts:{left:false}},{weight:1,contacts:{left:null}},{weight:1},{weight:.8,contacts:{left:true}}]){
  const {plant,hips,bones,scene,Vector3}=await fixture();
  plant.apply({weight:1,contacts:{left:true}});
  hips.position.x=.04;scene.updateMatrixWorld(true);
  const before=bones.leftFoot.getWorldPosition(new Vector3());
  assert.equal(plant.apply(release).locked,0);
  assert.ok(bones.leftFoot.getWorldPosition(new Vector3()).distanceTo(before)<1e-9);
  const result=plant.apply({weight:1,contacts:{left:true}});
  assert.equal(result.locked,1);
  assert.ok(bones.leftFoot.getWorldPosition(new Vector3()).distanceTo(before)<1e-6);
 }
});
test('unknown data never starts a contact lock',async()=>{
 const {plant}=await fixture();
 for(const contacts of [undefined,{left:null,right:null},{left:false,right:false}]){
  const report=plant.apply({weight:1,contacts});assert.equal(report.locked,0);assert.equal(report.error,null);
 }
});
test('source ankle heights map to actual world heights in metres',async()=>{
 const {plant,bones,Vector3}=await fixture();
 const floors=Object.fromEntries(['left','right'].map(side=>[side,bones[side+'Foot'].getWorldPosition(new Vector3()).y]));
 const result=plant.apply({weight:1,contacts:{left:false,right:true},footHeights:{left:.18,right:0}});
 for(const side of ['left','right']){
  const desired=side==='left'?.18:0;
  assert.ok(Math.abs(bones[side+'Foot'].getWorldPosition(new Vector3()).y-floors[side]-desired)<1e-4);
  assert.ok(Math.abs(result.heights[side]-desired)<1e-4);
 }
});
test('unconfirmed airborne feet below the ankle plane are corrected',async()=>{
 const {plant,hips,bones,scene,Vector3}=await fixture();
 const floor=bones.leftFoot.getWorldPosition(new Vector3()).y;
 hips.position.y-=.08;scene.updateMatrixWorld(true);
 assert.ok(bones.leftFoot.getWorldPosition(new Vector3()).y<floor-.07);
 const result=plant.apply({weight:1,contacts:{left:false,right:false}});
 assert.ok(Math.abs(bones.leftFoot.getWorldPosition(new Vector3()).y-floor)<1e-4);
 assert.equal(result.locked,0);
});
test('unreachable anchored support is rejected instead of reported locked',async()=>{
 const {plant,hips,scene}=await fixture();
 plant.apply({weight:1,contacts:{left:true,right:false}});
 hips.position.x=2;scene.updateMatrixWorld(true);
 const result=plant.apply({weight:1,contacts:{left:true,right:false}});
 assert.equal(result.locked,0);assert.equal(result.rejected,1);assert.ok(result.error>.01);
});
