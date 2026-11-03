const {systemProxyEnvironment}=require('./network.cjs');
const {spawn}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {createInterface}=require('node:readline');
const LABELS={gentle:'轻柔舞动',energetic:'活泼舞动',stop:'停止舞动'};
function validateDecision(result){
 if(!result||!['gentle','energetic','stop','other'].includes(result.choice)||!Number.isFinite(result.confidence)||result.confidence<0||result.confidence>1)throw new Error('Laya 返回了无效判断。');
 return {...result,accepted:result.choice!=='other'&&!result.lowConfidence&&result.confidence>=.75};
}
class BehaviorDirector {
 constructor({python,worker=path.join(__dirname,'behavior-worker.py')}={}){
  const config=path.join(__dirname,'../native/laya-runtime.json');
  this.python=python||process.env.KOMOREBI_LAYA_PYTHON||(fs.existsSync(config)?JSON.parse(fs.readFileSync(config,'utf8')).python:null)||path.join(os.homedir(),'.local/share/komorebi/laya-runtime/bin/python');
  this.worker=worker;this.pending=new Map();this.sequence=0;this.state={choice:'default',label:'默认律动',source:'default'};
 }
 start(){
  if(this.child)return;
  if(!fs.existsSync(this.python))throw new Error('尚未安装 Laya 本地运行环境，请运行 scripts/setup-laya.sh。');
  const child=spawn(this.python,['-u',this.worker],{stdio:['pipe','pipe','ignore'],env:{...systemProxyEnvironment(),HF_HUB_DISABLE_XET:'1',TOKENIZERS_PARALLELISM:'false',HF_HUB_DISABLE_PROGRESS_BARS:'1'}});this.child=child;
  const fail=()=>{if(this.child!==child)return;this.child=null;for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(new Error('Laya 本地进程已退出。'));}this.pending.clear();};
  child.on('error',fail);child.on('exit',fail);child.stdin.on('error',fail);
  createInterface({input:child.stdout}).on('line',line=>{
   let r;try{r=JSON.parse(line);}catch{return;}
   const p=this.pending.get(r.id);if(!p)return;clearTimeout(p.timer);this.pending.delete(r.id);
   if(r.error)p.reject(new Error(r.error));else{try{p.resolve(validateDecision(r));}catch(e){p.reject(e);}}
  });
 }
 async decide(text){
  if(typeof text!=='string'||!text.trim()||text.length>1500)throw new Error('请输入 1–1500 字的行为指令。');
  if(this.pending.size)throw new Error('Laya 正在判断上一条指令。');
  this.start();const id=++this.sequence;
  const result=await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{this.pending.delete(id);this.child?.kill();reject(new Error('Laya 加载或推理超时，请稍后重试。'));},600000);
   this.pending.set(id,{resolve,reject,timer});this.child.stdin.write(JSON.stringify({id,text})+'\n');
  });
  if(result.accepted)this.state={choice:result.choice,label:LABELS[result.choice],source:'laya',confidence:result.confidence,elapsedMs:result.elapsedMs};
  return {...result,state:this.state};
 }
 stop(){this.child?.kill();}
}
module.exports={BehaviorDirector,validateDecision};
