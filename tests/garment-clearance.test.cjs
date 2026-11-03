const {test}=require('node:test'),assert=require('node:assert/strict')
async function fixture(transformed=false){
 const T=await import('three'),{createGarmentClearance}=await import('../src/motion/garment-clearance.mjs')
 const scene=new T.Group(),hips=new T.Bone(),nodes={hips};hips.position.y=1;scene.add(hips)
 if(transformed){scene.rotation.y=.7;scene.scale.setScalar(1.4);scene.position.set(2,.3,-1)}
 for(const [side,sign] of [['left',1],['right',-1]]){
  const upper=new T.Bone(),lower=new T.Bone(),hand=new T.Bone();hips.add(upper);upper.position.set(sign*.16,.45,0);upper.add(lower);lower.position.y=-.28;lower.add(hand);hand.position.y=-.26;const finger=new T.Bone();finger.position.y=-.08;hand.add(finger);nodes[side+'MiddleDistal']=finger;nodes[side+'UpperArm']=upper;nodes[side+'LowerArm']=lower;nodes[side+'Hand']=hand
 }
 const vrm={scene,humanoid:{getNormalizedBoneNode:n=>nodes[n]}}
 scene.updateMatrixWorld(true)
 const volume={top:0,bottom:-.4,radiusX:.22,radiusZ:.18}
 return {T,vrm,nodes,guard:createGarmentClearance(vrm,{volume}),volume}
}
for(const transformed of [false,true])test(`garment avoidance moves clipping hands outside, preserves root and wrist, transformed=${transformed}`,async()=>{
 const f=await fixture(transformed),root=f.nodes.hips.position.clone(),wrists=['left','right'].map(s=>f.nodes[s+'Hand'].getWorldQuaternion(new f.T.Quaternion()))
 const result=f.guard.apply();assert.ok(result.before>.02);assert.ok(result.remaining<.002,JSON.stringify(result));assert.ok(f.nodes.hips.position.equals(root))
 for(const [i,side] of ['left','right'].entries())assert.ok(wrists[i].angleTo(f.nodes[side+'Hand'].getWorldQuaternion(new f.T.Quaternion()))<1e-6)
})
test('arms above the garment retain their original rotations',async()=>{
 const f=await fixture();for(const side of ['left','right'])f.nodes[side+'UpperArm'].rotation.z=side==='left'?Math.PI/2:-Math.PI/2
 f.vrm.scene.updateMatrixWorld(true);const rotations=Object.values(f.nodes).map(n=>n.quaternion.clone());const r=f.guard.apply();assert.equal(r.before,0);assert.equal(r.corrected,0);Object.values(f.nodes).forEach((n,i)=>assert.ok(n.quaternion.equals(rotations[i])))
})
test('no garment bones means no automatic clothing constraint',async()=>{
 const f=await fixture(),{createGarmentClearance}=await import('../src/motion/garment-clearance.mjs');assert.equal(createGarmentClearance(f.vrm).enabled,false)
})

test('a crossed low hand clears with its real finger direction after wrist orientation is restored',async()=>{
 const f=await fixture();f.nodes.leftUpperArm.rotation.z=-.65;f.vrm.scene.updateMatrixWorld(true);const r=f.guard.apply();assert.ok(r.remaining<.002,JSON.stringify(r));
})
