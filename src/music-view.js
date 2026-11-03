export function playbackPosition(state, now=Date.now()) {
 if(!state)return 0
 const advance=state.status==='playing'?Math.max(0,(now-state.observedAt)/1000)*(state.rate??1):0
 const value=Math.max(0,(state.position||0)+advance)
 return state.duration?Math.min(value,state.duration):value
}
export function lyricAt(lines,time){
 let low=0,high=lines.length-1,found=-1
 while(low<=high){const middle=(low+high)>>1;if(lines[middle].time<=time){found=middle;low=middle+1}else high=middle-1}
 return {index:found,current:found>=0?lines[found].text:'',next:lines[found+1]?.text||''}
}
export function dancePose(seconds,strength=1,tempo=100){
 if(strength===0)return {head:0,body:0,nod:0,leftArm:0,rightArm:0,bounce:0}
 const phase=seconds*Math.max(60,Math.min(160,tempo))/60*Math.PI*2
 return {head:Math.sin(phase/2)*5*strength,body:Math.sin(phase/2+.3)*3*strength,nod:Math.sin(phase)*2*strength,leftArm:(.5+.5*Math.sin(phase/2))*5*strength,rightArm:(.5-.5*Math.sin(phase/2))*5*strength,bounce:Math.max(0,Math.sin(phase))*2.2*strength}
}
