const {test}=require('node:test'),assert=require('node:assert/strict')
async function fixture(){
 const {Quaternion,Vector3}=await import('three')
 const rig=[{id:'hips',name:'Hips',parent:null},{id:'left',name:'UpperLeg_L',parent:'hips'},{id:'right',name:'UpperLeg_R',parent:'hips'},{id:'arm',name:'Arm',parent:'hips'}]
 const frames=Array.from({length:41},(_,i)=>{const time=i*.1,angle=time<=2?time:4-time,joints=Object.fromEntries(rig.map(j=>[j.id,{position:j.id==='hips'?[0,1,0]:j.id==='left'?[.2,0,0]:j.id==='right'?[-.2,0,0]:[0,.5,0],rotation:j.id==='arm'?new Quaternion().setFromAxisAngle(new Vector3(1,0,0),angle).toArray():[0,0,0,1],angularVelocity:[0,0,0]}]));return {time,frame:i,joints,root:{bone:'hips',position:[0,1,0],rotation:[0,0,0,1],linearVelocity:[0,0,0],angularVelocity:[0,0,0]}}})
 return {rig,frames,frameTimes:frames.map(f=>f.time),range:{start:0,end:4},metersPerUnit:1,rootBones:{hierarchy:'hips',anatomicalHips:'hips'}}
}
const contacts={sample:()=>({left:{state:'plant',knowledge:'annotated'},right:{state:'flight',knowledge:'annotated'}}),provenance:'test annotations'}
test('signed opposite angular velocities fail despite matching pose and magnitude',async()=>{
 const {assessMotionSuccessor}=await import('../src/motion/successor-assessment.mjs'),m=await fixture()
 const row=assessMotionSuccessor(m,{outgoingTime:1,incomingTime:3,contacts,limits:{angularVelocityRmsGap:.5}})
 assert.equal(row.status,'rejected');assert.ok(row.metrics.poseRmsRotationGap<1e-7);assert.ok(row.metrics.angularVelocityRmsGap>.9);assert.ok(row.reasons.some(r=>r.includes('angularVelocityRmsGap')))
})
test('contact knowledge gates eligibility and annotated mismatch rejects',async()=>{
 const {assessMotionSuccessor}=await import('../src/motion/successor-assessment.mjs'),m=await fixture(),options={outgoingTime:.5,incomingTime:.5}
 assert.equal(assessMotionSuccessor(m,options).status,'review')
 assert.equal(assessMotionSuccessor(m,{...options,contacts}).status,'eligible')
 const mismatch={sample:t=>({left:{state:t<1?'plant':'lift',knowledge:'annotated'},right:{state:'flight',knowledge:'annotated'}})}
 assert.equal(assessMotionSuccessor(m,{outgoingTime:.5,incomingTime:1,contacts:mismatch}).status,'rejected')
 const estimated={sample:()=>({left:{state:'plant',knowledge:'estimated'},right:{state:'flight',knowledge:'annotated'}})}
 assert.equal(assessMotionSuccessor(m,{...options,contacts:estimated}).status,'review')
})
test('invalid source windows and numerical limits reject with reasons; rank has no fallback',async()=>{
 const {assessMotionSuccessor,rankMotionSuccessors}=await import('../src/motion/successor-assessment.mjs'),m=await fixture()
 for(const options of [{outgoingTime:-1,incomingTime:1},{outgoingTime:1,incomingTime:3.8},{outgoingTime:1,incomingTime:1,duration:0},{outgoingTime:1,incomingTime:1,limits:{hipsVelocityGap:NaN}}]){const row=assessMotionSuccessor(m,options);assert.equal(row.status,'rejected');assert.ok(row.reasons.length)}
 assert.throws(()=>rankMotionSuccessors(m,{outgoingTime:1,candidates:[]}),/No successor/)
 const rows=rankMotionSuccessors(m,{outgoingTime:.5,candidates:[{id:'bad',time:4},{id:'good',time:.5}],contacts})
 assert.deepEqual(rows.map(r=>r.id),['good','bad']);assert.equal(rows[0].status,'eligible');assert.equal(rows[1].status,'rejected');assert.equal(rows[0].time,.5)
})
test('world pose comparison survives auxiliary root and hips yaw compensation',async()=>{
 const {Quaternion,Vector3}=await import('three'),{assessMotionSuccessor}=await import('../src/motion/successor-assessment.mjs'),m=await fixture()
 m.rig.unshift({id:'scene',name:'Scene',parent:null});m.rig.find(j=>j.id==='hips').parent='scene';m.rootBones.hierarchy='scene'
 const yaw=a=>new Quaternion().setFromAxisAngle(new Vector3(0,1,0),a).toArray()
 for(const f of m.frames){const changed=f.time>=2.5;f.joints.scene={position:changed?[4,0,-2]:[0,0,0],rotation:yaw(changed?.8:0),angularVelocity:[0,0,0]};f.joints.hips.rotation=yaw(changed?-.8:0);f.joints.arm.rotation=[0,0,0,1];f.root={bone:'scene',position:f.joints.scene.position.slice(),rotation:f.joints.scene.rotation.slice(),linearVelocity:[0,0,0],angularVelocity:[0,0,0]}}
 const row=assessMotionSuccessor(m,{outgoingTime:.5,incomingTime:3,contacts})
 assert.equal(row.status,'eligible');assert.ok(row.metrics.poseRmsRotationGap<1e-7);assert.equal(row.metrics.jointCount,4)
})
test('auxiliary scene root spin remains visible in anatomical world angular velocity',async()=>{
 const {Quaternion,Vector3}=await import('three'),{assessMotionSuccessor}=await import('../src/motion/successor-assessment.mjs'),m=await fixture()
 m.rig.unshift({id:'scene',name:'Scene',parent:null});m.rig.find(j=>j.id==='hips').parent='scene';m.rootBones.hierarchy='scene'
 for(const f of m.frames){const angle=f.time>=2.5?(f.time-3)*2:0;f.joints.scene={position:[0,0,0],rotation:new Quaternion().setFromAxisAngle(new Vector3(0,1,0),angle).toArray(),angularVelocity:[0,0,0]};f.joints.arm.rotation=[0,0,0,1];f.root={bone:'scene',position:[0,0,0],rotation:f.joints.scene.rotation.slice(),linearVelocity:[0,0,0],angularVelocity:[0,0,0]}}
 const row=assessMotionSuccessor(m,{outgoingTime:.5,incomingTime:3,contacts,limits:{angularVelocityRmsGap:.5}})
 assert.ok(row.metrics.poseRmsRotationGap<1e-7);assert.ok(row.metrics.hipsVelocityGap<1e-7);assert.ok(row.metrics.angularVelocityRmsGap>1.9);assert.equal(row.status,'rejected')
})
