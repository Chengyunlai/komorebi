const {test}=require('node:test');const assert=require('node:assert/strict');
const {createCaptureVisibility}=require('../electron/capture-visibility.cjs');

test('renderer follows changing display density without reallocating every frame',async()=>{
 const {syncRendererPixelRatio}=await import('../src/rendering/pixel-ratio.mjs');
 let ratio=1;const writes=[];const renderer={getPixelRatio:()=>ratio,setPixelRatio:value=>{ratio=value;writes.push(value)}};
 assert.equal(syncRendererPixelRatio(renderer,2),true);
 for(let i=0;i<120;i++)assert.equal(syncRendererPixelRatio(renderer,2),false);
 syncRendererPixelRatio(renderer,1);assert.equal(ratio,1);
 syncRendererPixelRatio(renderer,1,2);assert.equal(ratio,2);
 syncRendererPixelRatio(renderer,4,2);assert.equal(ratio,3);
 syncRendererPixelRatio(renderer,NaN,2);assert.equal(ratio,2);
 assert.deepEqual(writes,[2,1,2,3,2]);
});

function surface(visible){return {visible,destroyed:false,restores:0,isDestroyed(){return this.destroyed},isVisible(){return this.visible},hide(){this.visible=false},showInactive(){this.visible=true;this.restores++}}}
test('capture hides pet, panels and research surfaces, nested captures restore once without focus',()=>{
 const pet=surface(true),chat=surface(true),music=surface(true),board=surface(false),research=surface(true);
 const guard=createCaptureVisibility({windows:()=>[pet,chat,music,board,research,null]});
 const release=guard.acquire();assert.equal(guard.active,true);assert.ok([pet,chat,music,board,research].every(w=>!w.visible));
 const inner=guard.acquire();release();assert.equal(guard.active,true);assert.equal(pet.visible,false);
 inner();inner();assert.equal(guard.active,false);
 assert.deepEqual([pet,chat,music,board,research].map(w=>w.restores),[1,1,1,0,1]);
});
test('capture cancellation or failure restores safely and respects hidden choice and destroyed windows',async()=>{
 const pet=surface(true),chat=surface(true);let allowPet=true;
 const guard=createCaptureVisibility({windows:()=>[pet,chat],canRestore:w=>w!==pet||allowPet});
 await assert.rejects(async()=>{const release=guard.acquire();try{throw Error('cancelled')}finally{release()}},/cancelled/);
 assert.equal(pet.visible,true);assert.equal(guard.active,false);
 const release=guard.acquire();allowPet=false;chat.destroyed=true;release();assert.equal(pet.visible,false);assert.equal(chat.visible,false);
});
