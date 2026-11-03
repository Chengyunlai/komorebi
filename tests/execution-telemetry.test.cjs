const test=require('node:test');
const assert=require('node:assert/strict');
const {sanitizeDanceStudy}=require('../electron/dance-study.cjs');
const execution=()=>({mode:'source-trajectory',worldAlignment:'body-basis',rootPolicy:'in-place-feet-midpoint',bankExecution:'source-ankle/v1',desiredError:.12,projectedCount:1,maxRotationRewriteRadians:.4,legacyContactApplied:false,finalWriter:'source-trajectory-executor',limiter:{mode:'planned-lower-body',factor:.8,feetTargetShift:.1},transitionPolicy:'heading-preroll'});
function report(){return {available:true,weight:1,beat:2.1,clipBeat:2.1,sourceFrame:42,phaseError:0,clockEpoch:3,switches:1,blockedTransitions:0,clip:0,support:'both',timing:'tracking',clips:Array.from({length:3},(_,id)=>({id,start:0,end:20,beats:4,activity:.5,anchors:[{beat:0,frame:0,side:'left'},{beat:1,frame:5,side:'right'},{beat:2,frame:10,side:'left'}]}))};}
test('IPC roundtrip retains source executor diagnostics without pose data or contact claims',()=>{
 const input={...report(),execution:{...execution(),rawPose:{secret:true}},contactMethod:'source-kinematic-estimate-no-lock',lastLanding:{side:'left',beat:2.1,kind:'kinematic',clockEpoch:3,trustedContact:true,rawPose:[1,2,3]},secret:'private'};
 const output=sanitizeDanceStudy(JSON.parse(JSON.stringify(input)));
 assert.deepEqual(output.execution,execution());
 assert.equal(output.contactMethod,'source-kinematic-estimate-no-lock');
 assert.deepEqual(output.lastLanding,{side:'left',beat:2.1,offsetBeats:2.1-2,kind:'kinematic',trustedContact:false,clockEpoch:3});
 assert.equal(output.contactError,null);assert.equal(output.contactLocked,0);
 assert.equal(JSON.stringify(output).includes('secret'),false);assert.equal(JSON.stringify(output).includes('rawPose'),false);
});
test('execution numeric values are bounded and non-finite values cannot cross IPC',()=>{
 const output=sanitizeDanceStudy({...report(),execution:{...execution(),desiredError:Infinity,projectedCount:20,maxRotationRewriteRadians:100,limiter:{mode:'legacy',factor:-2,feetTargetShift:Infinity}},lastLanding:{side:'right',kind:'kinematic',beat:3.2,clockEpoch:1e30,offsetBeats:Infinity}});
 assert.equal(output.execution.desiredError,null);assert.equal(output.execution.projectedCount,2);assert.equal(output.execution.maxRotationRewriteRadians,2*Math.PI);assert.deepEqual(output.execution.limiter,{mode:'legacy',factor:0,feetTargetShift:0});assert.equal(output.lastLanding.clockEpoch,Number.MAX_SAFE_INTEGER);assert.equal(output.lastLanding.offsetBeats,3.2-3);
 const bad=sanitizeDanceStudy({...report(),execution:{...execution(),projectedCount:1.2,maxRotationRewriteRadians:NaN,desiredError:-1}}).execution;
 assert.equal(bad.projectedCount,0);assert.equal(bad.maxRotationRewriteRadians,0);assert.equal(bad.desiredError,null);
});
test('unavailable execution fallback needs no clip anchors and remains bounded',()=>{
 assert.deepEqual(sanitizeDanceStudy({available:false,secret:'no'}),{available:false});
 assert.deepEqual(sanitizeDanceStudy({available:false,execution:execution(),weight:10,clip:-8,rawPose:[1]}),{available:false,execution:execution(),weight:1,clip:0});
});
test('legacy report shape and source-method validation remain compatible',()=>{
 const output=sanitizeDanceStudy({...report(),lastLanding:{side:'left',beat:2.1,offsetBeats:.1},contactMethod:'source-kinematic-estimate-no-lock'});
 assert.equal(output.contactMethod,'automatic-estimate');assert.equal('execution' in output,false);
 assert.deepEqual(output.lastLanding,{side:'left',beat:2.1,offsetBeats:.1});
 assert.equal(sanitizeDanceStudy({available:true}),null);
 assert.equal('execution' in sanitizeDanceStudy({...report(),execution:{...execution(),bankExecution:'untrusted'}}),false);
});
