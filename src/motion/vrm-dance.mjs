import {MusicalDirector} from './musical-director.mjs'
import {samplePhrase,PHRASE_THEMES,sampleArm,ARM_MOVES} from './vrm-phrases.mjs'
import {VRM_CLIPS,restFeatures,sampleClip} from './vrm-clips.mjs'
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),finite=v=>Number.isFinite(v)?v:0;
/** Original coordinated clips -> canonical VRM pose. Feet offsets are leg-length fractions. */
export function featuresToPose(f,source){
 const kneeL=clamp(f.drop*.95+f.liftL*1.15,0,1.5),kneeR=clamp(f.drop*.95+f.liftR*1.15,0,1.5);
 return {rotations:{hips:[f.drop*.28,f.twist*.55,f.lean*.22],spine:[f.drop*.34,-f.twist*.32,f.lean*.4],chest:[-f.drop*.14,-f.twist*.34,f.lean*.24],head:[-f.drop*.3,-f.twist*.34,-f.lean*.36],leftUpperArm:[-f.leftFront*1.55, f.fold*.32,-1.18+f.leftReach*2.36+f.fold*.38],rightUpperArm:[-f.rightFront*1.55,-f.fold*.32,1.18-f.rightReach*2.36-f.fold*.38],leftLowerArm:[0,-.2-f.leftElbow*1.65, f.fold*.42],rightLowerArm:[0,.2+f.rightElbow*1.65,-f.fold*.42],leftHand:[0,0,f.leftReach*.22],rightHand:[0,0,-f.rightReach*.22],leftUpperLeg:[-kneeL*.9,0,-f.shift*.1],rightUpperLeg:[-kneeR*.9,0,-f.shift*.1],leftLowerLeg:[kneeL*1.35,0,0],rightLowerLeg:[kneeR*1.35,0,0],leftFoot:[-kneeL*.62,0,0],rightFoot:[-kneeR*.62,0,0]},hips:[f.shift*.24,-f.drop*.26,0],feet:{left:[f.stepL*.34,f.liftL*.2,f.forwardL*.3],right:[-f.stepR*.34,f.liftR*.2,f.forwardR*.3]},features:f,source};
}
// Legacy explicit no-audio preview, kept separate from the causal audio path.
export function vrmPose(p){const f=restFeatures();Object.assign(f,{leftReach:clamp(p.leftArm||0,0,1),rightReach:clamp(p.rightArm||0,0,1),leftElbow:.35*(p.leftArm||0),rightElbow:.35*(p.rightArm||0),drop:Math.max(0,-(p.bodyY||0)),shift:p.bodyX||0,lean:p.bodyZ||0,twist:p.bodyX||0});return featuresToPose(f,p)}
export class VRMDanceController{
 constructor(){this.features=restFeatures();this.stream=null;this.lastOnset=null;this.lastTime=null;this.eventCount=0;this.beat=0;this.bpm=100;this.strength=0;this.energy=0;this.correction=0;this.variation=0;this.clockReady=false;this.clockEpoch=0;this.footGain=0;this.themeVisits=Array(PHRASE_THEMES.length).fill(0);this.themeVisits[0]=1;this.recentThemes=[0];this.profile={low:0,mid:0,high:0,energy:0};this.director=new MusicalDirector();this.lastTrustedAt=null;this.trustedBpm=100;this.armMove=0;this.armStart=null;this.armFrom=null;this.armCycle=-1;this.armVisits=Array(ARM_MOVES.length).fill(0);this.recentArms=[]}
 chooseArmMove(){
  let winner=0,best=-Infinity;
  const energy=this.energy;
  for(let i=0;i<ARM_MOVES.length;i++){
   const move=ARM_MOVES[i];
   const vibe=move.sway*(energy>.6?1.2:.5);
   const freshness=this.armVisits[i]===0?.9:0;
   const score=vibe+freshness-this.armVisits[i]*.12-(this.recentArms.includes(i)?.8:0)-(i===this.armMove?1.4:0);
   if(score>best){winner=i;best=score}
  }
  this.armVisits[winner]++;this.recentArms=[...this.recentArms,winner].slice(-3);return winner;
 }
 chooseTheme(style,candidates=PHRASE_THEMES.map((_,i)=>i)){
 const {low,mid,high,energy}=this.profile;
 // Scores follow each theme's temperament: energetic body moves high, calm moves low.
 const scores=[.8+low*.25,.4+high*.8+energy*.5,.6+mid*.8,.2+low*.8+energy*.7,.4+mid*.5+high*.4,.6+(1-energy)*.6+low*.25,
  .45+high*.7+energy*.55,.5+mid*.6+energy*.35,.35+high*.6+energy*.5,.55+(1-energy)*.4+low*.3,.4+low*.45+mid*.3,.5+high*.75+energy*.6];
 const gentleThemes=[0,2,5,8,9],energeticThemes=[1,3,6,11];
 let winner=0,best=-Infinity;
 for(const i of candidates){const preference=style==='gentle'&&gentleThemes.includes(i)?.3:style==='energetic'&&energeticThemes.includes(i)?.3:0;
  // Exploration: unseen themes and long-unused themes get a boost so the dance does not
  // settle into a small rotation.
  const freshness=this.themeVisits[i]===0?.9:Math.max(0,.25-this.themeVisits[i]*.06);
  const score=(scores[i]??0)+preference+freshness-this.themeVisits[i]*.18-(i===this.variation?2:0)-(this.recentThemes.includes(i)?.9:0);if(score>best){winner=i;best=score}}
 this.themeVisits[winner]++;this.recentThemes=[...this.recentThemes,winner].slice(-4);return winner;
 }
 step({dt=0,signal,signalAge=Infinity,audioMode=false,enabled=true,style='default',preview=false,tempo=100}={}){
 dt=clamp(finite(dt),0,.1);
 const valid=Boolean(signal&&signal.sampleRate>0&&Number.isFinite(signal.sampleFrame)&&signalAge>=0&&signalAge<.35),now=valid?signal.sampleFrame/signal.sampleRate+signalAge:null;
 if(audioMode&&valid&&(signal.streamId!==this.stream||(this.lastTime!==null&&now<this.lastTime-.1))){const nextEpoch=this.clockEpoch+1,continuity={features:this.features,beat:this.beat};if(this.stream===null)Object.assign(continuity,{bpm:this.bpm,clockReady:this.clockReady});Object.assign(this,new VRMDanceController(),continuity);this.clockEpoch=nextEpoch;this.stream=signal.streamId}
 const blocked=!enabled||style==='stop',available=!blocked&&(audioMode?valid&&!['silent','lost'].includes(signal.state):preview);
 this.energy=Math.max(audioMode&&available?finite(signal.energy):0,this.energy*Math.exp(-dt/.3));
 const audible=Boolean(available&&(!audioMode||this.energy>.025));
 const tracking=audioMode&&valid&&signal.tempo?.confidence>.55&&Number.isFinite(signal.tempo.bpm);
 if(tracking){let candidate=signal.tempo.bpm;if(this.clockReady){const options=[candidate,candidate*.5,candidate*2].filter(v=>v>=60&&v<=160);if(options.length)candidate=options.reduce((a,b)=>Math.abs(a-this.bpm)<Math.abs(b-this.bpm)?a:b)}this.trustedBpm=clamp(candidate,60,160);this.lastTrustedAt=now}
 const coasting=audioMode&&valid&&this.lastTrustedAt!==null&&now-this.lastTrustedAt<4;
 const goalTempo=clamp(tracking||coasting?this.trustedBpm:finite(tempo)||100,60,160);
 if(!this.clockReady&&audible){this.bpm=goalTempo;this.clockReady=true}else this.bpm+=clamp(goalTempo-this.bpm,-dt*12,dt*12);
 let elapsed=dt;
 if(audioMode){elapsed=valid&&this.lastTime!==null?clamp(now-this.lastTime,0,.35):0;this.lastTime=now}
 let newOnset=false;
 if(audioMode&&audible&&Number.isFinite(signal.lastOnsetFrame)&&signal.lastOnsetFrame!==this.lastOnset){this.lastOnset=signal.lastOnsetFrame;this.eventCount++;const onsetAge=now-signal.lastOnsetFrame/signal.sampleRate;newOnset=onsetAge>=0&&onsetAge<.24;

 }
 // Reliable onset phase supplies an integer-beat grid, never a bar/downbeat label.
 // Correct velocity rather than position so existing gait stays continuous, even
 // when the first reliable estimate arrives more than .2 beats out of phase.
 if(audible&&tracking&&signal.tempo.confidence>.75){
  const onsetTime=Number.isFinite(signal.lastOnsetFrame)?signal.lastOnsetFrame/signal.sampleRate:null;
  const reference=onsetTime!==null?(now-onsetTime)*this.bpm/60:Number.isFinite(signal.tempo.phase)?signal.tempo.phase*this.bpm/signal.tempo.bpm+signalAge*this.bpm/60:null;
  if(reference!==null){const predicted=this.beat+elapsed*this.bpm/60,difference=reference-predicted,error=difference-Math.round(difference);this.correction=clamp(error*.6,-.18,.18)}
 }
 const musical=this.director.step({dt,energy:audioMode?finite(signal?.energy):.4,onset:newOnset,onsetStrength:finite(signal?.onsetStrength),audible});
 const oldCycle=Math.floor(this.beat/8);
 if(audible)this.beat+=Math.max(0,elapsed*(this.bpm/60+this.correction));
 // Arms run on their own 2-beat clock, decoupled from the 8-count phrase grid.
 const armCycle=Math.floor(this.beat/2);
 if(audible&&armCycle!==this.armCycle&&this.armCycle>=0){
  const seed=Math.abs(Math.sin(armCycle*7.31))*43758.5453,roll=seed-Math.floor(seed);
  if(roll<.8){const previous=this.armMove;this.armMove=this.chooseArmMove();if(this.armMove!==previous){this.armFrom={leftReach:this.features.leftReach,rightReach:this.features.rightReach,leftFront:this.features.leftFront,rightFront:this.features.rightFront,fold:this.features.fold,leftElbow:this.features.leftElbow,rightElbow:this.features.rightElbow};this.armStart=this.beat}}
 }
 this.armCycle=armCycle;
 this.correction*=Math.exp(-dt/.25);
 if(audible){for(const k of ['low','mid','high','energy']){const value=audioMode?finite(k==='energy'?signal.energy:signal.bands?.[k]):.4;this.profile[k]+=(value-this.profile[k])*(1-Math.exp(-dt/1.2))}}
 const cycle=Math.floor(this.beat/8);
 if(cycle!==oldCycle){
  // Deterministic variation: only some phrase boundaries change theme, so the dance does
  // not read as a fixed 6-move rotation.
  const seed=Math.abs(Math.sin(cycle*12.9898))*43758.5453,roll=seed-Math.floor(seed);
  if(roll<.85){const previous=this.variation;this.variation=this.chooseTheme(style);if(this.variation!==previous){this.transitionFrom=previous;this.transitionStart=this.beat}}
 }
 const phrase=samplePhrase(this.beat,this.variation,{answer:musical.answer,accent:musical.accent});
 const beatPulse=0.5-0.5*Math.cos(this.beat*Math.PI*2);
 phrase.features.drop=clamp(phrase.features.drop+beatPulse*.16*(0.6+this.energy*.6),0,1.2);
 phrase.features.liftL=clamp(phrase.features.liftL+beatPulse*.05,0,1);
 phrase.features.liftR=clamp(phrase.features.liftR+beatPulse*.05,0,1);
 const gain=audible?(style==='gentle'?.55:style==='energetic'?1:.8)*clamp(.65+this.energy*.35,.65,1)*musical.dynamics:0;
 this.strength+=(gain-this.strength)*(1-Math.exp(-dt/(audible?.35:.2)));
 const blending=this.transitionStart!==null&&this.beat-this.transitionStart<.6;
 if(this.transitionStart!==null&&!blending)this.transitionStart=null;
 this.footGain=clamp(this.footGain+(audible?dt/.35:-dt/.5),0,1);
 // Never scale horizontal foot placement with fluctuating audio energy during contact.
 const armTarget=audible?sampleArm(this.beat,this.armMove,{energy:this.energy,accent:musical.accent}):null;
 const armBlend=this.armStart!==null?clamp((this.beat-this.armStart)/.45,0,1):1;
 const armKeys=new Set(['leftReach','rightReach','leftFront','rightFront','fold','leftElbow','rightElbow']);
 const target=phrase.features;
 for(const key of Object.keys(this.features)){
  const foot=/^(step|lift|forward)/.test(key);
  let desired=target[key];
  if(armTarget&&armKeys.has(key)){
   const from=this.armFrom?.[key]??armTarget[key];
   desired=from+(armTarget[key]-from)*armBlend;
  }
  desired*=foot?this.footGain:this.strength;
  this.features[key]=foot?desired:this.features[key]+(desired-this.features[key])*(1-Math.exp(-dt/(blending?.18:.06)));
 }
 const f=this.features,mode=audioMode?(valid?'audio':'waiting'):(preview?'preview':'waiting');
 const source={mode,primitive:audible?phrase.name:'rest',eventCount:this.eventCount,clipCount:Math.floor(this.beat/8)+Number(this.clockReady),phrasePhase:phrase.phase,beat:this.beat,bpm:this.bpm,clockEpoch:this.clockEpoch,timing:tracking?'tracking':audioMode?'estimated':'preview',support:phrase.support,variation:this.variation,musicalMode:musical.mode,arrangement:this.director.slot,accent:musical.accent,strength:this.strength,headX:-f.twist,headY:-f.drop,headZ:-f.lean,bodyX:f.shift,bodyY:-f.drop,bodyZ:f.lean,leftArm:f.leftReach,rightArm:f.rightReach};
 return {...featuresToPose(f,source),contacts:phrase.contacts};
 }
}

export {VRM_CLIPS}
