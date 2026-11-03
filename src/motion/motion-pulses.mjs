const quantile = (values, p) => values.slice().sort((a,b)=>a-b)[Math.floor((values.length-1)*p)] || 0
/** Estimate periodic kinematic accents. These are not annotated musical beats. */
export function estimateMotionPulses(activity, {start=0,end=activity.length-1}, fps=15) {
 const values=Array.from({length:end-start+1},(_,i)=>{
  const j=start+i;return ((activity[Math.max(start,j-1)]||0)+2*(activity[j]||0)+(activity[Math.min(end,j+1)]||0))/4
 })
 const threshold=quantile(values,.6),events=[],spacing=Math.max(2,Math.round(fps*.25))
 for(let i=1;i<values.length-1;i++)if(values[i]>threshold&&values[i]>=values[i-1]&&values[i]>values[i+1]){
  if(events.length&&i-events.at(-1).local<spacing){if(values[i]>values[events.at(-1).local])events[events.length-1]={frame:start+i,local:i}}
  else events.push({frame:start+i,local:i})
 }
 const mean=values.reduce((s,x)=>s+x,0)/Math.max(1,values.length)
 let best={period:null,confidence:0}
 for(let lag=Math.max(3,Math.round(fps*.32));lag<=Math.ceil(fps*.8);lag++){
  let cross=0,a2=0,b2=0
  for(let i=lag;i<values.length;i++){const a=values[i]-mean,b=values[i-lag]-mean;cross+=a*b;a2+=a*a;b2+=b*b}
  const confidence=cross/Math.max(1e-9,Math.sqrt(a2*b2))
  if(confidence>best.confidence&&events.length>=4)best={period:lag/fps,confidence}
 }
 return {source:'kinematic-estimate',events:events.map(e=>e.frame),period:best.confidence>=.55?best.period:null,confidence:best.confidence}
}

export function motionPulsePhase(track, position, fps=15) {
 if(!track?.period||!track.events.length)return null
 // One continuous phase clock: choosing the nearest peak would wrap at every
 // subdivision and create discontinuous phase errors between accents.
 return ((position-track.events[0])/(fps*track.period)%1+1)%1
}
