const fs=require('node:fs');
const path=require('node:path');
/** Local GLB only: never let the model loader fetch arbitrary external resources. */
function inspectVRM(bytes){
 if(bytes.length<20||bytes.length>64*1024*1024||bytes.toString('ascii',0,4)!=='glTF'||bytes.readUInt32LE(4)!==2||bytes.readUInt32LE(8)!==bytes.length)throw Error('请选择有效的 VRM / GLB 文件（最大64MB）');
 const length=bytes.readUInt32LE(12);if(bytes.readUInt32LE(16)!==0x4e4f534a||length>bytes.length-20)throw Error('模型结构无效');
 const json=JSON.parse(bytes.toString('utf8',20,20+length));
 for(const resource of [...(json.buffers||[]),...(json.images||[])])if(resource.uri&&!resource.uri.startsWith('data:'))throw Error('模型包含外部资源，请先导出为完整VRM');
 const extension=json.extensions?.VRM||json.extensions?.VRMC_vrm;if(!extension)throw Error('缺少VRM人物骨骼定义');
 const bones=extension.humanoid?.humanBones, names=Array.isArray(bones)?bones.map(b=>b.bone):Object.keys(bones||{});
 for(const name of ['hips','head','leftUpperArm','leftLowerArm','rightUpperArm','rightLowerArm','leftUpperLeg','leftLowerLeg','rightUpperLeg','rightLowerLeg','leftFoot','rightFoot'])if(!names.includes(name))throw Error('缺少全身骨骼：'+name);
 return {version:json.extensions.VRM?'0.x':'1.0',bones:names,author:extension.meta?.author||extension.meta?.authors?.join(', ')||'',title:extension.meta?.title||extension.meta?.name||'VRM'};
}
function readVRM(file){if(!fs.existsSync(file))return null;const size=fs.statSync(file).size;if(size>64*1024*1024)throw Error('模型超过64MB');const bytes=fs.readFileSync(file);return {info:inspectVRM(bytes),bytes:new Uint8Array(bytes)};}
const bundledAvatar=path.join(__dirname,'../assets/avatars/sendagaya-shino/Sendagaya_Shino.vrm');
function readAvatar(dataDir){
 const local=readVRM(path.join(dataDir,'local-models','Cute_Model.vrm'));
 if(local)return {...local,source:'imported'};
 const bundled=readVRM(bundledAvatar);
 if(!bundled)throw Error('内置角色文件缺失，请重新安装 Komorebi，或在偏好设置中导入 VRM。');
 return {...bundled,source:'bundled'};
}
module.exports={inspectVRM,readVRM,readAvatar,bundledAvatar};
