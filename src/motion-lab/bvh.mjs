const identity=()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
function multiply(a,b){return Array.from({length:16},(_,i)=>{const row=Math.floor(i/4),col=i%4;let v=0;for(let k=0;k<4;k++)v+=a[row*4+k]*b[k*4+col];return v;});}
export function parseBVH(text){
 const tokens=text.match(/[^\s{}]+|[{}]/g)||[];let i=0,channelCount=0;const joints=[];
 const expect=t=>{if(tokens[i++]!==t)throw Error('BVH结构无效：'+t);};
 function joint(parent,isEnd=false){
  const name=isEnd?'End Site':tokens[i++];expect('{');
  const index=joints.length,node={name,parent,offset:[0,0,0],channels:[],channelStart:channelCount};joints.push(node);
  while(tokens[i]!=='}'){
   const t=tokens[i++];if(t==='OFFSET'){node.offset=tokens.slice(i,i+3).map(Number);i+=3;}
   else if(t==='CHANNELS'){const n=Number(tokens[i++]);node.channels=tokens.slice(i,i+n);i+=n;node.channelStart=channelCount;channelCount+=n;}
   else if(t==='JOINT')joint(index);else if(t==='End'){expect('Site');joint(index,true);}else throw Error('未知BVH字段');
   if(i>=tokens.length)throw Error('BVH截断');
  }expect('}');
 }
 expect('HIERARCHY');expect('ROOT');joint(-1);expect('MOTION');expect('Frames:');const frameCount=Number(tokens[i++]);expect('Frame');expect('Time:');const frameTime=Number(tokens[i++]);
 if(!Number.isSafeInteger(frameCount)||frameCount<1||frameCount>200000||!Number.isFinite(frameTime)||frameTime<=0||channelCount<1||tokens.length-i!==frameCount*channelCount)throw Error('BVH帧数或通道无效');
 const values=Float32Array.from(tokens.slice(i),Number);if(!values.every(Number.isFinite)||joints.some(j=>!j.offset.every(Number.isFinite)))throw Error('BVH数值无效');
 return {joints,channelCount,frameCount,frameTime,duration:frameCount*frameTime,values};
}
export function skeletonAt(bvh,time){
 // Products such as frame * frameTime can divide back to frame - 1 ULP.
 // A 1e-8-frame tolerance restores exact source-frame roundtrips (sub-nanosecond here).
 const frame=Math.min(bvh.frameCount-1,Math.max(0,Math.floor(time/bvh.frameTime+1e-8))),matrices=[],positions=[];
 for(const joint of bvh.joints){
  let local=identity();
  // These BVH position channels specify local joint positions, including the rest offset.
  // Keep OFFSET only on axes without a position channel (Blender-compatible import).
  local[3]=joint.channels.includes('Xposition')?0:joint.offset[0];local[7]=joint.channels.includes('Yposition')?0:joint.offset[1];local[11]=joint.channels.includes('Zposition')?0:joint.offset[2];
  joint.channels.forEach((channel,k)=>{
   const value=bvh.values[frame*bvh.channelCount+joint.channelStart+k],axis='XYZ'.indexOf(channel[0]);if(axis<0)throw Error('未知BVH轴');
   const transform=identity();
   if(channel.endsWith('position'))transform[axis*4+3]=value;
   else if(channel.endsWith('rotation')){
    const a=value*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
    if(axis===0){transform[5]=c;transform[6]=-s;transform[9]=s;transform[10]=c;}
    if(axis===1){transform[0]=c;transform[2]=s;transform[8]=-s;transform[10]=c;}
    if(axis===2){transform[0]=c;transform[1]=-s;transform[4]=s;transform[5]=c;}
   }else throw Error('未知BVH通道');
   local=multiply(local,transform);
  });
  const world=joint.parent<0?local:multiply(matrices[joint.parent],local);matrices.push(world);positions.push([world[3],world[7],world[11]]);
 }
 return {frame,positions,matrices};
}

/** Exclude the scene/trajectory root from the human skeleton. */
export function anatomicalEdges(bvh){
 return bvh.joints.flatMap((joint,index)=>joint.parent<0||/^joint_Root$/i.test(bvh.joints[joint.parent].name)?[]:[{from:joint.parent,to:index,name:joint.name}]);
}
