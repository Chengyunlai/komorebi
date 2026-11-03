import {readFileSync} from 'node:fs'
import {parseBVH,skeletonAt} from '../../../src/motion-lab/bvh.mjs'
import {assessRootRecentring} from '../../../src/motion/root-recentring-assessment.mjs'
const file=process.argv[2];
if(!file)throw Error('Pass a local BVH path; the example does not bundle source motion');
const bvh=parseBVH(readFileSync(file,'utf8')),index=Object.fromEntries(bvh.joints.map((j,i)=>[j.name,i]));
for(const name of ['Hips','Foot_L','Foot_R'])if(index[name]===undefined)throw Error('Missing joint '+name);
const intervals=[{name:'native-source',dt:bvh.frameTime},{name:'compile-grid',dt:1/15}],windows=[{name:'continuous-9-48',start:9,end:48},{name:'continuous-9-end',start:9,end:(bvh.frameCount-1)*bvh.frameTime}];
const results=intervals.flatMap(({name,dt})=>windows.map(window=>{
 // Align the grid to source/compile time zero, matching local-dance compilation.
 const samples=[];for(let i=Math.ceil(window.start/dt);i*dt<=window.end+1e-9;i++){const time=i*dt,s=skeletonAt(bvh,time);samples.push({time,hips:s.positions[index.Hips],feet:{left:s.positions[index.Foot_L],right:s.positions[index.Foot_R]}})}
 return {sampling:name,gridSeconds:dt,window:window.name,...assessRootRecentring(samples,{sourceUnitMetres:.01})};
}));
console.log(JSON.stringify({schema:'root-recentring/v1',source:{frameCount:bvh.frameCount,frameTime:bvh.frameTime,sourceUnits:'centimetres assumed explicitly'},limitations:['Continuous source windows, not selected bank clips','15Hz samples use the existing floor-to-source-frame sampler','No target scale, socket correction, interpolation, music time warp or visual assessment','The 15Hz continuous end window includes one final sample beyond prepareLocalDance floor(duration*fps) truncation'],results},null,2));
