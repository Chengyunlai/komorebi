const fs=require('node:fs');
const {inspectVRM}=require('../../../electron/vrm-model.cjs');
if(!process.argv[2])throw Error('请传入本机 .vrm 文件路径；不会上传或复制模型。');
console.log(JSON.stringify(inspectVRM(fs.readFileSync(process.argv[2])),null,2));
