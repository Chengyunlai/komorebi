const {test}=require('node:test'),assert=require('node:assert/strict')
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`)
async function fixture(auxiliary){
 const {Quaternion,Vector3}=await import('three')
 const rig=[...(auxiliary?[{id:'scene',name:'Scene',parent:null}]:[]),{id:'hips',name:'Hips',parent:auxiliary?'scene':null},{id:'left',name:'UpperLeg_L',parent:'hips'},{id:'right',name:'UpperLeg_R',parent:'hips'},{id:'foot',name:'Foot',parent:'left'}]
 const material={rig,metersPerUnit:.01,rootBones:{hierarchy:auxiliary?'scene':'hips',anatomicalHips:'hips'}}
 const pose=(yaw,position,height)=>{
  const joints=Object.fromEntries(rig.map(j=>[j.id,{position:j.id==='hips'&&auxiliary?[.2,height,-.3]:j.id==='left'?[.3,-.2,.1]:j.id==='right'?[-.3,-.2,.1]:j.id==='foot'?[0,-.8,.2]:[0,0,0],rotation:[0,0,0,1],angularVelocity:[.1,.2,.3]}]))
  const root=joints[material.rootBones.hierarchy];root.position=position.slice();if(!auxiliary)root.position[1]=height
  root.rotation=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),yaw).toArray()
  return {sourceTime:3.2,contacts:{status:'unknown'},joints,root:{bone:material.rootBones.hierarchy,position:root.position.slice(),rotation:root.rotation.slice(),linearVelocity:[1,2,3],angularVelocity:[.1,.2,.3]},worldPositions:{stale:[99,99,99]}}
 }
 return {material,pose}
}
for(const auxiliary of [false,true])test(`planar alignment respects ${auxiliary?'auxiliary scene':'anatomical hips'} root and preserves source geometry`,async()=>{
 const {estimatePlanarAlignment,applyPlanarAlignment}=await import('../src/motion/planar-alignment.mjs'),{sourcePoseToSkeleton}=await import('../src/motion/material-skeleton.mjs')
 const {material:m,pose}=await fixture(auxiliary),out=pose(.7,[3,.4,-2],1.2),incoming=pose(-1.1,[-2,.8,4],1.7),original=structuredClone(incoming)
 const alignment=estimatePlanarAlignment(m,out,incoming),aligned=applyPlanarAlignment(m,incoming,alignment),a=sourcePoseToSkeleton(m,incoming),b=sourcePoseToSkeleton(m,aligned)
 near(alignment.yaw,1.8);near(alignment.translation[1],0);near(alignment.diagnostics.afterPlanarSeparation,0);near(alignment.diagnostics.headingErrorAfter,0)
 assert.ok(alignment.diagnostics.beforePlanarSeparation>1)
 const outWorld=sourcePoseToSkeleton(m,out),hips=m.rig.findIndex(j=>j.id==='hips');for(const k of [0,2])near(b.positions[hips][k],outWorld.positions[hips][k])
 for(let i=0;i<m.rig.length;i++){
  near(a.positions[i][1],b.positions[i][1]);assert.ok(aligned.worldPositions[m.rig[i].id]);
  for(let j=0;j<m.rig.length;j++)near(Math.hypot(...a.positions[i].map((v,k)=>v-a.positions[j][k])),Math.hypot(...b.positions[i].map((v,k)=>v-b.positions[j][k])))
  if(m.rig[i].parent!==null)assert.deepEqual(aligned.joints[m.rig[i].id],incoming.joints[m.rig[i].id])
 }
 assert.deepEqual(incoming,original);assert.equal(aligned.sourceTime,3.2);assert.deepEqual(aligned.contacts,{status:'unknown'});assert.deepEqual(aligned.root.angularVelocity,incoming.root.angularVelocity);near(aligned.root.linearVelocity[1],2);near(Math.hypot(...aligned.root.linearVelocity),Math.hypot(...incoming.root.linearVelocity));assert.equal(aligned.worldPositions.stale,undefined)
 const repeated=applyPlanarAlignment(m,incoming,alignment);assert.deepEqual(repeated,aligned)
})
test('missing anatomy, degenerate heading, inconsistent root and nonplanar transform are rejected',async()=>{
 const {estimatePlanarAlignment,applyPlanarAlignment}=await import('../src/motion/planar-alignment.mjs'),{material:m,pose}=await fixture(true),p=pose(0,[0,0,0],1)
 const degenerate=structuredClone(p);degenerate.joints.left.position=degenerate.joints.right.position.slice()
 assert.throws(()=>estimatePlanarAlignment(m,p,degenerate),/Degenerate/)
 assert.throws(()=>estimatePlanarAlignment({...m,rig:m.rig.map(j=>j.id==='left'?{...j,name:'unknown'}:j)},p,p),/requires explicit/)
 assert.throws(()=>estimatePlanarAlignment({...m,rootBones:{...m.rootBones,anatomicalHips:null}},p,p),/requires explicit/)
 const inconsistent=structuredClone(p);inconsistent.root.position[0]=10
 assert.throws(()=>applyPlanarAlignment(m,inconsistent,{yaw:0,translation:[0,0,0]}),/Inconsistent/)
 assert.throws(()=>applyPlanarAlignment(m,p,{yaw:0,translation:[0,1,0]}),/requires finite/)
})
test('one fixed alignment continues incoming motion across a transition boundary',async()=>{
 const {estimatePlanarAlignment,applyPlanarAlignment}=await import('../src/motion/planar-alignment.mjs'),{material:m,pose}=await fixture(true)
 const alignment=estimatePlanarAlignment(m,pose(.3,[3,0,2],1),pose(-.9,[0,0,0],1))
 const points=[.999,1,1.001].map(t=>applyPlanarAlignment(m,pose(-.9,[t,.4,t*.5],1),alignment).root.position)
 const step1=points[1].map((v,k)=>v-points[0][k]),step2=points[2].map((v,k)=>v-points[1][k])
 step1.forEach((v,k)=>near(v,step2[k]));near(Math.hypot(...step1),.001*Math.hypot(1,.5))
})
