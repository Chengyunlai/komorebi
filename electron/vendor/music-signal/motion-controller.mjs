const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const keys=['headX','headY','headZ','bodyX','bodyY','bodyZ','leftArm','rightArm'];
/** Model-independent choreography; parameters are normalized, never Live2D IDs. */
export class MusicMotionController {
 constructor(){this.positions=Object.fromEntries(keys.map(k=>[k,0]));this.velocities={...this.positions};this.strength=0;this.energyEnvelope=0;this.time=0;this.beatCount=0;this.lastOnsetFrame=null;this.streamId=null;}
 step({dt,playing=false,signal=null,signalAge=Infinity,tempo=100,enabled=true}={}){
  dt=clamp(Number.isFinite(dt)?dt:0,0,.1);this.time+=dt;
  const live=signal&&signalAge<.65;
  const audible=live&&signal.state!=='silent'&&signal.energy>.025;
  // Hold a kick's energy across its decay; do not turn every gap between drums
  // into a pause. True silence still releases the whole movement.
  this.energyEnvelope=Math.max(audible?signal.energy:0,this.energyEnvelope*Math.exp(-dt/.55));
  const audioStrength=live&&signal.state!=='silent'&&this.energyEnvelope>.025?clamp(.48+this.energyEnvelope*.52,0,1):0;
  const targetStrength=playing&&enabled?(live?audioStrength:.38):0;
  this.strength+=(targetStrength-this.strength)*(1-Math.exp(-dt/(targetStrength > this.strength ? .18 : .28)));
  const confident=live&&signal.tempo?.confidence>.55;
  let bpm=confident?signal.tempo.bpm:tempo;if(bpm>155)bpm/=2;bpm=clamp(bpm,55,155);
  if(live&&signal.streamId!==this.streamId){this.streamId=signal.streamId;this.beatCount=0;this.lastOnsetFrame=null;}
  if(live&&signal.lastOnsetFrame!==null&&signal.lastOnsetFrame!==undefined&&signal.lastOnsetFrame!==this.lastOnsetFrame){if(this.lastOnsetFrame!==null)this.beatCount++;this.lastOnsetFrame=signal.lastOnsetFrame;}
  const phase=confident?((this.beatCount+signal.tempo.phase)*(bpm/signal.tempo.bpm)+signalAge*bpm/60):this.time*bpm/60;
  const angle=phase*Math.PI*2,side=Math.sin(angle/2);
  const onsetAge=live&&Number.isFinite(signal.lastOnsetFrame)&&signal.sampleRate>0?(signal.sampleFrame-signal.lastOnsetFrame)/signal.sampleRate+signalAge:Infinity;
  const pulse=live&&!confident?Math.exp(-Math.max(0,onsetAge)/.14):Math.pow(Math.max(0,Math.cos(angle)),4);
  const phrase=Math.floor(this.time*bpm/60/8)%3;
  const nod=.06+pulse*.38;
  const target={headX:side*.42,headY:-nod+Math.sin(angle/2-.3)*.09,headZ:-Math.sin(angle/2+.22)*.36,bodyX:Math.sin(angle/2-.2)*.48,bodyY:-pulse*.16,bodyZ:Math.sin(angle/2-.32)*.42,leftArm:.08+Math.max(0,side)*.62+(phrase===1?pulse*.16:0),rightArm:.08+Math.max(0,-side)*.62+(phrase===2?pulse*.16:0)};
  // Critically damped spring, substepped for background/resume and variable render rates.
  const steps=Math.max(1,Math.ceil(dt/(1/120))),h=dt/steps;
  for(let n=0;n<steps;n++)for(const key of keys){const speed=key==='headY'?18:key.startsWith('body')?11:key.includes('Arm')?10:12;const goal=target[key]*this.strength;this.velocities[key]+=(speed*speed*(goal-this.positions[key])-2*speed*this.velocities[key])*h;this.positions[key]+=this.velocities[key]*h;}
  return {...this.positions,strength:this.strength,mode:live?'audio':'ambient'};
 }
}
