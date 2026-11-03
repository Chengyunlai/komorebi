// Audit the staged snapshot: local ignored assets must never enter a public tree.
const {execFileSync}=require('node:child_process');
const path=require('node:path');
const files=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
const indexed=new Set(files),errors=[];
const forbidden=/(^|\/)(node_modules|release|dist|computer-use)\/|^native\/|^public\/vendor\/|^docs\/[^/]*-preview\.png$|^docs\/evidence\/(?!README\.md$)|(^|\/)\.env(?:\.|$)|\.(?:vrm|vroid|bvh|npy|npz|pt|pth|ckpt|safetensors|sqlite\w*|db|pem|key|mp3|wav|m4a|mp4)$/i;
for(const file of files){
 if(forbidden.test(file)&&!file.endsWith('.env.example'))errors.push(`Excluded asset in index: ${file}`);
 const data=execFileSync('git',['show',`:${file}`],{maxBuffer:20*1024*1024});
 if(data.includes(0))continue;
 const text=data.toString('utf8');
 if(/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\bgh[pousr]_[A-Za-z0-9]{30,}|\bgithub_pat_[A-Za-z0-9_]{40,}|\bsk-[A-Za-z0-9_-]{32,}/.test(text))errors.push(`Possible credential in: ${file}`);
 if(file.endsWith('.md')){
  for(const match of text.matchAll(/\]\(([^)]+)\)/g)){
   const target=match[1].split('#')[0];
   if(!target||/^(?:[a-z]+:|\/)/i.test(target))continue;
   const resolved=path.posix.normalize(path.posix.join(path.posix.dirname(file),decodeURIComponent(target)));
   if(!indexed.has(resolved)&&!files.some(f=>f.startsWith(resolved.replace(/\/$/,'')+'/')))errors.push(`Missing document target: ${file} -> ${target}`);
  }
 }
}
if(errors.length){console.error(errors.join('\n'));process.exitCode=1}else console.log(`Release boundary and document links checked: ${files.length} files.`);
