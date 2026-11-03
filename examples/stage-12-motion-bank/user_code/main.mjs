import {readFileSync} from 'node:fs'
import {homedir} from 'node:os'
import {Vector3,Quaternion} from 'three'
import {parseBVH,skeletonAt} from '../../../src/motion-lab/bvh.mjs'
import {VRM_LINKS} from '../../../src/motion-lab/vrm-retarget.mjs'
import {createMotionBank,MotionBankPlayer} from '../../../src/motion/motion-bank.mjs'
const bvh=parseBVH(readFileSync(process.argv[2]||`${homedir()}/Library/Application Support/Komorebi/research-references/dance-short.bvh`,'utf8')),index=Object.fromEntries(bvh.joints.map((j,i)=>[j.name,i])),frames=[];
// Source skeleton proxy exercises the real bank. Native renderer uses VRM retargeted poses.
for(let i=0;i<Math.floor(bvh.duration*15);i++){const {positions:p}=skeletonAt(bvh,i/15),rotations={};for(const [name,a,b] of VRM_LINKS)rotations[name]=new Quaternion().setFromUnitVectors(new Vector3(0,1,0),new Vector3(...p[index[b]]).sub(new Vector3(...p[index[a]])).normalize()).toArray();frames.push({rotations,hips:[0,0,0]})}
const bank=createMotionBank(frames),player=new MotionBankPlayer(bank),visited=new Set();let maxJump=0,last;
for(let i=0;i<3600;i++){const p=player.step({dt:1/30,active:i<3500,bpm:110,energy:i<1800?.2:.9});visited.add(p.clip);if(last)maxJump=Math.max(maxJump,new Quaternion().fromArray(last.rotations.leftUpperArm).angleTo(new Quaternion().fromArray(p.rotations.leftUpperArm)));last=p}
console.log(JSON.stringify({frames:frames.length,clips:bank.clips.length,visited:[...visited],switches:player.switches,maxArmFrameChange:maxJump,stoppedWeight:last.weight},null,2));
