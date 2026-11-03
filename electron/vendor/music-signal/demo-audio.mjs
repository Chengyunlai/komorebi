/** Original, deterministic 24-second beat fixture. No sampled commercial music. */
export function demoSample(time){
 if(time<0||time>=24)return 0;
 const bpm=time<8?90:time<16?120:140,origin=time<8?0:time<16?8:16;
 if(time>=14&&time<16)return 0;
 const age=(time-origin)%(60/bpm);
 const kick=age<.16?.72*Math.exp(-age*30)*Math.sin(2*Math.PI*(58*age+12*age*Math.exp(-age*20))):0;
 const bed=.025*Math.sin(2*Math.PI*220*time)*(time>=8?1:.5);
 return Math.max(-1,Math.min(1,kick+bed));
}
export function demoBlock(startFrame,count,sampleRate){return Float32Array.from({length:count},(_,i)=>demoSample((startFrame+i)/sampleRate));}
