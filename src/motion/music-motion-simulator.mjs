export const MOTION_CHANNELS=['headX','headY','headZ','bodyX','bodyY','bodyZ','leftArm','rightArm'];
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const zero=()=>Object.fromEntries(MOTION_CHANNELS.map(k=>[k,0]));
const finite=v=>Number.isFinite(v)?v:0;

/** Stateful, causal signal-to-motion composition. No autonomous beat oscillator. */
export class MusicMotionSimulator{
 constructor({capabilities=MOTION_CHANNELS}={}){
  this.capabilities=new Set(capabilities);this.position=zero();this.velocity=zero();this.active=[];this.stream=null;this.lastOnset=null;this.eventCount=0;this.strength=0;this.energy=0;this.lastPrimitive='rest';
 }
 schedule(signal,now){
  const onset=signal.lastOnsetFrame;
  if(!Number.isFinite(onset)||onset===this.lastOnset)return;
  this.lastOnset=onset;
  const start=onset/signal.sampleRate;
  // Old startup/seek transients must not be replayed as new movement.
  if(now-start>.24||now<start)return;
  const low=clamp(finite(signal.bands?.low)),mid=clamp(finite(signal.bands?.mid)),high=clamp(finite(signal.bands?.high));
  const bpm=signal.tempo?.confidence>.55&&Number.isFinite(signal.tempo.bpm)?clamp(signal.tempo.bpm,55,180):null;
  const beatSeconds=bpm?60/bpm:.48;
  const side=this.eventCount++%2===0?1:-1;
  const amplitude=clamp(.25+signal.energy*.55+finite(signal.onsetStrength)*.2,.2,1);
  const add=(name,pose,duration,delay=0)=>{
   const supported=Object.fromEntries(Object.entries(pose).filter(([key])=>this.capabilities.has(key)));
   if(Object.keys(supported).length)this.active.push({name,pose:supported,start:start+delay,duration,amplitude});
  };
  // A low-frequency onset accents torso flexion, not a permanent lateral sway.
  add('torso-accent',{bodyY:-.6,headY:-.55,bodyX:side*.25,bodyZ:-side*.2},beatSeconds*.95);
  if((mid>low*1.1&&mid>high)||(signal.energy>.55&&this.eventCount%4===3)){
   this.lastPrimitive='open-arms';
   add('open-arms',{leftArm:.95,rightArm:.95,headY:.24,bodyX:-side*.22},beatSeconds*1.8);
  }else if(high>low*.85&&high>mid){
   this.lastPrimitive='arm-flick';
   add('arm-flick',{[side>0?'leftArm':'rightArm']:.9,headZ:side*.32},beatSeconds*.65);
  }else{
   this.lastPrimitive='alternate-reach';
   add('alternate-reach',{[side>0?'leftArm':'rightArm']:1,bodyX:side*.65,headX:-side*.4},beatSeconds*1.45,beatSeconds*.10);
   if(signal.energy>.65&&this.eventCount%4===0)add('open-arms',{leftArm:.8,rightArm:.8,headY:.18},beatSeconds*1.4,beatSeconds*.5);
  }
  this.active=this.active.slice(-10);
 }
 step({dt=0,signal=null,signalAge=Infinity,enabled=true,style='default'}={}){
  dt=clamp(finite(dt),0,.1);
  const valid=signal&&signal.sampleRate>0&&Number.isFinite(signal.sampleFrame)&&signalAge>=0&&signalAge<.35;
  if(valid&&signal.streamId!==this.stream){this.stream=signal.streamId;this.lastOnset=null;this.eventCount=0;this.active=[];this.energy=0;this.lastPrimitive='rest';}
  const available=enabled&&style!=='stop'&&valid&&signal.state!=='silent'&&signal.state!=='lost';
  const audible=available&&(signal.energy>.025||this.active.length>0||this.energy>.025);
  const now=valid?signal.sampleFrame/signal.sampleRate+signalAge:0;
  this.energy=Math.max(audible?clamp(signal.energy):0,this.energy*Math.exp(-dt/.3));
  if(available&&signal.energy>.025)this.schedule(signal,now);
  if(!available){this.active=[];this.lastPrimitive='rest';}
  const target=zero();let activity=0;
  const styleGain=style==='gentle'?.55:style==='energetic'?1.15:1;
  this.active=this.active.filter(p=>now<p.start+p.duration);
  for(const p of this.active){
   const progress=(now-p.start)/p.duration;if(progress<0)continue;
   // Fast anticipation, slower return; each channel can overlap independent clips.
   const envelope=progress<.28?Math.sin(progress/.28*Math.PI/2):Math.cos((progress-.28)/.72*Math.PI/2)**2;
   const weight=envelope*p.amplitude*styleGain;
   activity=Math.max(activity,weight);
   for(const [key,value] of Object.entries(p.pose))target[key]+=value*weight;
  }
  const ownership=audible?clamp(.3+this.energy*.6+activity*.2):0;
  this.strength+=(ownership-this.strength)*(1-Math.exp(-dt/.16));
  // Critically damped springs constrain speed and blend clip boundaries.
  const steps=Math.max(1,Math.ceil(dt*120)),h=dt/steps;
  for(let i=0;i<steps;i++)for(const key of MOTION_CHANNELS){
   const speed=key.includes('Arm')?15:18,goal=clamp(target[key],-.85,.85);
   this.velocity[key]+=(speed*speed*(goal-this.position[key])-2*speed*this.velocity[key])*h;
   this.position[key]+=this.velocity[key]*h;
  }
  return {...this.position,strength:this.strength,mode:valid?'audio':'waiting',primitive:this.lastPrimitive,eventCount:this.eventCount};
 }
}
