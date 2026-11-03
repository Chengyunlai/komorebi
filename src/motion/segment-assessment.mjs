import {createSequenceAssessment} from './sequence-assessment.mjs'
const yieldThread=()=>new Promise(resolve=>setTimeout(resolve,0));
export const BODY_ASSESSMENT_VARIANTS=[{label:'方向基线',retargetMode:'direction',constraints:false},{label:'校准旋转',retargetMode:'rotation',constraints:false},{label:'旋转 + 足约束',retargetMode:'rotation',constraints:true}];
/** Offline fixed-source-time comparisons. No quality score and no automatic promotion. */
export async function assessReplaySegment(experiment,{start=9,end=18,frameTime=experiment.source?.frameTime,variants=BODY_ASSESSMENT_VARIANTS,rootMode='height',signal,onProgress=()=>{}}={}){
 if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end<=start||!Number.isFinite(frameTime)||frameTime<=0||!['height','source','balance'].includes(rootMode)||!Array.isArray(variants)||!variants.length)throw Error('段落范围或采样设置无效');
 const availableLast=Number.isInteger(experiment.source?.frameCount)?experiment.source.frameCount-1:Infinity;
 const first=Math.ceil(start/frameTime-1e-8),last=Math.min(Math.floor(end/frameTime+1e-8),availableLast),count=last-first+1;
 if(!Number.isFinite(count)||count<2||count>20000)throw Error('段落采样数不足或过大');
 const rows=[],total=count*variants.length;let done=0;
 const cancelled=()=>{if(signal?.aborted){const error=new Error('段落评估已取消');error.name='AbortError';throw error}};
 for(const variant of variants){cancelled();const assessment=createSequenceAssessment({label:variant.label}),options={rootMode,retargetMode:variant.retargetMode,constraints:variant.constraints,blendWeight:1,physics:false};
  for(let index=first;index<=last;index++){
   cancelled();const result=experiment.evaluate({time:index*frameTime,...options});assessment.push(result);done++;
   if((index-first)%6===0||index===last){onProgress({done,total,label:variant.label,sourceTime:result.trace.time});await yieldThread()}
  }
  rows.push({options,...assessment.finish()});
 }
 return {schema:'motion-segment-assessment/v1',requested:{start,end},actual:{start:first*frameTime,end:last*frameTime,frameTime,count},rows,conclusion:'Numerical comparison only; inspect continuous rendered motion and source context before choosing a mapping.'};
}
