const test=require('node:test'),assert=require('node:assert/strict');
const load=()=>import('../src/motion/root-recentring-assessment.mjs');
const make=(hips,left,right)=>Array.from({length:5},(_,i)=>({time:i*.1,hips:hips(i),feet:{left:left(i),right:right(i)}}));
test('common world translation cancels without inventing body motion',async()=>{
 const {assessRootRecentring}=await load(),r=assessRootRecentring(make(i=>[i,10,0],i=>[i-1,0,0],i=>[i+1,0,0]),{sourceUnitMetres:.01});
 assert.ok(Math.abs(r.speed.hips.max-.1)<1e-12);assert.equal(r.speed.relative.max,0);assert.ok(r.squaredSpeedDecomposition.maxIdentityError<1e-12);
});
test('moving only the free foot injects half its horizontal speed into centred hips',async()=>{
 const {assessRootRecentring}=await load(),r=assessRootRecentring(make(()=>[0,1,0],()=>[-1,0,0],i=>[1+i*.2,i,0]));
 assert.equal(r.speed.hips.max,0);assert.ok(Math.abs(r.speed.relative.max-1)<1e-12);assert.ok(Math.abs(r.speed.center.max-1)<1e-12);assert.ok(r.acceleration.relative.max<1e-12);
});
test('attribution is invariant to constant origin shifts and handles unequal intervals',async()=>{
 const {assessRootRecentring}=await load(),samples=make(i=>[i*i,1,0],i=>[-1+i,0,0],i=>[1+i,0,0]);samples.forEach((s,i)=>s.time=i*i*.1);
 const a=assessRootRecentring(samples),b=assessRootRecentring(samples.map(s=>({...s,hips:s.hips.map(v=>v+100),feet:Object.fromEntries(Object.entries(s.feet).map(([k,p])=>[k,p.map(v=>v+100)]))})));
 for(const key of ['hips','center','relative'])assert.ok(Math.abs(a.speed[key].max-b.speed[key].max)<1e-10);
 assert.ok(a.squaredSpeedDecomposition.maxIdentityError<1e-10);assert.equal(a.acceleration.hips.count,3);
});
test('rejects discontinuous order, nonfinite samples and invalid units',async()=>{
 const {assessRootRecentring}=await load(),samples=make(()=>[0,1,0],()=>[-1,0,0],()=>[1,0,0]);
 assert.throws(()=>assessRootRecentring(samples,{sourceUnitMetres:0}));samples[2].time=0;assert.throws(()=>assessRootRecentring(samples));samples[2].time=.2;samples[2].feet.left[0]=NaN;assert.throws(()=>assessRootRecentring(samples));
});
