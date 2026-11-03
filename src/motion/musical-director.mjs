const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v)),finite=v=>Number.isFinite(v)?v:0;
const allowed={quiet:[0,2,5],flow:[0,1,2,4],drive:[1,3,4],rising:[1,3,4],settling:[0,2,5]};
/** Local music-response heuristics, not genre, chorus or bar recognition. */
export class MusicalDirector{
 constructor(){this.reset()}
 reset(){this.fast=0;this.slow=0;this.density=0;this.mode='flow';this.proposal='flow';this.proposalTime=0;this.motif=0;this.slot=0;this.modeAtBoundary='flow';this.accent=0;this.accentTarget=0;this.dynamics=.85;this.armed=false}
 step({dt,energy=0,onset=false,onsetStrength=0,audible=false}){
 const e=audible?clamp(finite(energy)):0;
 if(!this.armed&&audible){this.fast=e;this.slow=e;this.armed=true}
 this.fast+=(e-this.fast)*(1-Math.exp(-dt/.35));this.slow+=(e-this.slow)*(1-Math.exp(-dt/3));
 this.density=this.density*Math.exp(-dt/1.5)+(onset&&audible?1/1.5:0);
 const trend=this.fast-this.slow;
 let proposed=trend>.13?'rising':trend<-.13?'settling':this.fast<.24?'quiet':this.fast>.6&&this.density>1.1?'drive':'flow';
 // Hysteresis protects a motif against frame-to-frame classifier chatter.
 if(this.mode==='quiet'&&this.fast<.3&&Math.abs(trend)<.13)proposed='quiet';
 if(proposed!==this.proposal){this.proposal=proposed;this.proposalTime=0}else this.proposalTime+=dt;
 if(audible&&this.proposalTime>.55)this.mode=proposed;
 if(onset&&audible)this.accentTarget=Math.max(this.accentTarget,clamp(onsetStrength));
 this.accentTarget*=Math.exp(-dt/.16);this.accent+=(this.accentTarget-this.accent)*(1-Math.exp(-dt/.045));
 const target={quiet:.7,flow:.88,drive:1.08,rising:1.03,settling:.75}[this.mode];this.dynamics+=(target-this.dynamics)*(1-Math.exp(-dt/.8));
 return {mode:this.mode,trend,density:this.density,accent:this.accent,dynamics:this.dynamics,answer:this.slot===1||this.slot===3};
 }
 boundary(current,choose){
 const candidates=allowed[this.mode];
 if(this.mode!==this.modeAtBoundary){this.modeAtBoundary=this.mode;this.slot=0;this.motif=choose(candidates,current);return this.motif}
 this.slot=(this.slot+1)%4;
 if(this.slot===0){this.motif=choose(candidates,current);return this.motif}
 if(this.slot===2)return choose(candidates.filter(n=>n!==this.motif),current);
 if(!candidates.includes(this.motif))this.motif=choose(candidates,current);
 return this.motif;
 }
}
