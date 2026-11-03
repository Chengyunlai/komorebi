const keys=['headX','headY','headZ','bodyX','bodyY','bodyZ','leftArm','rightArm'];
/** Semantic motion patterns, independent of the music analyzer and Live2D IDs. */
export function applyBehaviorPose(pose,intent,envelope,beat=0){
 const mode=intent?.choice,result={...pose},a=beat*Math.PI*2,s=pose.strength;
 let pattern=null;
 if(mode==='gentle')pattern={headX:Math.sin(a/4)*.18,headY:-.10+Math.cos(a/2)*.06,headZ:-Math.sin(a/4)*.15,bodyX:Math.sin(a/4-.2)*.22,bodyY:-.04,bodyZ:Math.sin(a/4-.3)*.18,leftArm:.12+.25*(1+Math.sin(a/4))/2,rightArm:.12+.25*(1+Math.sin(a/4))/2};
 if(mode==='energetic'){
  const accent=Math.pow(Math.max(0,Math.cos(a)),3),side=Math.sin(a/2);
  pattern={headX:side*.48,headY:-.14-accent*.38,headZ:-side*.36,bodyX:Math.sin(a/2-.3)*.65,bodyY:-accent*.28,bodyZ:Math.sin(a/2-.25)*.55,leftArm:-.25+Math.max(0,side)*1.65,rightArm:-.25+Math.max(0,-side)*1.65};
 }
 for(const key of keys)result[key]=Math.max(-.9,Math.min(.9,(pattern?pattern[key]*Math.min(1,s*2):pose[key])*envelope));
 result.strength=s*envelope;
 return result;
}
