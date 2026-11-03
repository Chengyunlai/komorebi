import {readFile,writeFile} from 'node:fs/promises';
import {parseBVH} from '#bvh';
import {RETARGET_IDS,buildRetargetMotion} from '#retarget';
if(!process.argv[2])throw Error('请提供本机研究用BVH路径；可选第二个参数是输出motion3路径。');
const bvh=parseBVH(await readFile(process.argv[2],'utf8'));
// CLI uses the documented Hiyori ranges; GUI obtains these values from actual Cubism Core.
const rig=RETARGET_IDS.map(id=>({id,min:id.startsWith('ParamAngle')?-30:-10,max:id.startsWith('ParamAngle')?30:10,neutral:0}));
const result=buildRetargetMotion(bvh,rig);
console.log(JSON.stringify(result.stats));
if(process.argv[3])await writeFile(process.argv[3],JSON.stringify(result.source));
