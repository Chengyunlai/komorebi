export function groupFor(id){
 if(/^ParamAngle|^ParamEyeBall/.test(id))return 'head';
 if(/^ParamBody|^ParamBreath/.test(id))return 'body';
 if(/^ParamArm|^ParamHand|^PartArm/.test(id))return 'arms';
 if(/^ParamEye|^ParamBrow|^ParamMouth|^ParamCheek/.test(id))return 'face';
 return 'other';
}
export function parseMotion(json){
 if(!json?.Meta||!Number.isFinite(json.Meta.Duration)||json.Meta.Duration<=0)throw Error('动作时长无效');
 const curves=json.Curves.map(c=>{
  const values=c.Segments;if(!Array.isArray(values)||values.length<2||!values.every(Number.isFinite))throw Error('动作曲线无效');
  let p={t:values[0],v:values[1]},i=2;const segments=[];
  while(i<values.length){
   const type=values[i++];if(![0,1,2,3].includes(type))throw Error('未知插值类型');
   const count=type===1?3:1;if(i+count*2>values.length)throw Error('动作曲线截断');
   const points=[p];for(let n=0;n<count;n++)points.push({t:values[i++],v:values[i++]});
   if(points.at(-1).t<p.t)throw Error('动作时间倒序');
   segments.push({type,points});p=points.at(-1);
  }
  return {id:c.Id,target:c.Target,group:groupFor(c.Id),start:{t:values[0],v:values[1]},end:p,segments};
 });
 return {duration:json.Meta.Duration,fps:json.Meta.Fps,curves};
}
const cubic=(a,b,c,d,t)=>a*(1-t)**3+3*b*t*(1-t)**2+3*c*t*t*(1-t)+d*t**3;
export function sampleCurve(curve,time){
 if(time<=curve.start.t)return curve.start.v;
 if(time>=curve.end.t)return curve.end.v;
 const segment=curve.segments.find(s=>time<s.points.at(-1).t);if(!segment)return curve.end.v;
 const p=segment.points,a=p[0],b=p.at(-1);
 if(segment.type===2)return a.v;
 if(segment.type===3)return b.v;
 if(segment.type===0)return a.v+(b.v-a.v)*(time-a.t)/(b.t-a.t||1);
 let lo=0,hi=1;for(let n=0;n<35;n++){const t=(lo+hi)/2;if(cubic(a.t,p[1].t,p[2].t,b.t,t)<time)lo=t;else hi=t;}
 return cubic(a.v,p[1].v,p[2].v,b.v,(lo+hi)/2);
}
export function curvePath(curve,{min,max},width=600,height=38,duration=curve.end.t){
 return Array.from({length:241},(_,i)=>{const x=i/240*width,y=height-(sampleCurve(curve,i/240*duration)-min)/(max-min||1)*height;return `${i?'L':'M'}${x.toFixed(2)},${y.toFixed(2)}`;}).join(' ');
}
export function speedMarkers(motion){
 const curves=motion.curves.filter(c=>c.target==='Parameter'&&['head','body','arms'].includes(c.group));
 const candidates=[];
 for(let t=.04;t<motion.duration-.04;t+=.04){
  const speed=curves.reduce((n,c)=>{const span=Math.max(...c.segments.flatMap(s=>s.points.map(p=>p.v)))-Math.min(...c.segments.flatMap(s=>s.points.map(p=>p.v)));return n+Math.abs(sampleCurve(c,t+.02)-sampleCurve(c,t-.02))/(span||1);},0);
  candidates.push({time:t,speed});
 }
 const chosen=[];for(const c of candidates.sort((a,b)=>b.speed-a.speed))if(chosen.every(x=>Math.abs(x.time-c.time)>.4)){chosen.push(c);if(chosen.length===6)break;}
 return chosen.sort((a,b)=>a.time-b.time);
}
