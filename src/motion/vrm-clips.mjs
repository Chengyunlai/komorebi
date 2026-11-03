// Original authored movement sketches. No external motion capture or training data.
const keys=['shift','drop','twist','lean','leftReach','rightReach','leftFront','rightFront','leftElbow','rightElbow','fold','stepL','stepR','liftL','liftR','forwardL','forwardR'];
export const restFeatures=()=>Object.fromEntries(keys.map(k=>[k,0]));
const pose=(time,features)=>({time,features});
const idle=()=>pose(0,{}),end=()=>pose(1,{});
export const VRM_CLIPS={
 'step-touch':[idle(),pose(.16,{shift:-.2,drop:.22,leftElbow:.3,rightElbow:.3}),pose(.42,{shift:.85,drop:.12,twist:-.3,stepL:1,liftL:.65,rightReach:.5,rightFront:.7,rightElbow:.5,leftElbow:.8}),pose(.67,{shift:.7,stepL:1,leftReach:.4,rightFront:.3,twist:.25}),pose(.84,{shift:.25,stepL:.4,liftL:.45,drop:.15}),end()],
 'cross-open':[idle(),pose(.2,{drop:.3,fold:1,leftFront:.6,rightFront:.6,leftElbow:1,rightElbow:1,twist:-.25}),pose(.48,{leftReach:.6,rightReach:.6,leftElbow:.15,rightElbow:.15,twist:.5,lean:-.25,shift:.4}),pose(.72,{leftReach:.35,rightReach:.5,twist:.2,stepL:.5,liftL:.25}),end()],
 'diagonal-reach':[idle(),pose(.18,{drop:.25,twist:-.3,leftElbow:.7,rightElbow:.8,shift:-.25}),pose(.48,{leftReach:1,leftElbow:.15,rightFront:.85,rightElbow:.9,twist:.5,lean:-.5,shift:.45,stepR:.55,liftR:.25}),pose(.72,{leftReach:.7,rightFront:.4,twist:.3,lean:-.25,drop:.15}),end()],
 'knee-drive':[idle(),pose(.2,{shift:-.5,drop:.3,leftElbow:.5,rightElbow:.5}),pose(.48,{shift:-.6,liftL:1,forwardL:1,twist:.4,rightFront:1,rightElbow:1,leftReach:.25,leftElbow:.7}),pose(.72,{shift:-.3,liftL:.6,forwardL:.7,rightFront:.6,twist:.1}),pose(.9,{drop:.25,leftElbow:.3,rightElbow:.3}),end()],
 'body-drop':[idle(),pose(.18,{leftReach:.25,rightReach:.25,leftElbow:.2,rightElbow:.2}),pose(.43,{drop:1,twist:.25,leftFront:.55,rightFront:.55,leftElbow:.85,rightElbow:.85,shift:.2}),pose(.68,{drop:.4,twist:-.4,lean:.3,leftReach:.45,rightReach:.3,leftElbow:.3,rightElbow:.6}),end()]
};
const smooth=t=>t*t*(3-2*t);
export function sampleClip(name,phase,side=1){
 const frames=VRM_CLIPS[name];if(!frames)throw Error('未知VRM动作片段');const t=Math.min(1,Math.max(0,phase));let i=1;while(i<frames.length-1&&t>frames[i].time)i++;const a=frames[i-1],b=frames[i],u=smooth((t-a.time)/(b.time-a.time));const result=restFeatures();for(const k of keys)result[k]=(a.features[k]||0)*(1-u)+(b.features[k]||0)*u;
 if(side<0){for(const [l,r] of [['leftReach','rightReach'],['leftFront','rightFront'],['leftElbow','rightElbow'],['stepL','stepR'],['liftL','liftR'],['forwardL','forwardR']])[result[l],result[r]]=[result[r],result[l]];for(const k of ['shift','twist','lean'])result[k]*=-1}
 return result;
}
