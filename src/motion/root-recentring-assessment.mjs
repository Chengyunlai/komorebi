const subtract=(a,b)=>a.map((v,i)=>v-b[i]);
const multiply=(a,s)=>a.map(v=>v*s);
const horizontal=v=>[v[0],0,v[2]];
const magnitude=v=>Math.hypot(...v);
const dot=(a,b)=>a.reduce((sum,v,i)=>sum+v*b[i],0);
const stats=values=>{const sorted=[...values].sort((a,b)=>a-b);return {count:values.length,max:sorted.at(-1)??0,p95:sorted[Math.max(0,Math.ceil(sorted.length*.95)-1)]??0,mean:values.reduce((a,b)=>a+b,0)/(values.length||1)}};
/** Finite-difference attribution in source metres. No filtering, retarget, IK or music time warp.
 * samples are one continuous interval, not concatenated clips. No raw positions are returned. */
export function assessRootRecentring(samples,{sourceUnitMetres=1}={}){
 if(!Number.isFinite(sourceUnitMetres)||sourceUnitMetres<=0||!Array.isArray(samples)||samples.length<3)throw Error('Expected at least three continuous samples and a positive unit scale');
 const vector=value=>Array.isArray(value)&&value.length===3&&value.every(Number.isFinite);
 const points=samples.map((sample,i)=>{
  if(!Number.isFinite(sample.time)||(i&&sample.time<=samples[i-1].time)||!vector(sample.hips)||!vector(sample.feet?.left)||!vector(sample.feet?.right))throw Error('Invalid root sample or non-increasing time');
  const hips=horizontal(multiply(sample.hips,sourceUnitMetres)),center=horizontal(sample.feet.left.map((v,k)=>(v+sample.feet.right[k])*sourceUnitMetres/2));
  return {time:sample.time,hips,center,relative:subtract(hips,center)};
 });
 const velocities=points.slice(1).map((point,i)=>{const dt=point.time-points[i].time;return {time:point.time,midTime:(point.time+points[i].time)/2,...Object.fromEntries(['hips','center','relative'].map(key=>[key,multiply(subtract(point[key],points[i][key]),1/dt)]))}});
 const acceleration=velocities.slice(1).map((velocity,i)=>Object.fromEntries(['hips','center','relative'].map(key=>[key,magnitude(multiply(subtract(velocity[key],velocities[i][key]),1/(velocity.midTime-velocities[i].midTime)))])));
 const worst=velocities.reduce((a,b)=>magnitude(a.relative)>=magnitude(b.relative)?a:b);
 let identityError=0,hipSquared=0,centerSquared=0,crossTerm=0,relativeSquared=0;
 for(const v of velocities){const h=dot(v.hips,v.hips),c=dot(v.center,v.center),cross=-2*dot(v.hips,v.center),r=dot(v.relative,v.relative);hipSquared+=h;centerSquared+=c;crossTerm+=cross;relativeSquared+=r;identityError=Math.max(identityError,Math.abs(h+c+cross-r))}
 const n=velocities.length;
 return {scope:'source horizontal finite differences; no target model, physical contact or visual-quality claim',unit:{position:'metre',speed:'metre/second',acceleration:'metre/second²',sourceUnitMetres},sampleCount:points.length,timeRange:[points[0].time,points.at(-1).time],speed:Object.fromEntries(['hips','center','relative'].map(key=>[key,stats(velocities.map(v=>magnitude(v[key])))])),acceleration:Object.fromEntries(['hips','center','relative'].map(key=>[key,stats(acceleration.map(v=>v[key]))])),squaredSpeedDecomposition:{formula:'|vH-vC|² = |vH|² + |vC|² - 2 dot(vH,vC)',hipsMean:hipSquared/n,centerMean:centerSquared/n,crossMean:crossTerm/n,relativeMean:relativeSquared/n,maxIdentityError:identityError},worstRelativeSpeed:{time:worst.time,hips:magnitude(worst.hips),center:magnitude(worst.center),relative:magnitude(worst.relative)}};
}
