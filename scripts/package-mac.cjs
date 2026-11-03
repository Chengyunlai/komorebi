const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname,'..');
const source = path.join(root,'node_modules/electron/dist/Electron.app');
const target = path.join(root,'release/Komorebi.app');
if (!fs.existsSync(path.join(root,'dist/index.html'))) throw new Error('先执行 npm run build。');
if (!fs.existsSync(source)) throw new Error('Electron 运行时尚未安装。');
if(!fs.existsSync(path.join(root,'native/mediaremote/MediaRemoteAdapter.framework')))throw new Error('先执行 npm run build:music。');
fs.mkdirSync(path.dirname(target),{recursive:true});
if (fs.existsSync(target)) fs.rmSync(target,{recursive:true,force:true});
execFileSync('/usr/bin/ditto',[source,target]);
const resources = path.join(target,'Contents/Resources');
const appRoot = path.join(resources,'app');
fs.mkdirSync(appRoot,{recursive:true});
for(const item of ['electron','dist','native','package.json','scripts','LICENSE','docs/licenses','README.md','THIRD-PARTY-NOTICES.md']) {
  const input = path.join(root,item);
  if(fs.existsSync(input))fs.cpSync(input,path.join(appRoot,item),{recursive:true,verbatimSymlinks:true});
}
const plist = path.join(target,'Contents/Info.plist');
for (const [key,value] of [['CFBundleName','Komorebi'],['CFBundleDisplayName','木漏日'],['CFBundleIdentifier','local.komorebi.desktop'],['CFBundleVersion','0.2.0'],['CFBundleShortVersionString','0.2.0'],['NSAudioCaptureUsageDescription','在本机分析系统或网易云播放音频来驱动人物律动。'],['NSHumanReadableCopyright','Komorebi contributors. Third-party assets retain their own licenses.']]) {
  try {execFileSync('/usr/libexec/PlistBuddy',['-c',`Set :${key} ${value}`,plist],{stdio:'pipe'});}
  catch {execFileSync('/usr/libexec/PlistBuddy',['-c',`Add :${key} string ${value}`,plist],{stdio:'pipe'});}
}
fs.rmSync(path.join(resources,'default_app.asar'),{force:true});
const icon = path.join(root,'public/icon.icns');
if(fs.existsSync(icon)){fs.copyFileSync(icon,path.join(resources,'electron.icns'));}
execFileSync('/usr/bin/codesign',['--force','--deep','--sign','-',target],{stdio:'inherit'});
console.log(target);
