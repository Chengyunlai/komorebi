import {restFeatures} from './vrm-clips.mjs'
const TAU=Math.PI*2,wrap=(v,n)=>((v%n)+n)%n,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const quintic=t=>t*t*t*(t*(t*6-15)+10);
// Cyclic Hermite interpolation preserves velocity at the phrase seam and interior knots.
const weights=[-.45,.8,.8,-.45,.45,-.8,-.8,.45];
function weightAt(beat){const x=wrap(beat,8),i=Math.floor(x),t=x-i,p0=weights[wrap(i-1,8)],p1=weights[i],p2=weights[(i+1)%8],p3=weights[(i+2)%8],m1=(p2-p0)*.5,m2=(p3-p1)*.5;return (2*t**3-3*t*t+1)*p1+(t**3-2*t*t+t)*m1+(-2*t**3+3*t*t)*p2+(t**3-t*t)*m2}
export const PHRASE_THEMES=[
 {name:'phrase-A',label:'侧踏摆臂',out:[.14,0],touch:[.10,0],lift:.085,weight:1},
 {name:'phrase-B',label:'宽步绕臂',out:[.17,0],touch:[.10,0],lift:.09,weight:1.1},
 {name:'phrase-C',label:'前点胸腰',out:[.07,.13],touch:[.06,.08],lift:.085,weight:.65},
 {name:'phrase-D',label:'提膝对摆',out:[.09,.08],touch:[.06,0],lift:.15,weight:.7},
 {name:'phrase-E',label:'斜踏伸展',out:[.15,.075],touch:[.08,-.035],lift:.1,weight:1},
 {name:'phrase-F',label:'后点低律动',out:[.10,-.07],touch:[.065,.04],lift:.065,weight:.8},
 {name:'phrase-G',label:'转身摆臂',out:[.12,.04],touch:[.09,.02],lift:.09,weight:1},
 {name:'phrase-H',label:'挥手致意',out:[.09,0],touch:[.07,.02],lift:.08,weight:.75},
 {name:'phrase-I',label:'指天伸展',out:[.08,.06],touch:[.06,.03],lift:.075,weight:.7},
 {name:'phrase-J',label:'抱胸律动',out:[.11,-.02],touch:[.08,0],lift:.07,weight:.85},
 {name:'phrase-K',label:'蹲起律动',out:[.10,.02],touch:[.07,.04],lift:.11,weight:.75},
 {name:'phrase-L',label:'侧滑步',out:[.18,0],touch:[.12,0],lift:.095,weight:1.05}
];
const stages={left:[[0,1,'base','out'],[3,4,'out','base'],[5,6,'base','touch'],[6,7,'touch','base']],right:[[1,2,'base','touch'],[2,3,'touch','base'],[4,5,'base','out'],[7,8,'out','base']]};
export function footAt(side,beat,variation=0){
 const theme=PHRASE_THEMES[variation]||PHRASE_THEMES[0],x=wrap(beat,8),sign=side==='left'?1:-1;
 const points={base:[0,0],out:[theme.out[0]*sign,theme.out[1]],touch:[-theme.touch[0]*sign,theme.touch[1]]};let position=points.base;
 for(const [start,end,from,to] of stages[side]){if(x<start)break;if(x<=end){const t=(x-start)/(end-start),u=quintic(t),a=points[from],b=points[to];return {x:a[0]+(b[0]-a[0])*u,z:a[1]+(b[1]-a[1])*u,y:theme.lift*Math.sin(Math.PI*t)**2,contact:t===0||t===1}}position=points[to]}
 return {x:position[0],z:position[1],y:0,contact:true};
}
/** Compatible phrases vary foot paths and whole-body motifs while sharing the seam. */
export function samplePhrase(beat,variation=0,{answer=false,accent=0}={}){
 const theme=PHRASE_THEMES[variation]||PHRASE_THEMES[0],b=wrap(beat,8),f=restFeatures(),swing=Math.sin(b*Math.PI/2),counter=Math.sin(b*Math.PI/2-.45),window=Math.sin(Math.PI*b/8)**2;
 Object.assign(f,{shift:weightAt(b),drop:.2+.1*Math.cos(TAU*b),twist:counter*.42,lean:-Math.sin(b*Math.PI/2-.2)*.24,leftReach:.24+swing*.14,rightReach:.24-swing*.14,leftFront:.25+counter*.16,rightFront:.25-counter*.16,leftElbow:.35-counter*.18,rightElbow:.35+counter*.18});
 f.shift*=1+(theme.weight-1)*window;
 if(variation===1){f.leftFront+=window*(.28+.25*Math.sin(b*Math.PI/2));f.rightFront+=window*(.28+.25*Math.cos(b*Math.PI/2));f.leftReach+=window*.25*(1+Math.cos(b*Math.PI/2));f.rightReach+=window*.25*(1-Math.cos(b*Math.PI/2));f.leftElbow+=window*.25;f.rightElbow+=window*.25;f.twist+=window*.22*swing}
 if(variation===2){f.fold+=window*.65*(.5+.5*swing);f.leftFront+=window*.35;f.rightFront+=window*.35;f.leftElbow+=window*.4;f.rightElbow+=window*.4;f.twist+=window*.3*Math.sin(b*Math.PI/2-.8);f.lean+=window*.15*Math.cos(b*Math.PI/2)}
 if(variation===3){f.leftFront+=window*.55*(.5-.5*swing);f.rightFront+=window*.55*(.5+.5*swing);f.leftElbow+=window*.45;f.rightElbow+=window*.45;f.drop+=window*.12;f.twist+=window*.25*swing}
 if(variation===4){f.leftReach+=window*.38*(.5+.5*Math.sin(b*Math.PI/4));f.rightReach+=window*.38*(.5-.5*Math.sin(b*Math.PI/4));f.twist+=window*.2*Math.cos(b*Math.PI/2);f.lean+=window*.2*Math.sin(b*Math.PI/4);f.leftElbow+=window*.1;f.rightElbow+=window*.1}
 if(variation===5){f.drop+=window*(.15+.08*Math.cos(TAU*b));f.twist+=window*.3*Math.sin(b*Math.PI/2);f.leftElbow+=window*.35*(.5+.5*swing);f.rightElbow+=window*.35*(.5-.5*swing);f.leftFront+=window*.2;f.rightFront+=window*.2;f.lean-=window*.15*counter}
 if(variation===6){f.twist+=window*.55*Math.sin(b*Math.PI/2);f.lean+=window*.2*Math.cos(b*Math.PI/2);f.leftReach+=window*.3*(.5+.5*swing);f.rightReach+=window*.3*(.5-.5*swing);f.leftFront+=window*.25;f.rightFront+=window*.25;f.shift+=window*.12*Math.sin(TAU*b)}
 if(variation===7){f.rightReach+=window*.72;f.rightElbow+=window*.5;f.rightFront+=window*.35;f.lean+=window*.12*Math.cos(b*Math.PI/2);f.headDrop=0}
 if(variation===8){f.leftReach+=window*.78;f.leftElbow+=window*.2;f.leftFront+=window*.45;f.lean-=window*.18;f.drop+=window*.1}
 if(variation===9){f.fold+=window*.85;f.leftElbow+=window*.6;f.rightElbow+=window*.6;f.twist+=window*.2*Math.sin(b*Math.PI/2);f.drop+=window*.08;f.lean+=window*.08}
 if(variation===10){f.drop+=window*.42;f.leftReach+=window*.15;f.rightReach+=window*.15;f.lean+=window*.1*Math.cos(b*Math.PI/2)}
 if(variation===11){f.shift+=window*.38*Math.sin(TAU*b/8);f.twist+=window*.18*Math.sin(TAU*b/8);f.leftReach+=window*.2*(.5+.5*swing);f.rightReach+=window*.2*(.5-.5*swing);f.drop+=window*.06}
 // Response variation shares the same feet and vanishes at the phrase seam.
 if(answer){f.leftFront+=window*.16*(.5+.5*counter);f.rightFront+=window*.16*(.5-.5*counter);f.twist-=window*.14*counter}
 // Short audio accents affect upper-body articulation, not planted-foot targets.
 f.leftElbow+=accent*.07;f.rightElbow+=accent*.07;f.leftFront+=accent*.04;f.rightFront+=accent*.04;
 if(variation===6)f.twist+=.28*Math.sin(TAU*b/8);
 const left=footAt('left',b,variation),right=footAt('right',b,variation);
 f.stepL=left.x/.18;f.stepR=-right.x/.18;f.liftL=left.y/.14;f.liftR=right.y/.14;f.forwardL=left.z/.16;f.forwardR=right.z/.16;
 return {features:f,contacts:{left:left.contact,right:right.contact},support:left.contact&&!right.contact?'left':right.contact&&!left.contact?'right':'double',phase:b,name:theme.name,label:theme.label};
}

