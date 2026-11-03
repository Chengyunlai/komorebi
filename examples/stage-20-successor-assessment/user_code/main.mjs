import {readFileSync} from 'node:fs'
import {createRotationFixture} from '../../stage-15-rotation-retarget/core/rotation-body.mjs'
import {parseBVH} from '../../../src/motion-lab/bvh.mjs'
import {buildSourceMotionMaterial} from '../../../src/motion/source-material.mjs'
import {buildSourceContactEvidence} from '../../../src/motion/source-contact-evidence.mjs'
import {assessMotionSuccessor,rankMotionSuccessors} from '../../../src/motion/successor-assessment.mjs'
const file=process.argv[2],bvh=file?parseBVH(readFileSync(file,'utf8')):createRotationFixture().bvh;
const material=buildSourceMotionMaterial(bvh,{metersPerUnit:file?Number(process.argv[3]):1,sourceId:file?'local-research':'original-fixture'}),contacts=buildSourceContactEvidence(material);
const outgoingTime=file?10.5:.2,duration=.5,candidates=[];
for(let t=file?9:.3;t<=material.range.end-(file?2.5:.6);t+=file?.5:.2)if(Math.abs(t-outgoingTime)>(file?.75:0))candidates.push({id:`source-${t.toFixed(2)}`,time:t});
const ranked=rankMotionSuccessors(material,{outgoingTime,candidates,duration,contacts});
const selected=assessMotionSuccessor(material,{outgoingTime,incomingTime:file?12.6:.8,duration,contacts});
console.log(JSON.stringify({schema:'successor-assessment-example/v1',sourceId:material.sourceId,contactDiagnostics:contacts.diagnostics,candidateCount:candidates.length,counts:Object.fromEntries(['eligible','review','rejected'].map(status=>[status,ranked.filter(row=>row.status===status).length])),current:selected,top:ranked.slice(0,5),scope:'aggregate boundary assessment; estimated contacts require review; no automatic daily execution'},null,2));
