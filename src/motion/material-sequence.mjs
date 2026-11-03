import {sampleSourceMaterial} from './source-material.mjs'
import {estimatePlanarAlignment,applyPlanarAlignment} from './planar-alignment.mjs'
import {planMovingTransition} from './moving-transition.mjs'
/** One source plan shared by preview and full-window diagnostics. */
export function createMaterialSequence(material,{outgoingStart=9,incomingStart=48,total=4,transitionStart=1.5,transitionDuration=.5,align=true,contacts}={}){
 const end=transitionStart+transitionDuration;
 if(![outgoingStart,incomingStart,total,transitionStart,transitionDuration].every(Number.isFinite)||transitionStart<0||transitionDuration<=0||total<end||outgoingStart<material.range.start||incomingStart<material.range.start||outgoingStart+end>material.range.end||incomingStart+total-transitionStart>material.range.end)throw Error('Material sequence outside source range');
 const out=t=>sampleSourceMaterial(material,outgoingStart+t),rawIncoming=t=>sampleSourceMaterial(material,incomingStart+t),alignment=align?estimatePlanarAlignment(material,out(transitionStart),rawIncoming(0)):null;
 const incoming=t=>{const pose=rawIncoming(t);return alignment?applyPlanarAlignment(material,pose,alignment):pose};
 const transition=planMovingTransition({outgoing:u=>out(transitionStart+u),incoming:u=>incoming(u),duration:transitionDuration});
 const unknown=()=>({left:{state:'unknown',knowledge:'unknown',provenance:'mixed source windows; no contact inference'},right:{state:'unknown',knowledge:'unknown',provenance:'mixed source windows; no contact inference'}});
 function sample(time){if(!Number.isFinite(time)||time<0||time>total)throw Error('Time outside material sequence');const blending=time>=transitionStart&&time<=end,sourceTime=time<transitionStart?outgoingStart+time:incomingStart+time-transitionStart;
  return {pose:time<transitionStart?out(time):blending?transition.sample(Math.min(transitionDuration,Math.max(0,time-transitionStart))):incoming(time-transitionStart),phase:time<transitionStart?'outgoing':blending?'transition':'incoming',evidence:blending?unknown():contacts?.sample(sourceTime)??unknown(),sourceTimes:blending?{outgoing:outgoingStart+time,incoming:sourceTime}:{[time<transitionStart?'outgoing':'incoming']:sourceTime}};
 }
 return {sample,total,alignment,transitionStart,transitionEnd:end};
}
