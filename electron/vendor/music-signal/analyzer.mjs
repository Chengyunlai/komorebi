const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
const median=xs=>{const a=[...xs].sort((a,b)=>a-b);return a.length%2?a[a.length>>1]:(a[a.length/2-1]+a[a.length/2])/2;};

/** Causal, PCM-only energy/onset baseline. Tempo is an interval estimate, not a downbeat model. */
export class MusicAnalyzer {
 constructor({sampleRate=48000,streamId='audio',featureHz=30}={}){
  if(!Number.isFinite(sampleRate)||sampleRate<8000||sampleRate>192000)throw new RangeError('Unsupported sample rate');
  if(!Number.isFinite(featureHz)||featureHz<1||featureHz>100)throw new RangeError('Invalid feature rate');
  this.sampleRate=sampleRate;this.featureHz=featureHz;this.reset(streamId);
 }
 reset(streamId){
  this.streamId=streamId;this.seq=0;this.frame=0;this.expected=null;this.count=0;this.sum=0;this.lowSum=0;this.midSum=0;this.highSum=0;this.low=0;this.lowMid=0;this.previous=0;this.mean=.001;this.fluxMean=.001;this.lastOnset=null;this.intervals=[];this.peak=.08;this.nextFeature=0;this.silentFor=0;this.state='warming';this.lastFeature=null;
  this.lowAlpha=1-Math.exp(-2*Math.PI*180/this.sampleRate);this.midAlpha=1-Math.exp(-2*Math.PI*2000/this.sampleRate);this.window=Math.round(this.sampleRate*.01);
 }
 packet(type,frame,fields){return {schema:'music-signal/v1',streamId:this.streamId,seq:this.seq++,sampleRate:this.sampleRate,sampleFrame:frame,type,...fields};}
 push({mono,startFrame=this.expected??0,streamId=this.streamId}){
  if(!(mono instanceof Float32Array)||!Number.isSafeInteger(startFrame)||startFrame<0)throw new TypeError('Expected Float32 PCM and integer sample position');
  // Validate before mutation: a bad chunk cannot leave a half-updated analyzer.
  for(const value of mono)if(!Number.isFinite(value)||Math.abs(value)>1.0001)throw new RangeError('PCM must be finite and within [-1,1]');
  const output=[];
  if(streamId!==this.streamId)this.reset(streamId);
  if(this.expected!==null&&this.expected!==startFrame)throw new RangeError('Discontinuous input: reset with a new streamId before resuming');
  this.frame=startFrame;
  for(const sample of mono){
   this.low+=this.lowAlpha*(sample-this.low);this.lowMid+=this.midAlpha*(sample-this.lowMid);
   this.sum+=sample*sample;this.lowSum+=this.low*this.low;this.midSum+=(this.lowMid-this.low)**2;this.highSum+=(sample-this.lowMid)**2;this.frame++;this.count++;
   if(this.count===this.window){this.analyzeWindow(output);this.count=0;this.sum=this.lowSum=this.midSum=this.highSum=0;}
  }
  this.expected=startFrame+mono.length;return output;
 }
 analyzeWindow(output){
  const time=this.frame/this.sampleRate,dt=this.count/this.sampleRate;
  const rms=Math.sqrt(this.sum/this.count),low=Math.sqrt(this.lowSum/this.count),mid=Math.sqrt(this.midSum/this.count),high=Math.sqrt(this.highSum/this.count);
  const flux=Math.max(0,low-this.previous);this.previous=low;
  const since=this.lastOnset===null?Infinity:(this.frame-this.lastOnset)/this.sampleRate;
  const onset=rms>.006&&low>.004&&flux>Math.max(.002,this.fluxMean*2.2)&&low>this.mean*1.3&&since>.24;
  if(onset){
   if(this.lastOnset!==null&&since<1.5){this.intervals.push(since);if(this.intervals.length>10)this.intervals.shift();}else this.intervals=[];
   this.lastOnset=this.frame;
   output.push(this.packet('onset',this.frame,{strength:clamp(flux/Math.max(.03,this.peak))}));
  }
  const smooth=1-Math.exp(-dt/.7);this.mean+=(low-this.mean)*smooth;this.fluxMean+=(flux-this.fluxMean)*smooth;
  this.peak=Math.max(.035,rms,this.peak*Math.exp(-dt/4));
  this.silentFor=rms<.0015?this.silentFor+dt:0;
  let tempo=null;
  if(this.intervals.length>=3){
   const period=median(this.intervals),error=median(this.intervals.map(x=>Math.abs(x-period)))/period;
   const age=(this.frame-this.lastOnset)/this.sampleRate;
   const confidence=clamp(1-error*5)*Math.min(1,this.intervals.length/5)*Math.exp(-Math.max(0,age-period*1.4)/.8);
   tempo={bpm:60/period,confidence,phase:(age/period)%1};
   if(onset&&confidence>=.55)output.push(this.packet('beat',this.frame,{origin:'detected',strength:clamp(flux/Math.max(.03,this.peak)),confidence,bpm:tempo.bpm,uncertaintyMs:dt*1000}));
  }
  const state=this.silentFor>.3?'silent':tempo?.confidence>=.55?'tracking':this.lastOnset!==null&&since>2?'lost':'warming';
  if(state!==this.state){this.state=state;output.push(this.packet('state',this.frame,{state,reason:state==='silent'?'below-gate':state==='tracking'?'locked':'confidence-low'}));}
  if(this.frame>=this.nextFeature){
   this.nextFeature=this.frame+this.sampleRate/this.featureHz;
   this.lastFeature=this.packet('features',this.frame,{state,rmsDbfs:Math.max(-120,20*Math.log10(Math.max(rms,1e-6))),energy:this.silentFor>.3?0:clamp(rms/this.peak),bands:{low:clamp(low/this.peak),mid:clamp(mid/this.peak),high:clamp(high/this.peak)},onsetStrength:clamp(flux/Math.max(.03,this.peak)),lastOnsetFrame:this.lastOnset,tempo});output.push(this.lastFeature);
  }
 }
}
