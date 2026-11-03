import {verifyStablePCM} from '../core/stable-pcm.mjs'
import {readFileSync} from 'node:fs'
import {homedir} from 'node:os'
import {Vector3,Quaternion} from 'three'
import {parseBVH,skeletonAt} from '../../../src/motion-lab/bvh.mjs'
import {VRM_LINKS} from '../../../src/motion-lab/vrm-retarget.mjs'
import {createBeatMotionBank,BeatStepPlayer} from '../../../src/motion/beat-steps.mjs'
const bvh=parseBVH(readFileSync(process.argv[2]||`${homedir()}/Library/Application Support/Komorebi/research-references/dance-short.bvh`,'utf8')),idx=Object.fromEntries(bvh.joints.map((j,i)=>[j.name,i])),frames=[];
for(let i=0;i<Math.floor(bvh.duration*15);i++){
 const {positions:p}=skeletonAt(bvh,i/15),rotations={};for(const [name,a,b] of VRM_LINKS)rotations[name]=new Quaternion().setFromUnitVectors(new Vector3(0,1,0),new Vector3(...p[idx[b]]).sub(new Vector3(...p[idx[a]])).normalize()).toArray();
 frames.push({rotations,hips:p[idx.Hips].map(v=>v*.01),feet:{left:p[idx.Foot_L].map(v=>v*.01),right:p[idx.Foot_R].map(v=>v*.01)}})
}
const bank=createBeatMotionBank(frames,{fps:15});
const runs=[90,120,150].map(bpm=>{const player=new BeatStepPlayer(bank),visited=new Set();let p,maxJump=0,last;for(let i=0;i<900;i++){
 p=player.step({dt:1/30,active:true,bpm,beat:i/30*bpm/60,energy:.6,timing:'tracking'});visited.add(p.clip);if(last)for(const name of bank.names)maxJump=Math.max(maxJump,new Quaternion().fromArray(last.rotations[name]).angleTo(new Quaternion().fromArray(p.rotations[name])));last=p;
 }for(let i=0;i<30;i++)p=player.step({dt:1/30,active:false,bpm,beat:30*bpm/60});return {bpm,visited:[...visited],switches:p.switches,maxJointJumpRadians:maxJump,stoppedWeight:p.weight}});
console.log(JSON.stringify({contactMethod:bank.contactMethod,clips:bank.clips,contact:bank.contact.diagnostics,runs,pcm:[90,120,150].map(bpm=>verifyStablePCM(bank,bpm))},null,2));
