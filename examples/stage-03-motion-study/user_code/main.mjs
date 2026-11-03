import {readFile} from 'node:fs/promises';
import {parseMotion,sampleCurve,speedMarkers} from '#motion-curves';
import {parseBVH,skeletonAt} from '#bvh';
const source=JSON.parse(await readFile(new URL('../../../public/vendor/hiyori_free_zh/runtime/motion/hiyori_m05.motion3.json',import.meta.url),'utf8'));
const motion=parseMotion(source),arm=motion.curves.find(c=>c.id==='ParamArmLA');
console.log(JSON.stringify({file:'hiyori_m05',duration:motion.duration,curves:motion.curves.length,leftArmAt1Second:sampleCurve(arm,1),speedCandidates:speedMarkers(motion)}));
if(process.argv[2]){
 const bvh=parseBVH(await readFile(process.argv[2],'utf8'));
 console.log(JSON.stringify({duration:bvh.duration,frames:bvh.frameCount,channels:bvh.channelCount,poseAt1Second:skeletonAt(bvh,1).positions.slice(0,3)}));
}
