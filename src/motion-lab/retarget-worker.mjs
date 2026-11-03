import {buildRetargetMotion} from './retarget.mjs';
self.onmessage=({data})=>{try{self.postMessage(buildRetargetMotion(data.bvh,data.rig,data.options))}catch(error){self.postMessage({error:error.message})}};
