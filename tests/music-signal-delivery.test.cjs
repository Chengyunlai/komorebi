const {test}=require('node:test'),assert=require('node:assert/strict')
test('coalesced features preserve measured onset strength across later quiet windows and chunks',async()=>{
 const {createMusicSignalDelivery}=await import('../electron/music-signal-delivery.mjs');const deliver=createMusicSignalDelivery()
 const event=(type,sampleFrame,fields={})=>({type,sampleFrame,streamId:'a',...fields})
 const first=deliver([event('onset',100,{strength:.8}),event('features',120,{lastOnsetFrame:100,onsetStrength:0})])
 assert.equal(first.lastOnsetStrength,.8);assert.equal(first.onsetStrength,0)
 const second=deliver([event('features',150,{lastOnsetFrame:100,onsetStrength:0}),event('onset',160,{strength:.3})])
 assert.equal(second.lastOnsetStrength,.8,'future onset must not replace earlier feature strength')
 assert.equal(deliver([event('features',180,{lastOnsetFrame:160})]).lastOnsetStrength,.3)
 assert.equal(deliver([{type:'features',streamId:'b',sampleFrame:180,lastOnsetFrame:160}]).lastOnsetStrength,0,'stream reset must not replay old accent')
})
test('PCM batching does not suppress detected accents when the latest feature has zero flux',async()=>{
 const {createMusicSignalDelivery}=await import('../electron/music-signal-delivery.mjs')
 const {MusicAnalyzer}=await import('../electron/vendor/music-signal/analyzer.mjs'),{demoBlock}=await import('../electron/vendor/music-signal/demo-audio.mjs')
 for(const ms of [20,80,120]){
  const rate=48000,a=new MusicAnalyzer({sampleRate:rate}),deliver=createMusicSignalDelivery();let previous=null,count=0
  for(let frame=0;frame<rate*12;frame+=rate*ms/1000){
   const f=deliver(a.push({mono:demoBlock(frame,rate*ms/1000,rate),startFrame:frame}))
   if(f?.lastOnsetFrame!=null&&f.lastOnsetFrame!==previous){previous=f.lastOnsetFrame;count++;assert.ok(f.lastOnsetStrength>0)}
  }
  assert.ok(count>15)
 }
})
