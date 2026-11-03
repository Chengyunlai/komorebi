const finite=value=>typeof value==='number'&&Number.isFinite(value);
const bounded=(value,min,max,fallback=0)=>finite(value)?Math.min(max,Math.max(min,value)):fallback;
function sanitizeExecution(value){
 if(!value||!['off','source-trajectory'].includes(value.mode)||!['y-up','body-basis'].includes(value.worldAlignment)||value.rootPolicy!=='in-place-feet-midpoint'||value.bankExecution!=='source-ankle/v1'||typeof value.legacyContactApplied!=='boolean'||!['source-trajectory-executor','procedural-idle'].includes(value.finalWriter))return null;
 const execution={mode:value.mode,worldAlignment:value.worldAlignment,rootPolicy:value.rootPolicy,bankExecution:value.bankExecution,desiredError:finite(value.desiredError)&&value.desiredError>=0?value.desiredError:null,projectedCount:Number.isInteger(value.projectedCount)?bounded(value.projectedCount,0,2):0,maxRotationRewriteRadians:bounded(value.maxRotationRewriteRadians,0,2*Math.PI),legacyContactApplied:value.legacyContactApplied,finalWriter:value.finalWriter};
 if(['legacy','coherent-lower-body','planned-lower-body'].includes(value.limiter?.mode))execution.limiter={mode:value.limiter.mode,factor:bounded(value.limiter.factor,0,1),feetTargetShift:bounded(value.limiter.feetTargetShift,0,10)};
 if(['static','heading-preroll'].includes(value.transitionPolicy))execution.transitionPolicy=value.transitionPolicy;
 return execution;
}
function sanitizeLanding(value){
 if(!value||!['left','right'].includes(value.side)||!finite(value.beat))return null;
 if(value.kind==='kinematic'){
  const landing={side:value.side,beat:value.beat,offsetBeats:finite(value.offsetBeats)?bounded(value.offsetBeats,-.5,.5):value.beat-Math.round(value.beat),kind:'kinematic',trustedContact:false};
  if(finite(value.clockEpoch))landing.clockEpoch=bounded(value.clockEpoch,0,Number.MAX_SAFE_INTEGER);
  return landing;
 }
 return finite(value.offsetBeats)?{side:value.side,beat:value.beat,offsetBeats:value.offsetBeats}:null;
}
function sanitizeDanceStudy(report){
 const execution=sanitizeExecution(report?.execution);
 if(!report||report.available!==true){
  if(!execution)return {available:false};
  return {available:false,execution,...(finite(report.weight)?{weight:bounded(report.weight,0,1)}:{}),...(Number.isInteger(report.clip)?{clip:bounded(report.clip,0,2)}:{})};
 }
 const numeric=['weight','beat','clipBeat','sourceFrame','phaseError','clockEpoch','switches','blockedTransitions'];
 if(!numeric.every(k=>finite(report[k]))||!Number.isInteger(report.clip)||report.clip<0||report.clip>2||!Array.isArray(report.clips)||report.clips.length!==3)return null;
 const clips=[];for(const clip of report.clips){
  if(!['id','start','end','beats','activity'].every(k=>finite(clip[k]))||!Array.isArray(clip.anchors)||clip.anchors.length!==3)return null;
  const anchors=clip.anchors.map(a=>({beat:a.beat,frame:a.frame,side:a.side}));if(!anchors.every(a=>finite(a.beat)&&finite(a.frame)&&['left','right'].includes(a.side)))return null;
  clips.push({id:clip.id,start:clip.start,end:clip.end,beats:clip.beats,activity:clip.activity,anchors});
 }
 return {available:true,...Object.fromEntries(numeric.map(k=>[k,report[k]])),clip:report.clip,support:['left','right','both','none','unknown'].includes(report.support)?report.support:'unknown',timing:['tracking','estimated','preview'].includes(report.timing)?report.timing:'estimated',contactError:finite(report.contactError)?report.contactError:null,contactLocked:finite(report.contactLocked)?report.contactLocked:0,contactSkipped:finite(report.contactSkipped)?report.contactSkipped:0,contactRejected:finite(report.contactRejected)?report.contactRejected:0,footHeights:Object.fromEntries(['left','right'].filter(k=>finite(report.footHeights?.[k])).map(k=>[k,report.footHeights[k]])),lastLanding:sanitizeLanding(report.lastLanding),contactMethod:execution&&report.contactMethod==='source-kinematic-estimate-no-lock'?'source-kinematic-estimate-no-lock':'automatic-estimate',...(execution?{execution}:{}),clips};
}
module.exports={sanitizeDanceStudy};
