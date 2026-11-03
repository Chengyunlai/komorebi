const fs=require('node:fs');const path=require('node:path');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),source=path.resolve(process.argv[2]||path.join(root,'../music-signal-lab'));
for(const target of ['electron/vendor/music-signal','src/vendor/music-signal']){fs.mkdirSync(path.join(root,target),{recursive:true});for(const name of target.startsWith('electron')?['analyzer.mjs','demo-audio.mjs','motion-controller.mjs']:['motion-controller.mjs'])fs.copyFileSync(path.join(source,'src',name),path.join(root,target,name));}
let revision=null;try{revision=execFileSync('git',['-C',source,'rev-parse','HEAD'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();}catch{}
const provenance={repository:'https://github.com/Chengyunlai/music-signal-lab',version:JSON.parse(fs.readFileSync(path.join(source,'package.json'))).version,revision};
for(const target of ['electron/vendor/music-signal','src/vendor/music-signal'])fs.writeFileSync(path.join(root,target,'provenance.json'),JSON.stringify(provenance,null,2));
console.log('已同步独立音乐信号项目源码。');
