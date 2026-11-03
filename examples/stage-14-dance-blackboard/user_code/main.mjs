import {readFileSync} from 'node:fs'
import {createReplayFixture} from '../core/replay-body.mjs'
import {parseBVH} from '../../../src/motion-lab/bvh.mjs'
import {createReplayExperiment} from '../../../src/motion/replay-experiment.mjs'
import {MusicAnalyzer} from '../../../electron/vendor/music-signal/analyzer.mjs'
import {demoBlock} from '../../../electron/vendor/music-signal/demo-audio.mjs'
const body=createReplayFixture(1.2,.15),bvh=process.argv[2]?parseBVH(readFileSync(process.argv[2],'utf8')):body.bvh;
const experiment=createReplayExperiment(body.vrm,bvh),time=Math.min(12,bvh.duration-.1);
const analyzer=new MusicAnalyzer({sampleRate:24000,streamId:'blackboard-example'});
const music=analyzer.push({mono:demoBlock(0,24000*4,24000),startFrame:0}).filter(p=>p.type==='features').at(-1);
const baseline=experiment.evaluate({time,music});experiment.evaluate({time:.1});const repeated=experiment.evaluate({time,music});
const source=experiment.evaluate({time,rootMode:'source',music}),mixed=experiment.evaluate({time,blendWeight:.5,music}),constrained=experiment.evaluate({time,constraints:true,music});
console.log(JSON.stringify({bodyType:'synthetic rig; native UI validates the actual local VRM',profile:experiment.profile,sourceType:process.argv[2]?'local research BVH':'original synthetic fixture',requestedTime:time,sourceTime:baseline.trace.time,stages:['source','retarget','blend','constrained','final'],deterministic:JSON.stringify(baseline.trace)===JSON.stringify(repeated.trace),music:{schema:music.schema,sampleFrame:music.sampleFrame,sampleRate:music.sampleRate,role:baseline.trace.musicRole},baselineChanges:baseline.changes,sourceRoot:source.trace.retarget.root,baselineRoot:baseline.trace.retarget.root,mixChanges:mixed.changes.blend,constraintChanges:constrained.changes.constrained,sourceDirection:baseline.sourceDirectionsError},null,2));