/**
 * Layered arm vocabulary. Feet and torso stay on the 8-count phrase grid; arms run on
 * their own shorter clock so the body does not read as a small rotation of full-body
 * poses. Each move is a target shape plus a small internal sway.
 */
export const ARM_MOVES = [
  {name:'arm-swing', label:'摆臂', left:{reach:.24,front:.25,fold:0,elbow:.35}, right:{reach:.24,front:.25,fold:0,elbow:.35}, sway:.14},
  {name:'arm-wave', label:'挥手', left:{reach:.86,front:.30,fold:0,elbow:.62}, right:{reach:.18,front:.18,fold:0,elbow:.3}, sway:.18},
  {name:'arm-both-up', label:'双手举起', left:{reach:.78,front:.16,fold:0,elbow:.2}, right:{reach:.78,front:.16,fold:0,elbow:.2}, sway:.1},
  {name:'arm-point', label:'指', left:{reach:.2,front:.16,fold:0,elbow:.3}, right:{reach:.94,front:.42,fold:0,elbow:.06}, sway:.05},
  {name:'arm-cross', label:'抱胸', left:{reach:.12,front:.1,fold:.82,elbow:.55}, right:{reach:.12,front:.1,fold:.82,elbow:.55}, sway:.06},
  {name:'arm-open', label:'张开', left:{reach:.52,front:.06,fold:0,elbow:.18}, right:{reach:.52,front:.06,fold:0,elbow:.18}, sway:.16},
  {name:'arm-alternate', label:'交替摆', left:{reach:.34,front:.4,fold:0,elbow:.3}, right:{reach:.34,front:.4,fold:0,elbow:.3}, sway:.28},
  {name:'arm-bounce', label:'弹手', left:{reach:.4,front:.3,fold:0,elbow:.55}, right:{reach:.4,front:.3,fold:0,elbow:.55}, sway:.34}
];

/** Arm target features for a move at a beat; the sway makes the shape breathe. */
export function sampleArm(beat, moveIndex=0, {energy=.5, accent=0}={}) {
  const move = ARM_MOVES[moveIndex] || ARM_MOVES[0]
  const b = wrap(beat, 8)
  const breathe = Math.sin(b * Math.PI / 2)
  const sway = move.sway * (0.55 + 0.45 * breathe)
  const lift = .12 + energy * .2
  return {
    leftReach: clamp(move.left.reach + sway * .5, 0, 1),
    rightReach: clamp(move.right.reach - sway * .5, 0, 1),
    leftFront: clamp(move.left.front + sway * .4, 0, 1),
    rightFront: clamp(move.right.front - sway * .4, 0, 1),
    fold: clamp(move.left.fold + (move.right.fold - move.left.fold) * .5 + sway * .25, 0, 1),
    leftElbow: clamp(move.left.elbow + sway * .3 + accent * .08, 0, 1),
    rightElbow: clamp(move.right.elbow - sway * .3 + accent * .08, 0, 1),
    sway,
  }
}
