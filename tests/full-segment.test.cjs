const {test}=require('node:test');const assert=require('node:assert/strict');
function serialize(bvh){const joint=i=>{const j=bvh.joints[i],children=bvh.joints.flatMap((c,k)=>c.parent===i?[k]:[]);return `${j.parent<0?'ROOT':'JOINT'} ${j.name}\n{\nOFFSET ${j.offset.join(' ')}\nCHANNELS ${j.channels.length} ${j.channels.join(' ')}\n${children.map(joint).join('\n')}\n}`};return `HIERARCHY\n${joint(0)}\nMOTION\nFrames: ${bvh.frameCount}\nFrame Time: ${bvh.frameTime}\n${Array.from(bvh.values).join(' ')}`}
test('full player advances every compiled frame in order without clip switches or transitions',async()=>{const {createFullSegmentPlayer}=await import('../src/motion/local-dance.mjs');
 const frames=Array.from({length:300},(_,i)=>({rotations:{hips:[0,0,0,1]},hips:[0,i*.01,0],feet:{left:[0,0,0],right:[0,0,0]}}));
 const player=createFullSegmentPlayer(frames,{fps:15});
 assert.equal(player.bank.clips.length,1);assert.equal(player.bank.beatAligned,false);assert.equal(player.bank.rootPolicy,'in-place-feet-midpoint');
 let pose=player.step({dt:1/15,active:true,clockEpoch:1});assert.equal(pose.clip,0);assert.equal(pose.switches,0);assert.equal(pose.transitionPolicy,'full-segment');assert.equal(pose.source.mode,'audio');assert.equal(pose.source.primitive,'full-segment');
 let previous=0,monotonic=true,last;
 for(let i=0;i<300;i++){pose=player.step({dt:1/15,active:true,clockEpoch:1});if(pose.sourceFrame<previous)monotonic=false;previous=pose.sourceFrame;if(last!==undefined&&pose.weight<last)throw Error('weight must rise while active');last=pose.weight}
 assert.ok(monotonic,'source frame must advance monotonically');assert.equal(pose.sourceFrame,299);assert.equal(pose.weight,1);assert.ok(pose.hips[1]>=.01);
 for(let i=0;i<10;i++)pose=player.step({dt:1/10,active:false,clockEpoch:1});assert.equal(pose.weight,0);assert.equal(pose.source.mode,'waiting');
});
test('full player stays clamped at the final frame and supports beat clock continuity',async()=>{const {createFullSegmentPlayer}=await import('../src/motion/local-dance.mjs');
 const frames=Array.from({length:20},(_,i)=>({rotations:{hips:[0,0,0,1]},hips:[0,0,0],feet:{left:[0,0,0],right:[0,0,0]}}));
 const player=createFullSegmentPlayer(frames,{fps:15});
 let pose=player.step({dt:5,active:true,clockEpoch:1});assert.equal(pose.sourceFrame,19);assert.equal(pose.clipBeat,19/15);
 const before=pose.beat;pose=player.step({dt:1/15,active:true,clockEpoch:2});assert.ok(pose.sourceFrame<=1,'epoch rebase restarts source position');assert.ok(pose.beat<before,'epoch rebase restarts beat at the new clock');
});
test('prepareLocalDance full option returns a non-sliced single-clip player with daily execution metadata',async()=>{const {createRotationFixture}=await import('../examples/stage-15-rotation-retarget/core/rotation-body.mjs'),{prepareLocalDance}=await import('../src/motion/local-dance.mjs'),{capturePoseRecord}=await import('../src/motion/motion-record.mjs'),f=createRotationFixture();
 const text=serialize(f.bvh),rest=capturePoseRecord(f.vrm);
 const player=await prepareLocalDance(f.vrm,text,()=>false,{full:true});
 assert.equal(player.bank.execution,'source-ankle/v1');assert.equal(player.bank.worldAlignment,'y-up');assert.equal(player.bank.rootPolicy,'in-place-feet-midpoint');
 assert.equal(player.bank.clips.length,1);assert.equal(player.bank.beatAligned,false);assert.ok(player.bank.clips[0].end>=Math.floor(f.bvh.frameCount/15)-1);
 const pose=player.step({dt:1/15,active:true,clockEpoch:1});assert.ok(pose.rotations.hips);assert.ok(pose.feet.left.length===3);assert.equal(pose.source.primitive,'full-segment');
 assert.deepEqual(capturePoseRecord(f.vrm),rest);
 const cancelled=await prepareLocalDance(f.vrm,text,()=>true,{full:true});assert.equal(cancelled,null);
});
