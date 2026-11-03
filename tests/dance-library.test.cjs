const {test}=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs'),os=require('node:os'),path=require('node:path')
const {loadDanceLibrary}=require('../electron/dance-library.cjs')
test('library boundaries follow loaded frames, not stale manifest counts or missing clips',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'komorebi-library-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}))
 const frame={r:{hips:[0,0,0,1]},h:[0,0,0],ft:{left:[0,0,0],right:[0,0,0]}}
 fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify({clips:[{name:'a',frames:200},{name:'missing'},{name:'b',frames:400}]}))
 for(const [name,n] of [['a',3],['b',4]])fs.writeFileSync(path.join(dir,`${name}.json`),JSON.stringify({frames:Array.from({length:n},()=>frame)}))
 const library=loadDanceLibrary(dir)
 assert.deepEqual(library.clips.map(c=>[c.id,c.start,c.end,c.frames]),[['a',0,2,3],['b',3,6,4]])
 assert.equal(library.frames.length,7);assert.equal(library.available,true)
})
